import type { DrillSelection } from "../js/OcellusTimings";
import type { At } from "./drill";
import { RING_NORTH, startDrill } from "./drill";

const ORB_DRILL = { focus: "lifeforce-orb" } as const;
const INNER_ORB: At = { x: 9, y: 4 };
const BESIDE_INNER_ORB: At = { x: 9, y: 3 };
const OUTER_ORB_FROM_SPAWN: At = { x: 4, y: 3 };
const NEAR_PLAYER_OUTER_ORB = { outerOrbTile: "safe-floor" } as const;
const ANY_FLOOR_SEED = 31;
const ANY_FLOOR_INNER_ORB: At = { x: 10, y: 2 };
const OUTER_ORB_ON_FLOOD: At = { x: 1, y: 2 };
const V1_TURN = { floorHoleLayout: "v1-turn" } as const;

function returnsAfterWalkingAt(orderedAfter: number, selection: DrillSelection = {}) {
  const drill = startDrill({ selection: { ...ORB_DRILL, ...selection } });
  drill.tickTo(orderedAfter);
  drill.walkTo(INNER_ORB);
  drill.tickTo(36);
  const observed = [drill.events("orb-returned").map((e) => e.at), drill.events("orb-expired").map((e) => e.at)];
  drill.dispose();
  return observed;
}

describe("U3 lifeforce hit and orb", () => {
  test("the lifeforce hit takes floor(current HP / 2) through any protection prayer", () => {
    const drill = startDrill({ selection: ORB_DRILL });
    drill.tickTo(10);
    drill.pray("Protect from Magic");
    drill.tickTo(40);
    drill.pray("Protect from Melee");
    drill.tickTo(43);
    expect(drill.events("lifeforce-told").map((e) => [e.at, e.void])).toEqual([[11, "inner-void"], [42, "outer-void"]]);
    expect(drill.events("lifeforce-drained").map((e) => [e.at, e.receipt])).toEqual([
      [12, { requested: 49, applied: 49, beforeHp: 99, afterHp: 50, prayer: "magic" }],
      [43, { requested: 25, applied: 25, beforeHp: 50, afterHp: 25, prayer: "melee" }],
    ]);
    drill.dispose();
  });

  test("the inner orb forms on (9, 4) on the hit tick, 12, and returns the stolen HP once, the tick after the player stands on it ready", () => {
    const drill = startDrill({ selection: ORB_DRILL });
    drill.tickTo(12);
    expect(drill.events("orb-spawned").map((e) => [e.at, e.void, e.tile, e.credit])).toEqual([[12, "inner-void", { x: 9, y: 4 }, 49]]);
    drill.walkTo(INNER_ORB);
    drill.tickTo(29);
    expect(drill.row(16).playerAtBossStep.tile).toEqual({ x: 9, y: 4 });
    expect(drill.events("orb-matured").map((e) => [e.at, e.tile])).toEqual([[24, { x: 9, y: 4 }]]);
    expect(drill.events("orb-returned").map((e) => [e.at, e.tile, e.receipt])).toEqual([[25, { x: 9, y: 4 }, { requested: 49, applied: 49, beforeHp: 50, afterHp: 99 }]]);
    expect(drill.row(25).playerAtPostTick.hp).toBe(99);
    drill.dispose();
  });

  test("the inner orb stays 5 ticks after the inner void clears at 30: its last pickup returns at 35, and arriving at the end of 35 is too late", () => {
    expect([returnsAfterWalkingAt(32), returnsAfterWalkingAt(33)]).toEqual([
      [[35], []],
      [[], [35]],
    ]);
  });

  test("the adjacent pickup option returns the orb to a player beside it; the default needs its tile", () => {
    const standBeside = (selection: DrillSelection) => {
      const drill = startDrill({ selection: { ...ORB_DRILL, ...selection } });
      drill.tickTo(13);
      drill.walkTo(BESIDE_INNER_ORB);
      drill.tickTo(36);
      const observed = [drill.events("orb-returned").map((e) => [e.at, e.receipt.afterHp]), drill.events("orb-expired").map((e) => e.at)];
      drill.dispose();
      return observed;
    };
    expect([standBeside({ orbPickupRadius: "adjacent" }), standBeside({})]).toEqual([
      [[[25, 99]], []],
      [[], [35]],
    ]);
  });

  test("the default outer orb forms on the rim tile farthest from where the player stepped into the 5x5, including the first tile of a two-tile run, not from where they stand at the hit, or from the player who never entered", () => {
    const outerOrbAfterEntering = (walks: readonly At[], selection: DrillSelection = {}) => {
      const drill = startDrill({ selection: { ...ORB_DRILL, ...selection } });
      walks.forEach((to, i) => {
        drill.tickTo(34 + 3 * i);
        drill.walkTo(to);
      });
      drill.tickTo(43);
      const observed = drill.events("orb-spawned").filter((e) => e.void === "outer-void").map((e) => e.tile);
      drill.dispose();
      return observed;
    };
    expect([
      outerOrbAfterEntering([{ x: 3, y: 3 }]),
      outerOrbAfterEntering([{ x: 7, y: 3 }]),
      outerOrbAfterEntering([{ x: 3, y: 3 }, { x: 7, y: 3 }]),
      outerOrbAfterEntering([{ x: 3, y: 2 }, { x: 5, y: 4 }]),
      outerOrbAfterEntering([]),
      outerOrbAfterEntering([{ x: 3, y: 3 }], NEAR_PLAYER_OUTER_ORB),
    ]).toEqual([[{ x: 7, y: 7 }], [{ x: 3, y: 7 }], [{ x: 7, y: 7 }], [{ x: 7, y: 7 }], [{ x: 3, y: 7 }], [{ x: 6, y: 3 }]]);
  });

  test("an unclaimed outer orb heals the boss by its credit at hit + 19 (62); an unclaimed inner orb or a collected outer orb does not", () => {
    const run = (selection: DrillSelection, collectOuterOrb = false) => {
      const drill = startDrill({ selection: { ...ORB_DRILL, ...NEAR_PLAYER_OUTER_ORB, ...selection } });
      drill.tickTo(44);
      if (collectOuterOrb) drill.walkTo(OUTER_ORB_FROM_SPAWN);
      drill.tickTo(63);
      const observed = [
        drill.events("orb-expired").map((e) => [e.at, e.void, e.tile, e.credit]),
        drill.events("boss-healed").map((e) => [e.at, e.cause, e.receipt]),
        drill.row(62).bossHp,
      ];
      drill.dispose();
      return observed;
    };
    const expired = [[35, "inner-void", { x: 9, y: 4 }, 49], [61, "outer-void", { x: 4, y: 3 }, 25]];
    expect([run({}), run({ unclaimedOuterOrb: "off" }), run({}, true)]).toEqual([
      [expired, [[62, { kind: "unclaimed-orb" }, { requested: 25, applied: 25, beforeHp: 1355, afterHp: 1380 }]], { atBossStep: 1355, atPostTick: 1380 }],
      [expired, [], { atBossStep: 1355, atPostTick: 1355 }],
      [[expired[0]], [], { atBossStep: 1355, atPostTick: 1355 }],
    ]);
  });

  test("a return can pass max HP: HP regenerates at 199 between the fourth inner hit and its return", () => {
    const drill = startDrill({ selection: { ...ORB_DRILL, drillStart: "cycle-start" } });
    drill.playCorrectlyTo(206);
    expect(drill.events("orb-returned").map((e) => [e.at, e.receipt.requested, e.receipt.beforeHp, e.receipt.afterHp])).toEqual([
      [25, 49, 50, 99], [50, 49, 50, 99], [85, 49, 50, 99], [110, 49, 50, 99], [145, 49, 50, 99], [170, 49, 50, 99], [205, 49, 51, 100],
    ]);
    expect(drill.row(205).playerAtPostTick.hp).toBe(100);
    drill.dispose();
  });

  test("under any-floor the outer orb lands on the flood; a return due on the tick the floor kills the player is skipped", () => {
    const retrieve = (collectInnerOrb: boolean) => {
      const drill = startDrill({ seed: ANY_FLOOR_SEED, selection: { focus: "orb-retrieval", outerOrbTile: "any-floor" } });
      drill.tickTo(13);
      if (collectInnerOrb) drill.walkTo(ANY_FLOOR_INNER_ORB);
      drill.tickTo(30);
      drill.walkTo(RING_NORTH);
      drill.tickTo(45);
      drill.walkTo(OUTER_ORB_ON_FLOOD);
      drill.tickTo(50);
      const observed = {
        outerOrb: drill.events("orb-spawned").filter((e) => e.void === "outer-void").map((e) => [e.at, e.tile, e.credit]),
        floorHits: drill.events("floor-hit").map((e) => [e.at, e.receipt.applied, e.receipt.afterHp]),
        returned: drill.events("orb-returned").filter((e) => e.void === "outer-void").map((e) => [e.at, e.receipt.beforeHp, e.receipt.afterHp]),
        ended: drill.events("run-ended").map((e) => [e.at, e.reason]),
        hpAt50: drill.row(50).playerAtPostTick.hp,
      };
      drill.dispose();
      return observed;
    };
    expect(retrieve(false)).toEqual({
      outerOrb: [[43, { x: 1, y: 2 }, 25]],
      floorHits: [[48, 10, 15], [49, 9, 6], [50, 6, 0]],
      returned: [],
      ended: [[50, "death"]],
      hpAt50: 0,
    });
    expect(retrieve(true)).toEqual({
      outerOrb: [[43, { x: 1, y: 2 }, 49]],
      floorHits: [[48, 10, 40], [49, 9, 31], [50, 10, 21]],
      returned: [[50, 21, 70]],
      ended: [],
      hpAt50: 70,
    });
  });

  test("an orb never forms on a floor hole: seed 5's inner orb from the spawn and seed 2's any-floor outer orb from the ring", () => {
    const orbs = (runSeed: number, selection: DrillSelection, until: number) => {
      const drill = startDrill({ seed: runSeed, selection });
      drill.playCorrectlyTo(until);
      const observed = [drill.region.fightLog().header.choices.floorHoleLayout.key, drill.events("orb-spawned").map((e) => [e.at, e.void, e.tile])];
      drill.dispose();
      return observed;
    };
    expect([orbs(5, V1_TURN, 12), orbs(2, { ...V1_TURN, outerOrbTile: "any-floor" }, 43)]).toEqual([
      ["v1-turn", [[12, "inner-void", { x: 2, y: 5 }]]],
      ["v1-turn", [[12, "inner-void", { x: 2, y: 4 }], [43, "outer-void", { x: 3, y: 8 }]]],
    ]);
  });
});
