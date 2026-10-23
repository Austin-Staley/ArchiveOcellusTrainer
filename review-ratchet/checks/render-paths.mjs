#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const usage = `usage: render-paths.mjs SAMPLES.json

SAMPLES.json is an array of tracks, one per entity per tick:
  { "entity": "mark@5,1", "tick": 17, "samples": [{ "at": 0.25, "flat": true, "model": true }, ...] }
"flat" says the 2D path drew the entity visibly at that fraction of the tick and
"model" says the 3D path did. When both paths draw an entity during a tick, they
must draw it at the same fractions. A path that never draws it in that tick is
an explicit omission, not a gap. Exits 0 with no gap, 1 on a gap, and 2 when
SAMPLES.json is unreadable, malformed or empty.
`;

/**
 * @typedef {Readonly<{ at: number; flat: boolean; model: boolean }>} Sample
 * @typedef {Readonly<{ entity: string; tick: number; samples: readonly Sample[] }>} Track
 * @typedef {Readonly<{ entity: string; tick: number; flatOnly: readonly number[]; modelOnly: readonly number[] }>} Gap
 */

/**
 * @param {readonly Track[]} tracks
 * @returns {Gap[]}
 */
export function renderPathGaps(tracks) {
  return tracks.flatMap(({ entity, tick, samples }) => {
    if (!samples.some((sample) => sample.flat) || !samples.some((sample) => sample.model)) return [];
    const flatOnly = samples.filter((sample) => sample.flat && !sample.model).map((sample) => sample.at);
    const modelOnly = samples.filter((sample) => sample.model && !sample.flat).map((sample) => sample.at);
    return flatOnly.length === 0 && modelOnly.length === 0 ? [] : [{ entity, tick, flatOnly, modelOnly }];
  });
}

/** @returns {Track[]} */
function parseTracks(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("expected a non-empty array of tracks");
  return parsed.map((track, index) => {
    const where = `track ${index}`;
    if (typeof track?.entity !== "string" || !Number.isInteger(track.tick) || !Array.isArray(track.samples) || track.samples.length === 0) {
      throw new Error(`${where} needs an entity, an integer tick and samples`);
    }
    for (const sample of track.samples) {
      if (typeof sample?.at !== "number" || !(sample.at > 0 && sample.at <= 1) || typeof sample.flat !== "boolean" || typeof sample.model !== "boolean") {
        throw new Error(`${where} has a sample without a fraction in (0, 1] and boolean flat and model`);
      }
    }
    return track;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === "-h" || args[0] === "--help") {
    process.stdout.write(usage);
    process.exit(0);
  }
  if (args.length !== 1) {
    process.stderr.write(usage);
    process.exit(2);
  }
  let tracks;
  try {
    tracks = parseTracks(fs.readFileSync(args[0], "utf8"));
  } catch (error) {
    process.stderr.write(`render-paths: cannot use ${args[0]}: ${error.message}\n`);
    process.exit(2);
  }
  const gaps = renderPathGaps(tracks);
  for (const { entity, tick, flatOnly, modelOnly } of gaps) {
    if (modelOnly.length > 0) console.log(`${entity} at tick ${tick}: drawn in 3D but not 2D at ${modelOnly.join(", ")}`);
    if (flatOnly.length > 0) console.log(`${entity} at tick ${tick}: drawn in 2D but not 3D at ${flatOnly.join(", ")}`);
  }
  console.log(`render-paths: ${gaps.length} gap(s) in ${tracks.length} track(s)`);
  process.exit(gaps.length === 0 ? 0 : 1);
}
