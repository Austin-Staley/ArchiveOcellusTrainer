import type { DrillSelection } from "../js/OcellusTimings";
import type { At } from "./drill";
import { startDrill } from "./drill";

const HOLES_DRILL = { focus: "floor-holes" } as const;
const HOLE: At = { x: 8, y: 5 };
const BESIDE_HOLE: At = { x: 8, y: 4 };

function holeHitsStandingOn(at: At, selection: DrillSelection = {}, until = 8) {
  const drill = startDrill({ selection: { ...HOLES_DRILL, ...selection } });
  drill.walkTo(at);
  drill.tickTo(until);
  const hits = drill.events("hole-hit").map((e) => [e.at, e.tile, e.receipt.applied, e.receipt.afterHp]);
  drill.dispose();
  return hits;
}

describe("U8 floor holes", () => {
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
});
