#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const usage = `usage: observable-states.mjs RUN.json

RUN.json holds a contract and a run's observations:
  { "contract": { "hidden": { "visible": false, "targetable": false }, ... },
    "observations": [{ "tick": 0, "state": "hidden", "observed": { "visible": false, "targetable": false } }, ...] }
The contract names what a player observes in each logged state. Every
observation must match its state's row, and every contracted state must be
reached by the run, so no state is claimed without being observed. Exits 0
when both hold, 1 on a mismatch or an unreached state, and 2 when RUN.json is
unreadable, malformed or has no observations.
`;

/**
 * @typedef {Readonly<Record<string, boolean>>} Observed
 * @typedef {Readonly<{ tick: number; state: string; observed: Observed }>} Observation
 * @typedef {Readonly<{ tick: number; state: string; expected: Observed | null; observed: Observed }>} Mismatch
 */

/**
 * @param {Readonly<Record<string, Observed>>} contract
 * @param {readonly Observation[]} observations
 * @returns {{ mismatches: Mismatch[]; unreached: string[] }}
 */
export function stateContractBreaks(contract, observations) {
  const mismatches = observations.flatMap(({ tick, state, observed }) => {
    const expected = Object.hasOwn(contract, state) ? contract[state] : null;
    const matches = expected !== null && Object.keys(expected).every((key) => observed[key] === expected[key]);
    return matches ? [] : [{ tick, state, expected, observed }];
  });
  const reached = new Set(observations.map(({ state }) => state));
  return { mismatches, unreached: Object.keys(contract).filter((state) => !reached.has(state)) };
}

function booleans(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((field) => typeof field === "boolean");
}

function parseRun(text) {
  const run = JSON.parse(text);
  const contract = run?.contract;
  if (contract === null || typeof contract !== "object" || Array.isArray(contract) || Object.keys(contract).length === 0 || !Object.values(contract).every(booleans)) {
    throw new Error("contract must map each state to an object of booleans");
  }
  if (!Array.isArray(run.observations) || run.observations.length === 0) throw new Error("observations must be a non-empty array");
  for (const [index, observation] of run.observations.entries()) {
    if (!Number.isInteger(observation?.tick) || typeof observation.state !== "string" || !booleans(observation.observed)) {
      throw new Error(`observation ${index} needs an integer tick, a state and an object of booleans`);
    }
  }
  return run;
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
  let run;
  try {
    run = parseRun(fs.readFileSync(args[0], "utf8"));
  } catch (error) {
    process.stderr.write(`observable-states: cannot use ${args[0]}: ${error.message}\n`);
    process.exit(2);
  }
  const { mismatches, unreached } = stateContractBreaks(run.contract, run.observations);
  for (const { tick, state, expected, observed } of mismatches) {
    console.log(`tick ${tick} ${state}: observed ${JSON.stringify(observed)}, contract ${expected === null ? "has no row" : JSON.stringify(expected)}`);
  }
  for (const state of unreached) console.log(`${state}: contracted but never reached, so nothing observes it`);
  console.log(`observable-states: ${mismatches.length} mismatch(es), ${unreached.length} unreached state(s) over ${run.observations.length} observation(s)`);
  process.exit(mismatches.length === 0 && unreached.length === 0 ? 0 : 1);
}
