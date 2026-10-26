import type { Tile } from "../../sim/brands";
import { tile } from "../../sim/brands";
import type { Corner } from "../ocellus/js/P1Types";
import { OCELLUS_P1 } from "../ocellus/js/OcellusTimings";
import type { Side } from "../../sim/tiles";
import { distanceToBody } from "../ocellus/js/p1/arena";
import { sameTile } from "./layout";
import { ARCHIVE } from "./timings";

/**
 * Drill south-west anchors, shifted onto this room.
 * (−9, +3) sends the drill middle (14, 14) to the capture mode (5, 17)
 * and the four corners to the clusters (−1, 23), (11, 23), (11, 11) and (−1, 11).
 * Logs L3 to L5 walk that path. The 32 phase 1 segments put the clusters on those stops.
 */
export const P1_SHIFT = { x: -9, y: 3 } as const;

function shifted(at: Tile): Tile {
  return tile(at.x + P1_SHIFT.x, at.y + P1_SHIFT.y);
}

export const P1_START = shifted(OCELLUS_P1.room.start.value);
export const P1_MIDDLE = shifted(OCELLUS_P1.room.middle.value);

export function p1CornerTile(corner: Corner): Tile {
  const named = OCELLUS_P1.room.corners.value[corner];
  return shifted(named);
}

/** Chebyshev steps. A walk of n steps arrives on its tick n − 1, matching the logged one-tile-a-tick path. */
export function tileGap(from: Tile, to: Tile): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

/**
 * Ticks a walk stage lasts, including the charge delay after he arrives.
 * On an arrival that lands on a volley tick he charges 6 later. Otherwise the end pose is one tick and he charges on the next.
 * Logs L1 to L8: 6 after 19 end-with-volley poses and 1 after 13.
 */
export function walkSpan(steps: number): number {
  const every = ARCHIVE.p1.volleyInterval;
  const chargeAfter = ARCHIVE.p1.chargeAfterArrival;
  const endPose = ARCHIVE.p1.walkEndPose;
  if (steps <= 0) return endPose;
  const arrival = steps - 1;
  for (let at = 0; at < 64; at += every) {
    if (at < arrival) continue;
    if (at === arrival) return arrival + chargeAfter;
    return at + endPose;
  }
  throw new RangeError(`walk of ${steps} steps did not resolve`);
}

export function isVolleyElapsed(elapsed: number, steps: number): boolean {
  if (steps <= 0 || elapsed < 0 || elapsed % ARCHIVE.p1.volleyInterval !== 0) return false;
  return elapsed <= steps - 1;
}

/**
 * The tick the countdown draws "4".
 * Departure is the deadline minus the travel, and the four digits occupy the four ticks before that departure.
 * A non-positive speed cannot be a run or a walk, so the countdown falls back to the four ticks before the deadline.
 */
export function countdownStart(deadline: number, distance: number, tilesPerTick: number): number {
  const lead = ARCHIVE.p1.countdownLead;
  if (!Number.isInteger(tilesPerTick) || tilesPerTick <= 0) return deadline - lead;
  const travel = Math.ceil(Math.max(0, distance) / tilesPerTick);
  return deadline - travel - lead;
}

export function moveTiles(running: boolean): number {
  return running ? ARCHIVE.p1.runTiles : ARCHIVE.p1.walkTiles;
}

export const STAND_COLOUR = "#2ee6c7";
export const OUTLINE_COLOUR = "#ff2a2a";

export function closestTile(from: Tile, tiles: readonly Tile[]): Tile {
  const first = tiles[0];
  if (first === undefined) throw new Error("a vine cycle has no tile");
  return tiles.reduce((best, at) => (tileGap(from, at) < tileGap(from, best) ? at : best), first);
}

/** The nearest tile outside the blast. The player's own tile when they are already outside it. */
export function safeTile(from: Tile, origin: Tile, radius: number, width: number, height: number): Tile {
  if (distanceToBody(origin, from) > radius) return from;
  const limit = width + height;
  for (let ring = 1; ring <= limit; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const at = tile(from.x + dx, from.y + dy);
        if (at.x < 0 || at.y < 0 || at.x >= width || at.y >= height) continue;
        if (distanceToBody(origin, at) > radius) return at;
      }
    }
  }
  return from;
}

/** Where a player stands relative to one vine and the blast around his 3×3. Beside a vine, and outside the blast, is not its own hit. */
export type VinePlace = "on-vine" | "beside-vine" | "blast" | "safe";

export function vinePlace(at: Tile, vine: readonly Tile[], origin: Tile, radius: number): VinePlace {
  if (vine.some((spot) => sameTile(spot, at))) return "on-vine";
  if (distanceToBody(origin, at) <= radius) return "blast";
  const beside = vine.some((spot) => tileGap(at, spot) === 1);
  return beside ? "beside-vine" : "safe";
}

const ROOM = 25;

/** A middle beat's six-tile diagonal, from the logged offsets off his south-west anchor. */
export function beatTiles(anchor: Tile, side: Side, nth: 0 | 1): readonly Tile[] {
  const spec = OCELLUS_P1.middle.beats.value.cracks[side][nth];
  const length = OCELLUS_P1.middle.beats.value.length;
  const from = tile(anchor.x + spec.dx, anchor.y + spec.dy);
  const tiles: Tile[] = [];
  for (let step = 0; step < length; step += 1) {
    const at = tile(from.x + spec.run.dx * step, from.y + spec.run.dy * step);
    if (at.x < 0 || at.y < 0 || at.x >= ROOM || at.y >= ROOM) break;
    tiles.push(at);
  }
  return tiles;
}
