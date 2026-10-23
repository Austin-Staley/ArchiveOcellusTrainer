import type { At } from "./drill";
import { RING_NORTH, SPAWN_ON_FLOOD, UNDER_BOSS, startDrill } from "./drill";

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

  test("a walk onto the boss ordered the tick before the outer void reroutes to the nearest tile beside him", () => {
    const drill = startDrill({ selection: QUIET });
    drill.tickTo(38);
    drill.walkTo(UNDER_BOSS);
    drill.tickTo(44);
    const walked = drill.rows().filter((row) => row.tick >= 38).map((row) => [row.tick, row.phase.stage, row.playerAtPostTick.tile, row.playerAtPostTick.hp]);
    drill.dispose();
    expect(walked).toEqual([
      [38, "after-inner", SPAWN_ON_FLOOD, 99],
      [39, "outer-void", RING_NORTH, 99],
      [40, "outer-void", RING_NORTH, 99],
      [41, "outer-void", RING_NORTH, 99],
      [42, "outer-void", RING_NORTH, 99],
      [43, "outer-void", RING_NORTH, 99],
      [44, "outer-void", RING_NORTH, 99],
    ]);
  });

  test("guard, main has no blocking: a player under the boss when the outer void starts walks out before an explosion mark bursts", () => {
    const drill = startDrill({ selection: { focus: "explosions", drillStart: "cycle-start" } });
    drill.playCorrectlyTo(30);
    drill.walkTo(UNDER_BOSS);
    drill.tickTo(47);
    drill.walkTo(RING_NORTH);
    drill.tickTo(49);
    const walked = drill.rows().filter((row) => row.tick >= 38).map((row) => [row.tick, row.phase.stage, row.playerAtPostTick.tile, row.playerAtPostTick.hp]);
    drill.dispose();
    expect(walked).toEqual([
      [38, "after-inner", UNDER_BOSS, 99],
      ...[39, 40, 41, 42, 43, 44, 45, 46, 47].map((tick) => [tick, "outer-void", UNDER_BOSS, 99]),
      [48, "outer-void", RING_NORTH, 99],
      [49, "outer-void", RING_NORTH, 99],
    ]);
  });

  test("a Control-click onto the boss ordered the tick before the outer void walks one tile a tick to the nearest tile beside him", () => {
    const drill = startDrill({ selection: QUIET });
    drill.tickTo(38);
    drill.player().moveTo(UNDER_BOSS.x, UNDER_BOSS.y, "walk");
    drill.tickTo(41);
    const walked = drill.rows().filter((row) => row.tick >= 38).map((row) => [row.tick, row.playerAtPostTick.tile]);
    drill.dispose();
    expect(walked).toEqual([
      [38, SPAWN_ON_FLOOD],
      [39, { x: 5, y: 2 }],
      [40, RING_NORTH],
      [41, RING_NORTH],
    ]);
  });

  test("in the outer void a Control-click walks around the boss one tile a tick", () => {
    const around = startDrill({ selection: QUIET });
    around.tickTo(36);
    around.walkTo(WEST_OF_BOSS);
    around.tickTo(40);
    around.player().moveTo(EAST_OF_BOSS.x, EAST_OF_BOSS.y, "walk");
    around.tickTo(48);
    const aroundTiles = around.rows().filter((row) => row.tick >= 40).map((row) => row.playerAtPostTick.tile);
    around.dispose();
    expect(aroundTiles).toEqual([WEST_OF_BOSS, { x: 3, y: 6 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 7, y: 6 }, EAST_OF_BOSS]);
  });

  test("guard, main has no blocking: in the outer void a Control-click walks out from under the boss one tile a tick", () => {
    const out = startDrill({ selection: QUIET });
    out.tickTo(30);
    out.walkTo(UNDER_BOSS);
    out.tickTo(40);
    out.player().moveTo(RING_NORTH.x, RING_NORTH.y, "walk");
    out.tickTo(43);
    const outTiles = out.rows().filter((row) => row.tick >= 40).map((row) => row.playerAtPostTick.tile);
    out.dispose();
    expect(outTiles).toEqual([UNDER_BOSS, { x: 5, y: 4 }, RING_NORTH, RING_NORTH]);
  });
});
