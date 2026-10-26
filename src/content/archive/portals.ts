import type { Tile } from "../../sim/brands";
import { tile } from "../../sim/brands";
import { OCELLUS_P2 } from "../ocellus/js/OcellusTimings";
import { CENTRE, OCELLUS_ORIGIN, band, quadrantArms } from "./layout";
import type { EwArm, NsArm, Quadrant } from "./layout";

/**
 * The 24 phase 2 portals. Upstream #79: six 2×1 locs on each arm, up at tick 2.
 * The gap is loc 62684, model 62758. A lit portal is loc 62685, model 62757.
 * Both loop animation 14830. Austin calls those two looks orange and purple, and the render digest
 * records only those two object ids. A lit portal's band is the damaging colour. The gap is the one to stand in.
 *
 * The sequence colour is a different thing. kjc623's ocellus-portals names the three fixed orders
 * orange, red and green, and they run orange → red → green clockwise. The offsets below are that
 * plugin's (columnsOut, rowsOut) from the quadrant's inner corner, where 0 touches the centre strip.
 * They are not a third portal graphic.
 */

export type PortalArm = NsArm | EwArm;
export type PortalLook = "orange" | "purple";
export const PORTAL_COLOURS = ["orange", "red", "green"] as const;
export type PortalColour = (typeof PORTAL_COLOURS)[number];

/** One marked tile of the live 2×2, from kjc623 PortalSequences.Colour. Wave 0 is the first of the six. */
const COLOUR_OFFSETS: Readonly<Record<PortalColour, readonly (readonly [number, number])[]>> = {
  orange: [[1, 0], [1, 4], [6, 0], [2, 0], [4, 2], [2, 6]],
  red: [[4, 3], [6, 2], [8, 0], [3, 3], [7, 3], [6, 4]],
  green: [[0, 0], [5, 0], [9, 0], [5, 4], [3, 2], [0, 4]],
};

/**
 * Letter names for the same three orders. luuj's PORTAL_SEQUENCES calls them A, B and C.
 * The reference swaps A and C, so the sim says both.
 */
const SEQUENCE_LETTERS: Readonly<Record<PortalColour, Readonly<{ luuj: "A" | "B" | "C"; reference: "A" | "B" | "C" }>>> = {
  orange: { luuj: "A", reference: "C" },
  red: { luuj: "B", reference: "B" },
  green: { luuj: "C", reference: "A" },
};

/** Region-local inner corner and the outward step. kjc623 PortalSequences.Quadrant. */
const INNER_CORNER: Readonly<Record<Quadrant, Readonly<{ x: number; y: number; dx: -1 | 1; dy: -1 | 1 }>>> = {
  NW: { x: 29, y: 44, dx: -1, dy: 1 },
  NE: { x: 33, y: 44, dx: 1, dy: 1 },
  SW: { x: 29, y: 38, dx: -1, dy: -1 },
  SE: { x: 33, y: 38, dx: 1, dy: -1 },
};

function cycleAt<T>(rows: readonly T[], index: number): T {
  const count = rows.length;
  const value = rows[((index % count) + count) % count];
  if (value === undefined) throw new Error("empty portal cycle");
  return value;
}

export function nextColour(colour: PortalColour, steps: number): PortalColour {
  switch (colour) {
    case "orange":
      return cycleAt(PORTAL_COLOURS, steps);
    case "red":
      return cycleAt(PORTAL_COLOURS, 1 + steps);
    case "green":
      return cycleAt(PORTAL_COLOURS, 2 + steps);
    default: {
      const unhandled: never = colour;
      return unhandled;
    }
  }
}

/** Portal numbers, 1..6, whose bands contain this wave's marked tile. [north-south, east-west]. */
export function gapsFor(colour: PortalColour, wave: number): readonly [number, number] {
  const offset = COLOUR_OFFSETS[colour][wave];
  if (offset === undefined) throw new Error(`portal wave ${wave} is not one of the six`);
  const [columnsOut, rowsOut] = offset;
  return [2 + Math.floor(rowsOut / 2), 1 + Math.ceil(columnsOut / 2)];
}

/** The sequence's marked tile, in this room's local coordinates. */
export function markedSafeTile(colour: PortalColour, wave: number, quadrant: Quadrant): Tile {
  const offset = COLOUR_OFFSETS[colour][wave];
  if (offset === undefined) throw new Error(`portal wave ${wave} is not one of the six`);
  const corner = INNER_CORNER[quadrant];
  const [columnsOut, rowsOut] = offset;
  return tile(corner.x + columnsOut * corner.dx - OCELLUS_ORIGIN.x, corner.y + rowsOut * corner.dy - OCELLUS_ORIGIN.y);
}

/** Both disputed letter names, plus the colour the cycle actually uses. */
export function volleyLabel(colour: PortalColour): string {
  const letters = SEQUENCE_LETTERS[colour];
  return `${colour} · luuj ${letters.luuj} · reference ${letters.reference}`;
}

const PER_ARM = OCELLUS_P2.portals.perArm.value;
const ROTATION = OCELLUS_P2.portals.rotation.value;
const LOOKS = OCELLUS_P2.portals.looks.value;

export const PORTAL_ARMS: readonly PortalArm[] = ["north", "east", "south", "west"];
export const PORTAL_COUNT = PER_ARM;
export const PORTAL_IDLE = LOOKS.inactive.idle;
export const PORTAL_ORANGE = LOOKS.inactive.model;
export const PORTAL_PURPLE = LOOKS.lit.model;

export type PortalPlace = Readonly<{ arm: PortalArm; index: number; tiles: readonly [Tile, Tile]; yaw: number }>;

/** The two tiles of portal `index` (0 is nearest the middle) on one arm. */
export function portalTiles(arm: PortalArm, index: number): readonly [Tile, Tile] {
  const [low, high] = band(arm, index + 1);
  switch (arm) {
    case "north":
    case "south":
      return [tile(CENTRE, low), tile(CENTRE, high)];
    case "east":
    case "west":
      return [tile(low, CENTRE), tile(high, CENTRE)];
    default: {
      const unhandled: never = arm;
      return unhandled;
    }
  }
}

/** Loc rotation, as the quarter turn the portal model uses. Rotation 0 already lies along x. */
export function portalYaw(arm: PortalArm): number {
  return (-(ROTATION[arm] + 1) * Math.PI) / 2;
}

export function portalPlaces(): readonly PortalPlace[] {
  return PORTAL_ARMS.flatMap((arm) =>
    Array.from({ length: PER_ARM }, (_, index): PortalPlace => ({ arm, index, tiles: portalTiles(arm, index), yaw: portalYaw(arm) })),
  );
}

/** Purple when this portal is on a round's lit arm and it is not that arm's orange gap. */
export function portalLook(arm: PortalArm, index: number, quadrant: Quadrant, nsGap: number, ewGap: number): PortalLook {
  const arms = quadrantArms(quadrant);
  const k = index + 1;
  if (arm === arms.ns) return k === nsGap ? "orange" : "purple";
  if (arm === arms.ew) return k === ewGap ? "orange" : "purple";
  return "orange";
}
