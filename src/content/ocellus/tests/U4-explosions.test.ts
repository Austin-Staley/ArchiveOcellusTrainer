import type { At } from "./drill";
import { FLOOD_NORTH_OF_RING, SPAWN_ON_FLOOD, UNDER_BOSS, startDrill } from "./drill";

const EXPLOSIONS = { focus: "explosions" } as const;
const BESIDE_SPAWN: At = { x: 6, y: 1 };

describe("U4 personal explosions", () => {
  test("the series starts at hit + 2, then a mark every 2 ticks from hit + 5 captures the player's tile, and 16 lands on that tile a tick later", () => {
    const drill = startDrill({ selection: EXPLOSIONS });
    drill.tickTo(46);
    expect(drill.events("explosion-series-started")).toEqual([
      { kind: "explosion-series-started", at: 14, void: "inner-void" },
      { kind: "explosion-series-started", at: 45, void: "outer-void" },
    ]);
    expect(drill.events("explosion-marked").map((e) => [e.at, e.void, e.pulse, e.tile])).toEqual([
      [17, "inner-void", 0, { x: 5, y: 1 }], [19, "inner-void", 1, { x: 5, y: 1 }], [21, "inner-void", 2, { x: 5, y: 1 }],
      [23, "inner-void", 3, { x: 5, y: 1 }], [25, "inner-void", 4, { x: 5, y: 1 }], [27, "inner-void", 5, { x: 5, y: 1 }],
    ]);
    const resolved = drill.events("explosion-resolved");
    expect(resolved[0]).toEqual({
      kind: "explosion-resolved", at: 18, void: "inner-void", pulse: 0, tile: { x: 5, y: 1 }, underBoss: false,
      outcome: { kind: "hit", receipt: { requested: 16, applied: 16, beforeHp: 99, afterHp: 83, prayer: null } },
    });
    expect(resolved.map((e) => [e.at, e.pulse, e.outcome.kind === "hit" ? e.outcome.receipt.afterHp : null])).toEqual([
      [18, 0, 83], [20, 1, 67], [22, 2, 51], [24, 3, 35], [26, 4, 19], [28, 5, 3],
    ]);
    drill.dispose();
  });

  test("a one-tile step during each mark tick leaves every mark behind and counts as a dodge", () => {
    const drill = startDrill({ selection: EXPLOSIONS });
    const steps: readonly (readonly [number, At])[] = [[16, BESIDE_SPAWN], [18, SPAWN_ON_FLOOD], [20, BESIDE_SPAWN], [22, SPAWN_ON_FLOOD], [24, BESIDE_SPAWN], [26, SPAWN_ON_FLOOD]];
    for (const [after, to] of steps) {
      drill.tickTo(after);
      drill.walkTo(to);
    }
    drill.tickTo(29);
    expect(drill.events("explosion-marked").map((e) => [e.at, e.tile])).toEqual([
      [17, { x: 5, y: 1 }], [19, { x: 6, y: 1 }], [21, { x: 5, y: 1 }], [23, { x: 6, y: 1 }], [25, { x: 5, y: 1 }], [27, { x: 6, y: 1 }],
    ]);
    expect(drill.events("explosion-resolved").map((e) => [e.at, e.outcome.kind])).toEqual([
      [18, "dodged"], [20, "dodged"], [22, "dodged"], [24, "dodged"], [26, "dodged"], [28, "dodged"],
    ]);
    expect(drill.row(28).playerAtPostTick.hp).toBe(99);
    drill.dispose();
  });

  test("a step first taken on the impact tick is late: the hit lands on the marked tile", () => {
    const drill = startDrill({ selection: EXPLOSIONS });
    drill.tickTo(17);
    drill.walkTo(BESIDE_SPAWN);
    drill.tickTo(18);
    expect(drill.events("explosion-resolved").map((e) => [e.at, e.outcome.kind, e.tile])).toEqual([[18, "hit", { x: 5, y: 1 }]]);
    expect(drill.row(18).playerAtPostTick.tile).toEqual({ x: 6, y: 1 });
    drill.dispose();
  });

  test("in 2D, the mark's shards close in on the player's tile through the first half of the mark tick, then give way to the glow", () => {
    const drill = startDrill({ selection: EXPLOSIONS });
    drill.tickTo(17);
    const reach = [0.1, 0.25, 0.45, 0.75].map((t) => drill.drawnShardReach(SPAWN_ON_FLOOD, t).map((tiles) => Math.round(tiles * 10) / 10));
    expect(reach).toEqual([Array(7).fill(0.7), Array(7).fill(0.5), Array(7).fill(0.3), []]);
    drill.dispose();
  });

  test("standing under the boss gives no cover: stepping under on a mark tick leaves that mark behind, and the next mark under the boss hits", () => {
    const drill = startDrill({ selection: EXPLOSIONS });
    drill.walkTo(FLOOD_NORTH_OF_RING);
    drill.tickTo(16);
    drill.walkTo(UNDER_BOSS);
    drill.tickTo(20);
    expect(drill.events("explosion-resolved").map((e) => [e.at, e.tile, e.underBoss, e.outcome.kind])).toEqual([
      [18, { x: 5, y: 2 }, false, "avoided"],
      [20, { x: 5, y: 5 }, true, "hit"],
    ]);
    drill.dispose();
  });

  test.each([
    { option: "wiki-six", marks: [15, 17, 19, 21, 23, 25] },
  ] as const)("the $option option sets the count and the first mark, each mark still lands a tick later, and the series still starts at hit + 2", ({ option, marks }) => {
    const drill = startDrill({ selection: { ...EXPLOSIONS, explosions: option } });
    drill.tickTo(30);
    expect([
      drill.events("explosion-series-started").map((e) => e.at),
      drill.events("explosion-marked").map((e) => e.at),
      drill.events("explosion-resolved").map((e) => e.at),
    ]).toEqual([[14], marks, marks.map((at) => at + 1)]);
    drill.dispose();
  });
});
