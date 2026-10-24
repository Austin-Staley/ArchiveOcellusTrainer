import type { OrbFloor, OuterOrbTile, ResolvedChoices } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Seed, Tick, Tile } from "../../../../sim/brands";
import type { VoidKind } from "../P4Types";
import type { TileMask } from "./floor";
import { FOOTPRINT, NEAR_SQUARE, PLATFORM, VOID_MASKS } from "./floor";
import { roll } from "./roll";

const { orbDistance, innerOrbFloor } = OCELLUS_P4.lifeforceOrb;
const RIM = NEAR_SQUARE.minus(FOOTPRINT);

export function reach(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const straightLine = (a: Tile, b: Tile) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function enteredSquare(entered: Tile | null, player: Tile): Tile | null {
  return NEAR_SQUARE.contains(player) ? (entered ?? player) : null;
}

function placement(kind: VoidKind, choices: ResolvedChoices): OuterOrbTile {
  switch (kind) {
    case "inner-void":
      return { kind: "near-player", floor: innerOrbFloor.value };
    case "outer-void":
      return choices.outerOrbTile.option.value;
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
}

function nearPlayer(player: Tile, kind: VoidKind, floor: OrbFloor, holes: TileMask): readonly Tile[] {
  const { min, max } = orbDistance.value;
  const allowed = PLATFORM.tiles().filter(
    (candidate) => !FOOTPRINT.contains(candidate) && !holes.contains(candidate) && !(floor === "safe-floor" && VOID_MASKS[kind].contains(candidate)) && reach(candidate, player) >= min,
  );
  const nearest = Math.min(...allowed.map((candidate) => reach(candidate, player)));
  return allowed.filter((candidate) => reach(candidate, player) <= Math.max(max, nearest));
}

function oppositeEntry(entered: Tile, holes: TileMask): readonly Tile[] {
  const allowed = RIM.tiles().filter((candidate) => !holes.contains(candidate));
  const farthest = Math.max(...allowed.map((candidate) => straightLine(candidate, entered)));
  return allowed.filter((candidate) => straightLine(candidate, entered) === farthest);
}

function allowedTiles(rule: OuterOrbTile, player: Tile, entered: Tile, kind: VoidKind, holes: TileMask): readonly Tile[] {
  switch (rule.kind) {
    case "near-player":
      return nearPlayer(player, kind, rule.floor, holes);
    case "opposite-entry":
      return oppositeEntry(entered, holes);
    default: {
      const unhandled: never = rule;
      return unhandled;
    }
  }
}

export function orbTile(seed: Seed, at: Tick, player: Tile, entered: Tile, kind: VoidKind, choices: ResolvedChoices, holes: TileMask): Tile {
  const candidates = [...allowedTiles(placement(kind, choices), player, entered, kind, holes)].sort((a, b) => a.y - b.y || a.x - b.x);
  if (candidates.length === 0) throw new RangeError(`no ${kind} orb tile is left for a player on ${player.x}, ${player.y}`);
  return candidates[Math.floor(roll(seed, "orbTile", at, 0) * candidates.length)];
}
