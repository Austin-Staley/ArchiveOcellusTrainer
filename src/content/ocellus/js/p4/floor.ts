import type { FloorRule, FloorShape, ResolvedChoices } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import { tile } from "../../../../sim/brands";
import { TileSet } from "../../../../sim/tiles";
import type { Phase, VoidKind } from "../P4Types";

const ARENA_GLYPHS = ["#", ".", "?", "w", "b"] as const;

const { geometry, boss, floor } = OCELLUS_P4;
const anchor = geometry.bossAnchor.value;
const size = boss.size.value;
const ring = (floor.squareSide.value - size) / 2;
if (!Number.isInteger(ring) || ring < 0) throw new RangeError(`a ${floor.squareSide.value}-tile square cannot centre on a ${size}-tile boss`);

// The SDK anchors a unit on its south-west tile and extends it east and north (lower y).
const aroundBoss = (grow: number) => TileSet.area(tile(anchor.x - grow, anchor.y - size + 1 - grow), tile(anchor.x + size - 1 + grow, anchor.y + grow));
export const NEAR_SQUARE = aroundBoss(ring);
export const FOOTPRINT = aroundBoss(0);
export const PLATFORM = TileSet.grid(geometry.platform.value, ARENA_GLYPHS, "#");
export const WALKWAY = TileSet.grid(geometry.platform.value, ARENA_GLYPHS, "w", "b");
export const BRAZIERS = TileSet.grid(geometry.platform.value, ARENA_GLYPHS, "b");

function shaped(shape: FloorShape): TileSet {
  switch (shape) {
    case "near-square":
      return NEAR_SQUARE;
    case "platform-minus-near-square":
      return PLATFORM.minus(NEAR_SQUARE);
    default: {
      const unhandled: never = shape;
      return unhandled;
    }
  }
}

function voidMask<K extends VoidKind>(kind: K): TileSet<K> {
  return shaped(floor.shapes[kind].value).tagged(kind);
}

export const VOID_MASKS: { readonly [K in VoidKind]: TileSet<K> } = {
  "inner-void": voidMask("inner-void"),
  "outer-void": voidMask("outer-void"),
};

export function floorRule(kind: VoidKind, choices: ResolvedChoices): FloorRule {
  switch (kind) {
    case "inner-void":
      return choices.innerVoidFloor.option.value;
    case "outer-void":
      return floor.outerDamage.value;
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
}

export function voidUnder(phase: Phase): VoidKind | null {
  switch (phase.stage) {
    case "inner-void":
    case "outer-void":
      return phase.stage;
    case "lead-in":
    case "after-inner":
    case "after-outer":
      return null;
    default: {
      const unhandled: never = phase;
      return unhandled;
    }
  }
}
