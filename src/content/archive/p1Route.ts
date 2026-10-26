import type { Seed, Tick, Tile } from "../../sim/brands";
import { tick, tile } from "../../sim/brands";
import type { Corner, CornerTurn } from "../ocellus/js/P1Types";
import type { Side } from "../../sim/tiles";
import { sameTile } from "./layout";
import { P1_ROUTE } from "./roomFacts";
import { ARCHIVE } from "./timings";

/**
 * The drill's phase 1 rolls, copied so this room does not import the fight module.
 * Stream numbers match that mix, so one seed picks the same corner, element and hit.
 */
const P1_STREAM = {
  cornerRoute: 101,
  volleyElement: 102,
  p1VolleyDamage: 103,
  beatSide: 105,
  taunt: 106,
  blastDamage: 107,
  blockDamage: 108,
  strikeDamage: 109,
} as const;

type P1Stream = keyof typeof P1_STREAM;

export function p1Roll(seed: Seed, stream: P1Stream, at: Tick, draw: number): number {
  let mixed = (seed ^ Math.imul(P1_STREAM[stream], 0x9e3779b9) ^ Math.imul(at, 0x85ebca6b) ^ Math.imul(draw, 0xc2b2ae35)) >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x21f0aaad);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x735a2d97);
  mixed ^= mixed >>> 15;
  return (mixed >>> 0) / 2 ** 32;
}

export function p1RollInt(seed: Seed, stream: P1Stream, at: Tick, range: Readonly<{ min: number; max: number }>, draw: number): number {
  return range.min + Math.floor(p1Roll(seed, stream, at, draw) * (range.max - range.min + 1));
}

const CORNERS: readonly Corner[] = ["north-east", "south-east", "south-west", "north-west"];
const TURNS: Readonly<Record<CornerTurn, number>> = { clockwise: 1, across: 2, anticlockwise: 3 };
const CLOCKWISE: readonly Side[] = ["east", "south", "west", "north"];

function cornerAfter(from: Corner, turn: CornerTurn): Corner {
  const index = CORNERS.indexOf(from);
  const next = CORNERS[(index + TURNS[turn]) % CORNERS.length];
  return next ?? from;
}

/** The first corner is an even pick. Each later one is weighted by the turn from the corner he is at. */
export function cornerOfLeg(seed: Seed, leg: number, from: Corner | null): Corner {
  const draw = p1Roll(seed, "cornerRoute", tick(0), leg);
  if (from === null) return CORNERS[Math.floor(draw * CORNERS.length)] ?? CORNERS[0];
  const weights = P1_ROUTE.weights;
  const total = weights.anticlockwise + weights.clockwise + weights.across;
  const pick = draw * total;
  if (pick < weights.anticlockwise) return cornerAfter(from, "anticlockwise");
  if (pick < weights.anticlockwise + weights.clockwise) return cornerAfter(from, "clockwise");
  return cornerAfter(from, "across");
}

/** The middle's first beat faces a seeded side, and each later beat the next side clockwise. */
export function beatSide(seed: Seed, middleStart: Tick, nth: number): Side {
  const first = Math.floor(p1Roll(seed, "beatSide", middleStart, 0) * CLOCKWISE.length);
  return CLOCKWISE[(first + nth) % CLOCKWISE.length] ?? CLOCKWISE[0];
}

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** Tiles between a tile and the nearest tile of his 3×3. The body hangs toward lower Y. 0 means he is standing on it. */
export function distanceToBody(anchor: Tile, at: Tile): number {
  const size = ARCHIVE.p1.bossSize;
  const across = Math.max(anchor.x - at.x, 0, at.x - (anchor.x + size - 1));
  const along = Math.max(anchor.y - size + 1 - at.y, 0, at.y - anchor.y);
  return Math.max(across, along);
}

/** One step: straight along the longer axis until both offsets are equal, then diagonally. */
export function stepToward(from: Tile, to: Tile): Tile {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return tile(from.x + sign(dx), from.y + 0);
  if (Math.abs(dy) > Math.abs(dx)) return tile(from.x + 0, from.y + sign(dy));
  return tile(from.x + sign(dx), from.y + sign(dy));
}

export function stepsBetween(from: Tile, to: Tile): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

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

function anchor(at: Readonly<{ x: number; y: number }>): Tile {
  return tile(at.x, at.y);
}

export const P1_START = shifted(anchor(P1_ROUTE.start));
export const P1_MIDDLE = shifted(anchor(P1_ROUTE.middle));

export function p1CornerTile(corner: Corner): Tile {
  return shifted(anchor(P1_ROUTE.corners[corner]));
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
  const spec = P1_ROUTE.beats.cracks[side][nth];
  const length = P1_ROUTE.beats.length;
  const from = tile(anchor.x + spec.dx, anchor.y + spec.dy);
  const tiles: Tile[] = [];
  for (let step = 0; step < length; step += 1) {
    const at = tile(from.x + spec.run.dx * step, from.y + spec.run.dy * step);
    if (at.x < 0 || at.y < 0 || at.x >= ROOM || at.y >= ROOM) break;
    tiles.push(at);
  }
  return tiles;
}
