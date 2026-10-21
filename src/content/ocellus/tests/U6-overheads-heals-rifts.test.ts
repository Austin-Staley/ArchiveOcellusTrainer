import type { DrillSelection } from "../js/OcellusTimings";
import { startDrill } from "./drill";

const TRANSITIONS = { focus: "transition-attacks", specialSelection: "replay-v2" } as const;

type Drill = ReturnType<typeof startDrill>;

function northEastRift(drill: Drill) {
  const rift = drill.region.mobs.find((mob) => mob.location.x === 11 && mob.location.y === 2);
  if (!rift) throw new Error("no rift on (11, 2)");
  return rift;
}

describe("U6 boss overheads, heals and rifts", () => {
  test.each([
    { target: "the size-1 north-east rift once", seed: 2, selection: { focus: "rifts", setup: "melee" }, aggroAt: 68, pick: northEastRift, swingAt: 71, hits: [35], hpAfter: 9 },
    { target: "the size-1 north-east rift once more on its next swing", seed: 2, selection: { focus: "rifts", setup: "melee" }, aggroAt: 68, pick: northEastRift, swingAt: 76, hits: [9], hpAfter: 0 },
    { target: "the size-3 boss three times", seed: 4, selection: { focus: "rifts", setup: "melee", deflect: "none" }, aggroAt: 12, pick: (drill: Drill) => drill.boss(), swingAt: 13, hits: [4, 12, 8], hpAfter: 1331 },
  ] as const)("one scythe swing hits $target", ({ seed, selection, aggroAt, pick, swingAt, hits, hpAfter }) => {
    const drill = startDrill({ seed, selection });
    drill.tickTo(aggroAt);
    const target = pick(drill);
    drill.player().setAggro(target);
    drill.tickTo(swingAt);
    const queued = target.incomingProjectiles.filter((hit) => hit.from === drill.player()).map((hit) => hit.damage);
    drill.tickTo(swingAt + 2);
    expect([queued, target.currentStats.hitpoint]).toEqual([hits, hpAfter]);
    drill.dispose();
  });

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
    {
      killLandsAt: 77,
      destroyed: [[78, "rift-67-1"]],
      bursts: [[78, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }]],
      chat: ["Destroying the void rift empowers you!"],
      northEastRiftSequences: [14896, 14897],
    },
    {
      killLandsAt: 78,
      destroyed: [],
      bursts: [
        [78, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }],
        [78, "rift-67-1", { requested: 14, applied: 14, beforeHp: 85, afterHp: 71, prayer: null }],
      ],
      chat: [],
      northEastRiftSequences: [14896, 14898],
    },
  ])("a rift dead by the end of 77 despawns and is destroyed at 78, and a standing one detonates and bursts for 14: north-east rift killed by a hit landing at $killLandsAt", ({ killLandsAt, destroyed, bursts, chat, northEastRiftSequences }) => {
    const drill = startDrill({ selection: { focus: "rifts" } });
    drill.tickTo(68);
    const northEast = northEastRift(drill);
    const sequences: number[] = [];
    // Stands in for the 3D renderer, which jsdom cannot run.
    northEast.setAnimationListener({ animationChanged: (id) => Promise.resolve(void sequences.push(id)), modelChanged: () => undefined });
    drill.tickTo(killLandsAt - 1);
    drill.hit(drill.player(), northEast, 44);
    drill.tickTo(79);
    expect([drill.events("rift-destroyed").map((e) => [e.at, e.rift]), drill.events("rift-burst").map((e) => [e.at, e.rift, e.receipt]), drill.region.chat(), sequences]).toEqual([
      destroyed,
      bursts,
      chat,
      northEastRiftSequences,
    ]);
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
