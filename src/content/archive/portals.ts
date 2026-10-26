import type { Tile } from "../../sim/brands";
import { tile } from "../../sim/brands";
import { CENTRE, band, quadrantArms } from "./layout";
import { P2_ROOM } from "./roomFacts";
import type { EwArm, NsArm, Quadrant } from "./layout";

/**
 * The 24 phase 2 portals. Upstream #79: six 2×1 locs on each arm, up at tick 2.
 * Orange (loc 62684, model 62758) is idle or a gap. Purple (loc 62685, model 62757) is lit to fire.
 * Both loop animation 14830. A lit portal's band is the damaging colour. The orange gap is the one to stand in.
 * Rounds light at 11, 53 and 95, and the lit arms turn with the quadrant.
 */

export type PortalArm = NsArm | EwArm;
export type PortalLook = "orange" | "purple";

const PER_ARM = P2_ROOM.perArm;
const ROTATION = P2_ROOM.rotation;
const LOOKS = P2_ROOM.looks;

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
