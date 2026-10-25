import { tile } from "../../sim/brands";
import type { Tile } from "../../sim/brands";

/** Local tiles. Template minus the room origin. Unverified layouts, wiki and ledger coordinates. */

export const OCELLUS_ORIGIN = { x: 19, y: 29 } as const;
export const CENTRE = 12;

export type Quadrant = "NW" | "NE" | "SE" | "SW";
export type NsArm = "north" | "south";
export type EwArm = "east" | "west";

export function quadrantArms(quadrant: Quadrant): Readonly<{ ns: NsArm; ew: EwArm }> {
  switch (quadrant) {
    case "NW":
      return { ns: "north", ew: "west" };
    case "NE":
      return { ns: "north", ew: "east" };
    case "SE":
      return { ns: "south", ew: "east" };
    case "SW":
      return { ns: "south", ew: "west" };
    default: {
      const unhandled: never = quadrant;
      return unhandled;
    }
  }
}

/** Inclusive local band for orange distance k (1..6). */
export function band(arm: NsArm | EwArm, k: number): readonly [number, number] {
  switch (arm) {
    case "north":
    case "east":
      return [CENTRE + 2 * k - 1, CENTRE + 2 * k];
    case "south":
    case "west":
      return [CENTRE - 2 * k, CENTRE - 2 * k + 1];
    default: {
      const unhandled: never = arm;
      return unhandled;
    }
  }
}

/** A tile is hit when it shares a purple arm. The orange-by-orange 2×2 is the pocket that does not. */
export function beamHits(quadrant: Quadrant, nsK: number, ewK: number, at: Tile): boolean {
  const arms = quadrantArms(quadrant);
  for (let k = 1; k <= 6; k += 1) {
    if (k !== nsK) {
      const [low, high] = band(arms.ns, k);
      if (at.y >= low && at.y <= high) return true;
    }
    if (k !== ewK) {
      const [low, high] = band(arms.ew, k);
      if (at.x >= low && at.x <= high) return true;
    }
  }
  return false;
}

export const WAVE_SKIP: Readonly<Record<Quadrant, Readonly<{ outer: Tile; inner: Tile }>>> = {
  NW: { outer: tile(6, 18), inner: tile(8, 16) },
  NE: { outer: tile(18, 18), inner: tile(16, 16) },
  SE: { outer: tile(18, 6), inner: tile(16, 8) },
  SW: { outer: tile(6, 6), inner: tile(8, 8) },
};

export const P1_CORNERS = [tile(5, 17), tile(17, 17), tile(17, 5), tile(5, 5)] as const;
export const P1_CENTRE = tile(11, 11);

/** Seven cracks stepping toward that corner. Unverified. The line points at him. */
export function cornerTendril(corner: number, index: number): Tile {
  switch (corner % 4) {
    case 0:
      return tile(12 - index, 18);
    case 1:
      return tile(10 + index, 18);
    case 2:
      return tile(18, 12 - index);
    default:
      return tile(12 - index, 6);
  }
}

const CENTRE_PAIRS = [
  [tile(12, 14), tile(12, 16)],
  [tile(14, 12), tile(16, 12)],
  [tile(12, 10), tile(12, 8)],
  [tile(10, 12), tile(8, 12)],
] as const;

/** Clockwise from north: the closer crack, then the one beyond it. */
export function centreTendril(pair: number, which: 0 | 1): Tile {
  const row = CENTRE_PAIRS[pair % CENTRE_PAIRS.length] ?? CENTRE_PAIRS[0];
  return row[which];
}

/** Four vines just outside a 3×3 footprint. */
export function vinesAround(origin: Tile): readonly Tile[] {
  return [tile(origin.x - 1, origin.y - 1), tile(origin.x + 3, origin.y - 1), tile(origin.x - 1, origin.y + 3), tile(origin.x + 3, origin.y + 3)];
}

/** The orange pad in a quadrant, and where it puts you. Unverified tiles inside that quadrant. */
export const PORTAL_PAD: Readonly<Record<Quadrant, Readonly<{ at: Tile; next: Tile }>>> = {
  NW: { at: tile(8, 20), next: tile(16, 16) },
  NE: { at: tile(16, 20), next: tile(16, 8) },
  SE: { at: tile(16, 4), next: tile(8, 8) },
  SW: { at: tile(8, 4), next: tile(8, 16) },
};

/** West, east, south, north hops in local tiles. Unverified; template stones minus (19, 29). */
export const HOPS = {
  west: [tile(2, 12), tile(5, 12), tile(8, 12)],
  east: [tile(16, 12), tile(19, 12), tile(22, 12)],
  south: [tile(12, 2), tile(12, 5), tile(12, 8)],
  north: [tile(12, 16), tile(12, 19), tile(12, 22)],
} as const;

export function quadrantOf(at: Tile): Quadrant | "cross" {
  const west = at.x <= 10;
  const east = at.x >= 14;
  const south = at.y <= 10;
  const north = at.y >= 14;
  if (north && west) return "NW";
  if (north && east) return "NE";
  if (south && west) return "SW";
  if (south && east) return "SE";
  return "cross";
}

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

export function gapTo(at: Tile, origin: Tile, size: number): number {
  const dx = Math.max(origin.x - at.x, 0, at.x - (origin.x + size - 1));
  const dy = Math.max(origin.y - at.y, 0, at.y - (origin.y + size - 1));
  return Math.max(dx, dy);
}

export const BINDER_STOPS = [
  tile(4, 12), tile(8, 10), tile(12, 12), tile(12, 8), tile(12, 4), tile(8, 6), tile(4, 4), tile(4, 8), tile(8, 8),
] as const;

export const MOIA_STATIONS = [tile(0, 7), tile(7, 14), tile(14, 7), tile(7, 0), tile(7, 14)] as const;

export const PILLAR_SHADOWS = [tile(11, 2), tile(11, 15), tile(15, 9)] as const;

export const DAGON_PADS = {
  fire: tile(6, 11),
  earth: tile(7, 10),
  water: tile(6, 9),
  air: tile(5, 10),
} as const;

export const DAGON_TRAIL = [tile(8, 9), tile(9, 9), tile(10, 9), tile(11, 9), tile(11, 8), tile(11, 7)] as const;

export const CENSERS = [tile(1, 22), tile(22, 22), tile(1, 1), tile(22, 1)] as const;

export const ROOMS = {
  bork: { width: 15, height: 17, player: tile(9, 13), boss: tile(10, 12), bossSize: 4, smork: tile(6, 7) },
  ezekiel: { width: 15, height: 15, player: tile(7, 9), boss: tile(8, 8), bossSize: 3 },
  guardian: { width: 28, height: 28, player: tile(13, 9), boss: tile(11, 11), bossSize: 5 },
  moia: { width: 17, height: 17, player: tile(1, 1), boss: tile(0, 7), bossSize: 3 },
  xarth: { width: 17, height: 17, player: tile(11, 2), boss: tile(7, 7), bossSize: 3 },
  dagonhai: { width: 20, height: 19, player: tile(6, 10), boss: tile(2, 9), bossSize: 2 },
  "ocellus-p1": { width: 25, height: 25, player: tile(8, 18), boss: tile(5, 17), bossSize: 3 },
  "ocellus-p2": { width: 25, height: 25, player: tile(8, 16), boss: tile(11, 11), bossSize: 3 },
  "ocellus-p3": { width: 25, height: 25, player: tile(8, 19), boss: tile(5, 18), bossSize: 3 },
} as const;
