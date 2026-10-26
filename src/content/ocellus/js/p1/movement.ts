import type { Tile } from "../../../../sim/brands";
import { OCELLUS_P1 } from "../OcellusTimingsP1";
import type { Corner, P1Beat, P1Phase } from "../P1Types";
import { CORNERS, sameTile, stepToward } from "./arena";

const { room } = OCELLUS_P1;

/**
 * South-west anchors on every straight-then-diagonal path between his start, his four corners and the middle.
 * Fights 3 to 5 log that path. The 32 phase 1 captures put his mode and his four corner clusters on those same stops.
 */
let cached: readonly Tile[] | null = null;

export function walkableAnchors(): readonly Tile[] {
  if (cached !== null) return cached;
  const stops = [room.start.value, room.middle.value, ...CORNERS.map((corner) => room.corners.value[corner])];
  const into = new Map<string, Tile>();
  stops.forEach((from) => {
    stops.forEach((to) => trace(from, to, into));
  });
  cached = [...into.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  return cached;
}

export function walkableHas(at: Tile): boolean {
  return walkableAnchors().some((anchor) => sameTile(anchor, at));
}

function trace(from: Tile, to: Tile, into: Map<string, Tile>): void {
  let at = from;
  into.set(key(at), at);
  for (let guard = 0; !sameTile(at, to) && guard < 64; guard += 1) {
    at = stepToward(at, to);
    into.set(key(at), at);
  }
}

function key(at: Tile): string {
  return `${at.x},${at.y}`;
}

/**
 * He steps on a walk stage. A middle or an end teleports him on the teleport-in beat and holds every other tick of that stage.
 * Arrive and a corner are stationary. Logs L1 to L8: the walk is one tile a tick, and the teleport in is at M + 4 in 15 of 15.
 */
export function mobilityOf(phase: P1Phase, beats: readonly P1Beat[]): "stationary" | "mobile" {
  const stage = phase.stage;
  switch (stage) {
    case "walk-from-start":
    case "walk-from-corner":
    case "walk-from-middle":
      return "mobile";
    case "arrive":
    case "corner":
      return "stationary";
    case "middle":
    case "transform":
      return beats.some((beat) => beat.kind === "teleport-in") ? "mobile" : "stationary";
    default: {
      const unhandled: never = stage;
      return unhandled;
    }
  }
}

/** A step lands only on the path, and only while he is mobile. Otherwise he keeps the tile he is on. */
export function keptAnchor(current: Tile, next: Tile, mobility: "stationary" | "mobile"): Tile {
  if (!walkableHas(next)) return current;
  if (mobility === "stationary" && !sameTile(current, next)) return current;
  return next;
}

export function cornerStop(corner: Corner): Tile {
  return room.corners.value[corner];
}
