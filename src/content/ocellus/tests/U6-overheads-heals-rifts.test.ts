import type { DrillSelection } from "../js/OcellusTimings";
import { startDrill } from "./drill";

const TRANSITIONS = { focus: "transition-attacks", specialSelection: "replay-v2" } as const;

describe("U6 boss overheads, heals and rifts", () => {
  test.each([
    ["slash", 10, "melee", "blocked", 0],
    ["range", 10, "ranged", "passed", 20],
    ["slash", 32, "melee", "blocked", 0],
    ["slash", 33, "melee", "passed", 20],
    ["range", 34, "ranged", "passed", 20],
    ["range", 40, "ranged", "blocked", 0],
    ["slash", 40, "melee", "passed", 20],
  ] as const)("Deflect follows the overhead track, not the floor: a %s hit landing at %i", (attackStyle, at, style, outcome, taken) => {
    const drill = startDrill({ selection: TRANSITIONS });
    drill.tickTo(at - 1);
    drill.hit(drill.player(), drill.boss(), 20, attackStyle);
    drill.tickTo(at);
    const { atBossStep, atPostTick } = drill.row(at).bossHp;
    expect([drill.events("player-hit-judged").map((e) => [e.at, e.style, e.outcome, e.requested]), atBossStep - atPostTick]).toEqual([[[at, style, outcome, 20]], taken]);
    drill.dispose();
  });

  test.each([
    [{}, "blocked"],
    [{ deflect: "block-at-launch" }, "passed"],
    [{ deflect: "none" }, "passed"],
  ] as const)("a ranged hit launched under Soul Split that lands in Deflect Range: %j", (selection: DrillSelection, outcome) => {
    const drill = startDrill({ selection: { ...TRANSITIONS, ...selection } });
    drill.tickTo(37);
    drill.hit(drill.player(), drill.boss(), 20, "range", 2);
    drill.tickTo(39);
    expect(drill.events("player-hit-judged").map((e) => [e.at, e.outcome])).toEqual([[39, outcome]]);
    drill.dispose();
  });

  test("Soul Split heals the boss two ticks after each unprotected transition hit, by the damage that hit applied", () => {
    const drill = startDrill({ selection: TRANSITIONS });
    drill.tickTo(68);
    expect(drill.events("boss-healed").map((e) => [e.at, e.cause, e.receipt])).toEqual([
      [39, { kind: "soul-split", ordinal: 0 }, { requested: 49, applied: 49, beforeHp: 1355, afterHp: 1404 }],
      [67, { kind: "soul-split", ordinal: 1 }, { requested: 47, applied: 47, beforeHp: 1404, afterHp: 1451 }],
    ]);
    drill.dispose();
  });

  test("the Soul Split and unclaimed-orb heals coexist, and a protected transition hit heals nothing", () => {
    const drill = startDrill({ selection: { focus: "boss-heals", specialSelection: "replay-v2" } });
    drill.tickTo(13);
    drill.walkTo({ x: 3, y: 2 });
    drill.tickTo(63);
    drill.pray("Protect from Range");
    drill.tickTo(68);
    expect(drill.events("special-hit").map((e) => [e.at, e.style, e.receipt.prayer, e.receipt.applied])).toEqual([[37, "magic", null, 49], [65, "ranged", "ranged", 7]]);
    expect(drill.events("boss-healed").map((e) => [e.at, e.cause, e.receipt])).toEqual([
      [39, { kind: "soul-split", ordinal: 0 }, { requested: 49, applied: 49, beforeHp: 1355, afterHp: 1404 }],
      [62, { kind: "unclaimed-orb" }, { requested: 25, applied: 25, beforeHp: 1404, afterHp: 1429 }],
    ]);
    drill.dispose();
  });

  test("two rifts spawn north of the 5x5 one tick before each inner void from cycle 2, or from cycle 3 under cycle-3", () => {
    const spawned = (selection: DrillSelection) => {
      const drill = startDrill({ selection: { focus: "rifts", ...selection } });
      drill.tickTo(127);
      const observed = drill.events("rift-spawned").map((e) => [e.at, e.rift, e.tile]);
      drill.dispose();
      return observed;
    };
    expect([spawned({}), spawned({ riftFirstCycle: "cycle-3" })]).toEqual([
      [[67, "rift-67-0", { x: 2, y: 2 }], [67, "rift-67-1", { x: 11, y: 2 }], [127, "rift-127-0", { x: 2, y: 2 }], [127, "rift-127-1", { x: 11, y: 2 }]],
      [[127, "rift-127-0", { x: 2, y: 2 }], [127, "rift-127-1", { x: 11, y: 2 }]],
    ]);
  });

  test.each([
    { killLandsAt: 77, destroyed: [[78, "rift-67-1"]], bursts: [[78, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }]] },
    {
      killLandsAt: 78,
      destroyed: [],
      bursts: [
        [78, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }],
        [78, "rift-67-1", { requested: 14, applied: 14, beforeHp: 85, afterHp: 71, prayer: null }],
      ],
    },
  ])("a rift dead by the end of 77 is destroyed at 78 and a standing one bursts for 14: north-east rift killed by a hit landing at $killLandsAt", ({ killLandsAt, destroyed, bursts }) => {
    const drill = startDrill({ selection: { focus: "rifts" } });
    drill.tickTo(killLandsAt - 1);
    const northEast = drill.region.mobs.find((mob) => mob.location.x === 11 && mob.location.y === 2);
    if (!northEast) throw new Error("no rift on (11, 2)");
    drill.hit(drill.player(), northEast, 44);
    drill.tickTo(79);
    expect([drill.events("rift-destroyed").map((e) => [e.at, e.rift]), drill.events("rift-burst").map((e) => [e.at, e.rift, e.receipt])]).toEqual([destroyed, bursts]);
    drill.dispose();
  });

  test("a kill on the Soul Split tick ends the run before the boss heals", () => {
    const drill = startDrill({ selection: TRANSITIONS });
    drill.tickTo(38);
    drill.hit(drill.player(), drill.boss(), 1355);
    drill.tickTo(40);
    expect([drill.events("boss-healed"), drill.events("run-ended").map((e) => [e.at, e.reason])]).toEqual([[], [[39, "kill"]]]);
    drill.dispose();
  });
});
