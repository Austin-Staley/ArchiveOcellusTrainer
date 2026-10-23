import type { DrillSelection } from "../js/OcellusTimings";
import type { At } from "./drill";
import { startDrill } from "./drill";

const HOLES_DRILL = { focus: "floor-holes" } as const;
const V1_TURN_DRILL = { ...HOLES_DRILL, floorHoleLayout: "v1-turn" } as const;
const CORNER_STACK: readonly At[] = [{ x: 11, y: 1 }, { x: 11, y: 2 }, { x: 11, y: 3 }];
const V1_TURN: readonly At[] = [{ x: 1, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 8 }, { x: 2, y: 9 }, { x: 4, y: 9 }, { x: 8, y: 5 }];
const V1_MIRROR: readonly At[] = [{ x: 5, y: 1 }, { x: 5, y: 8 }, { x: 6, y: 1 }, { x: 8, y: 2 }, { x: 9, y: 2 }, { x: 9, y: 4 }];
const J1_MIRROR: readonly At[] = [{ x: 2, y: 2 }, { x: 2, y: 5 }, { x: 2, y: 6 }, { x: 9, y: 1 }, { x: 9, y: 3 }];
const J1_TURN: readonly At[] = [{ x: 1, y: 9 }, { x: 2, y: 2 }, { x: 3, y: 9 }, { x: 5, y: 2 }, { x: 6, y: 2 }];
const CORNER_HOLE: At = { x: 11, y: 2 };
const HOLE: At = { x: 8, y: 5 };
const BESIDE_HOLE: At = { x: 8, y: 4 };

function layoutOf(runSeed: number, selection: DrillSelection = {}) {
  const drill = startDrill({ seed: runSeed, selection: { ...HOLES_DRILL, ...selection } });
  drill.tickTo(0);
  const observed = [drill.region.fightLog().header.choices.floorHoleLayout.key, drill.drawnHoles()];
  drill.dispose();
  return observed;
}

function holeHitsStandingOn(at: At, selection: DrillSelection = {}, until = 8) {
  const drill = startDrill({ selection: { ...V1_TURN_DRILL, ...selection } });
  drill.walkTo(at);
  drill.tickTo(until);
  const hits = drill.events("hole-hit").map((e) => [e.at, e.tile, e.receipt.applied, e.receipt.afterHp]);
  drill.dispose();
  return hits;
}

describe("U8 floor holes", () => {
  test("every seed stacks three holes in a north-south line in the platform's north-east corner, against the brazier walkway", () => {
    expect([layoutOf(1), layoutOf(11)]).toEqual([
      ["corner-stack", CORNER_STACK],
      ["corner-stack", CORNER_STACK],
    ]);
  });

  test("scattered draws each footage layout by seed, including those on the spawn and a rift tile, and a typed layout replaces the draw", () => {
    const scattered = { floorHoleLayout: "scattered" } as const;
    expect([layoutOf(1, scattered), layoutOf(2, scattered), layoutOf(5, scattered), layoutOf(11, scattered), layoutOf(1, { floorHoleLayout: "v1-turn" })]).toEqual([
      ["j1-mirror", J1_MIRROR],
      ["j1-turn", J1_TURN],
      ["v1-turn", V1_TURN],
      ["v1-mirror", V1_MIRROR],
      ["v1-turn", V1_TURN],
    ]);
  });

  test("a player who starts a tick on a hole takes 9 to 11, and one beside it takes nothing", () => {
    expect([holeHitsStandingOn(HOLE), holeHitsStandingOn(BESIDE_HOLE)]).toEqual([
      [[2, HOLE, 9, 90], [3, HOLE, 11, 79], [4, HOLE, 11, 68], [5, HOLE, 9, 59], [6, HOLE, 9, 50], [7, HOLE, 9, 41], [8, HOLE, 10, 31]],
      [],
    ]);
  });

  test("the harmless option spares a player that the default rule hits", () => {
    expect([holeHitsStandingOn(HOLE, {}, 4), holeHitsStandingOn(HOLE, { floorHoleDamage: "harmless" }, 4)]).toEqual([
      [[2, HOLE, 9, 90], [3, HOLE, 11, 79], [4, HOLE, 11, 68]],
      [],
    ]);
  });

  test("the outer flood hides the holes, and a hole under it still hits", () => {
    const drill = startDrill({ selection: V1_TURN_DRILL });
    drill.tickTo(38);
    const beforeFlood = drill.drawnHoles();
    drill.walkTo(BESIDE_HOLE);
    drill.tickTo(40);
    const underFlood = drill.drawnHoles();
    drill.walkTo(HOLE);
    drill.tickTo(42);
    drill.walkTo(BESIDE_HOLE);
    drill.tickTo(59);
    const afterFlood = drill.drawnHoles();
    const hits = drill.events("hole-hit").map((e) => [e.at, e.tile, e.receipt.applied]);
    drill.dispose();
    expect({ beforeFlood, underFlood, hits, afterFlood }).toEqual({
      beforeFlood: V1_TURN,
      underFlood: [],
      hits: [[42, HOLE, 11], [43, HOLE, 9]],
      afterFlood: V1_TURN,
    });
  });

  test("the holes stay on the same tiles through every cycle", () => {
    const drill = startDrill({ selection: V1_TURN_DRILL });
    drill.walkTo(BESIDE_HOLE);
    const drawn = [20, 80, 140].map((visit) => {
      drill.tickTo(visit - 1);
      drill.walkTo(HOLE);
      drill.tickTo(visit);
      drill.walkTo(BESIDE_HOLE);
      drill.tickTo(visit + 2);
      return drill.drawnHoles();
    });
    const hits = drill.events("hole-hit").map((e) => [e.at, e.tile]);
    drill.dispose();
    expect({ drawn, hits }).toEqual({ drawn: [V1_TURN, V1_TURN, V1_TURN], hits: [[21, HOLE], [81, HOLE], [141, HOLE]] });
  });

  test("only the full fight and the floor-holes drill lay holes", () => {
    const holesIn = (focus: DrillSelection["focus"]) => {
      const drill = startDrill({ selection: { focus } });
      drill.walkTo(CORNER_HOLE);
      drill.tickTo(6);
      const observed = [drill.drawnHoles().length, drill.events("hole-hit").map((e) => e.at)];
      drill.dispose();
      return observed;
    };
    expect([holesIn("full-fight"), holesIn("floor-holes"), holesIn("void-floor"), holesIn("rifts")]).toEqual([
      [3, [3, 4, 5, 6]],
      [3, [3, 4, 5, 6]],
      [0, []],
      [0, []],
    ]);
  });
});
