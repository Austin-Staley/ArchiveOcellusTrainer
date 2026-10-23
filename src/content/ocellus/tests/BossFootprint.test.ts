import type { At } from "./drill";
import { startDrill } from "./drill";

const QUIET = { focus: "void-floor", drillStart: "cycle-start" } as const;
const WEST_OF_BOSS: At = { x: 3, y: 5 };
const EAST_OF_BOSS: At = { x: 7, y: 5 };
const UNDER_EAST_EDGE: At = { x: 6, y: 5 };

function walkFromWest(orderAt: number, to: At, until: number) {
  const drill = startDrill({ selection: QUIET });
  drill.tickTo(orderAt - 4);
  drill.walkTo(WEST_OF_BOSS);
  drill.tickTo(orderAt);
  drill.walkTo(to);
  drill.tickTo(until);
  const walked = drill.rows().filter((row) => row.tick >= orderAt).map((row) => [row.tick, row.phase.stage, row.playerAtPostTick.tile]);
  drill.dispose();
  return walked;
}

describe("boss footprint", () => {
  test("the player runs under the landed boss before the outer void, and around his edge once it floods", () => {
    expect([walkFromWest(34, EAST_OF_BOSS, 37), walkFromWest(40, EAST_OF_BOSS, 45)]).toEqual([
      [
        [34, "after-inner", WEST_OF_BOSS],
        [35, "after-inner", { x: 5, y: 5 }],
        [36, "after-inner", EAST_OF_BOSS],
        [37, "after-inner", EAST_OF_BOSS],
      ],
      [
        [40, "outer-void", WEST_OF_BOSS],
        [41, "outer-void", { x: 3, y: 7 }],
        [42, "outer-void", { x: 5, y: 7 }],
        [43, "outer-void", { x: 7, y: 7 }],
        [44, "outer-void", EAST_OF_BOSS],
        [45, "outer-void", EAST_OF_BOSS],
      ],
    ]);
  });

  test("in the outer void a walk onto a tile under the boss stops on the nearest tile beside him", () => {
    expect(walkFromWest(40, UNDER_EAST_EDGE, 45).map(([, , at]) => at)).toEqual([WEST_OF_BOSS, { x: 3, y: 7 }, { x: 5, y: 7 }, { x: 7, y: 7 }, EAST_OF_BOSS, EAST_OF_BOSS]);
  });
});
