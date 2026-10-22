import type { Fill } from "../../../../test/paintedTiles";
import { paintedFills } from "../../../../test/paintedTiles";
import type { DrillSelection } from "../js/OcellusTimings";
import { startDrill } from "./drill";

const TRANSITIONS = { focus: "transition-attacks", specialSelection: "replay-v2" } as const;

type Drill = ReturnType<typeof startDrill>;

function northEastRift(drill: Drill) {
  const rift = drill.region.mobs.find((mob) => mob.location.x === 11 && mob.location.y === 2);
  if (!rift) throw new Error("no rift on (11, 2)");
  return rift;
}

type DeflectAttack = Readonly<{
  attack: string;
  selection: DrillSelection;
  seed: number;
  wield: number | null;
  special: boolean;
  from: number;
  to: number;
  judged: readonly unknown[];
  reflected: readonly unknown[];
  playerHp: number;
  bossLost: number;
}>;

function attackIntoDeflect({ selection, seed, wield, special, from, to, judged, reflected, playerHp, bossLost }: DeflectAttack) {
  const drill = startDrill({ seed, selection });
  drill.tickTo(from - 1);
  if (wield !== null) drill.clickInventory(wield);
  drill.player().useSpecialAttack = special;
  drill.player().setAggro(drill.boss());
  drill.tickTo(to);
  const lost = drill.rows().filter((row) => row.tick >= from).reduce((sum, row) => sum + row.bossHp.atBossStep - row.bossHp.atPostTick, 0);
  expect({
    judged: drill.events("player-hit-judged").map((e) => [e.at, e.style, e.outcome, e.requested]),
    reflected: drill.events("deflect-reflected").map((e) => [e.at, e.style, e.receipt]),
    playerHp: drill.row(to).playerAtPostTick.hp,
    bossLost: lost,
  }).toEqual({ judged, reflected, playerHp, bossLost });
  drill.dispose();
}

describe("U6 boss overheads, heals and rifts", () => {
  test.each([
    { target: "the size-1 north-east rift once", seed: 2, selection: { focus: "rifts", setup: "melee" }, aggroAt: 68, pick: northEastRift, swingAt: 71, hits: [35], hpAfter: 9 },
    { target: "the size-1 north-east rift once more on its next swing", seed: 2, selection: { focus: "rifts", setup: "melee" }, aggroAt: 68, pick: northEastRift, swingAt: 76, hits: [9], hpAfter: 0 },
    { target: "the size-3 boss three times", seed: 4, selection: { focus: "rifts", setup: "melee", deflect: "none", hoverMeleeReach: "reachable" }, aggroAt: 12, pick: (drill: Drill) => drill.boss(), swingAt: 13, hits: [4, 12, 8], hpAfter: 1331 },
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
    ["range", 9, 10, "ranged", "passed", 20],
    ["range", 30, 31, "ranged", "passed", 20],
    ["slash", 31, 32, "melee", "blocked", 0],
    ["slash", 32, 33, "melee", "blocked", 0],
    ["slash", 33, 34, "melee", "passed", 20],
    ["range", 33, 34, "ranged", "passed", 20],
    ["range", 37, 39, "ranged", "passed", 20],
    ["slash", 38, 39, "melee", "passed", 20],
    ["range", 38, 39, "ranged", "passed", 20],
    ["slash", 39, 40, "melee", "passed", 20],
    ["range", 39, 40, "ranged", "blocked", 0],
    ["slash", 59, 60, "melee", "passed", 20],
    ["range", 59, 60, "ranged", "blocked", 0],
    ["slash", 61, 62, "melee", "passed", 20],
    ["range", 61, 62, "ranged", "passed", 20],
    ["slash", 67, 68, "melee", "passed", 20],
    ["range", 67, 68, "ranged", "passed", 20],
  ] as const)("Deflect judges a hit by the overhead when it was launched: a %s hit launched at %i and landing at %i", (attackStyle, launchedAt, landsAt, style, outcome, taken) => {
    const drill = startDrill({ selection: { focus: "rifts" } });
    drill.tickTo(launchedAt);
    drill.hit(drill.player(), drill.boss(), 20, attackStyle, landsAt - launchedAt);
    drill.tickTo(landsAt);
    const { atBossStep, atPostTick } = drill.row(landsAt).bossHp;
    expect([drill.events("player-hit-judged").map((e) => [e.at, e.style, e.outcome, e.requested]), atBossStep - atPostTick]).toEqual([[[landsAt, style, outcome, 20]], taken]);
    drill.dispose();
  });

  test.each([
    {
      attack: "Twisted Bow shots into Deflect Range",
      selection: { focus: "rifts" },
      seed: 4, wield: null, special: false, from: 39, to: 52,
      judged: [[42, "ranged", "blocked", 8], [47, "ranged", "blocked", 44], [52, "ranged", "blocked", 62]],
      reflected: [[47, "ranged", { requested: 4, applied: 4, beforeHp: 99, afterHp: 95, prayer: null }], [52, "ranged", { requested: 6, applied: 6, beforeHp: 95, afterHp: 89, prayer: null }]],
      playerHp: 89,
      bossLost: 0,
    },
    {
      attack: "Ralos throws into Deflect Range",
      selection: { focus: "rifts" },
      seed: 5, wield: 28922, special: false, from: 39, to: 52,
      judged: [[42, "ranged", "blocked", 0], [42, "ranged", "blocked", 0], [48, "ranged", "blocked", 13], [48, "ranged", "blocked", 2]],
      reflected: [[48, "ranged", { requested: 1, applied: 1, beforeHp: 99, afterHp: 98, prayer: null }]],
      playerHp: 98,
      bossLost: 0,
    },
    {
      attack: "a Division into Deflect Range",
      selection: { focus: "rifts" },
      seed: 4, wield: 28922, special: true, from: 39, to: 46,
      judged: [[42, "ranged", "blocked", 2], [42, "ranged", "blocked", 13]],
      reflected: [[42, "ranged", { requested: 1, applied: 1, beforeHp: 99, afterHp: 98, prayer: null }]],
      playerHp: 98,
      bossLost: 0,
    },
    {
      attack: "a scythe swing into Deflect Melee",
      selection: { focus: "rifts", setup: "melee" },
      seed: 4, wield: null, special: false, from: 29, to: 33,
      judged: [[31, "melee", "blocked", 4], [31, "melee", "blocked", 12], [31, "melee", "blocked", 8]],
      reflected: [[31, "melee", { requested: 1, applied: 1, beforeHp: 99, afterHp: 98, prayer: null }]],
      playerHp: 98,
      bossLost: 0,
    },
  ] as const)("Deflect blocks a hit of its style and reflects 10% of it, rounded down, onto the player: $attack", attackIntoDeflect);

  test.each([
    {
      attack: "Twisted Bow shots into Deflect Melee and Soul Split, which do not turn them away",
      selection: { focus: "rifts" },
      seed: 4, wield: null, special: false, from: 30, to: 38,
      judged: [[33, "ranged", "passed", 8], [38, "ranged", "passed", 44]],
      reflected: [],
      playerHp: 99,
      bossLost: 52,
    },
    {
      attack: "Twisted Bow shots into Deflect Range under deflect=block-at-launch",
      selection: { focus: "rifts", deflect: "block-at-launch" },
      seed: 4, wield: null, special: false, from: 39, to: 52,
      judged: [[42, "ranged", "blocked", 8], [47, "ranged", "blocked", 44], [52, "ranged", "blocked", 62]],
      reflected: [],
      playerHp: 99,
      bossLost: 0,
    },
  ] as const)("guard, nothing reflected: $attack", attackIntoDeflect);

  test.each([
    { weapon: "a scythe", selection: { focus: "rifts", setup: "melee" }, standsOn: { x: 5, y: 3 }, judged: [[31, "melee", "blocked"], [31, "melee", "blocked"], [31, "melee", "blocked"]] },
    {
      weapon: "a scythe under hoverMeleeReach=reachable",
      selection: { focus: "rifts", setup: "melee", hoverMeleeReach: "reachable" },
      standsOn: { x: 5, y: 3 },
      judged: [
        [14, "melee", "blocked"], [14, "melee", "blocked"], [14, "melee", "blocked"],
        [19, "melee", "blocked"], [19, "melee", "blocked"], [19, "melee", "blocked"],
        [24, "melee", "blocked"], [24, "melee", "blocked"], [24, "melee", "blocked"],
        [29, "melee", "blocked"], [29, "melee", "blocked"], [29, "melee", "blocked"],
      ],
    },
    { weapon: "a bow", selection: { focus: "rifts" }, standsOn: { x: 5, y: 1 }, judged: [[16, "ranged", "passed"], [21, "ranged", "passed"], [26, "ranged", "passed"], [31, "ranged", "passed"]] },
  ] as const)("melee cannot reach the boss while he hovers, from P4 tick 8 to 29, and ranged can: $weapon on him from tick 12", ({ selection, standsOn, judged }) => {
    const drill = startDrill({ selection });
    drill.tickTo(12);
    drill.player().setAggro(drill.boss());
    drill.tickTo(31);
    expect([drill.row(29).playerAtPostTick.tile, drill.events("player-hit-judged").map((e) => [e.at, e.style, e.outcome])]).toEqual([standsOn, judged]);
    drill.dispose();
  });

  test.each([
    { attack: "the ranged setup's Twisted Bow", seed: 2, setup: "ranged", wield: null, special: false, landed: [[72, 44]], destroyedAt: [73] },
    { attack: "the melee setup's Twisted Bow", seed: 2, setup: "melee", wield: 20997, special: false, landed: [[72, 44]], destroyedAt: [73] },
    { attack: "the ranged setup's Ralos", seed: 2, setup: "ranged", wield: 28922, special: false, landed: [[72, 18], [72, 18], [78, 8], [78, 8]], destroyedAt: [79] },
    { attack: "the melee setup's Ralos", seed: 2, setup: "melee", wield: 28922, special: false, landed: [[72, 15], [72, 15], [78, 14], [78, 14]], destroyedAt: [79] },
    { attack: "a Division special, which rolls", seed: 3, setup: "ranged", wield: 28922, special: true, landed: [[72, 15], [72, 5], [78, 18], [78, 18]], destroyedAt: [79] },
    { attack: "a scythe swing, which rolls", seed: 4, setup: "melee", wield: null, special: false, landed: [[72, 4], [77, 25]], destroyedAt: [] },
  ] as const)("a standard ranged attack always lands its max hit on a Void Rift: $attack", ({ seed, setup, wield, special, landed, destroyedAt }) => {
    const drill = startDrill({ seed, selection: { focus: "rifts", setup } });
    drill.tickTo(68);
    if (wield !== null) drill.clickInventory(wield);
    drill.player().useSpecialAttack = special;
    drill.player().setAggro(northEastRift(drill));
    drill.tickTo(79);
    expect([drill.events("rift-hit").map((e) => [e.at, e.damage]), drill.events("rift-destroyed").map((e) => e.at)]).toEqual([landed, destroyedAt]);
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
    drill.walkTo({ x: 9, y: 4 });
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
      killLandsAt: 89,
      destroyed: [[90, "rift-67-1"]],
      bursts: [[90, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }]],
      chat: ["Destroying the void rift empowers you!"],
      northEastRiftSequences: [14896, 14897],
    },
    {
      killLandsAt: 90,
      destroyed: [],
      bursts: [
        [90, "rift-67-0", { requested: 14, applied: 14, beforeHp: 99, afterHp: 85, prayer: null }],
        [90, "rift-67-1", { requested: 14, applied: 14, beforeHp: 85, afterHp: 71, prayer: null }],
      ],
      chat: [],
      northEastRiftSequences: [14896, 14898],
    },
  ])("a rift dead by the end of 89 despawns and is destroyed at 90, and a standing one detonates and bursts for 14: north-east rift killed by a hit landing at $killLandsAt", ({ killLandsAt, destroyed, bursts, chat, northEastRiftSequences }) => {
    const drill = startDrill({ selection: { focus: "rifts" } });
    drill.tickTo(68);
    const northEast = northEastRift(drill);
    const sequences: number[] = [];
    northEast.setAnimationListener({ animationChanged: (id) => Promise.resolve(void sequences.push(id)), modelChanged: () => undefined });
    drill.tickTo(killLandsAt - 1);
    drill.hit(drill.player(), northEast, 44);
    drill.tickTo(91);
    expect([drill.events("rift-destroyed").map((e) => [e.at, e.rift]), drill.events("rift-burst").map((e) => [e.at, e.rift, e.receipt]), drill.region.chat(), sequences]).toEqual([
      destroyed,
      bursts,
      chat,
      northEastRiftSequences,
    ]);
    drill.dispose();
  });

  test("under each rift's HP bar a yellow timer bar of the same size fills from the left as the rift charges, full on the burst tick", () => {
    const drill = startDrill({ selection: { focus: "rifts" } });
    const drawn: Record<number, readonly Fill[]> = {};
    for (const t of [67, 69, 78, 89, 90]) {
      drill.tickTo(t);
      const northWest = [...drill.region.mobs, ...drill.region.newMobs].find((mob) => mob.location.x === 2 && mob.location.y === 2);
      drawn[t] = northWest ? paintedFills((context) => northWest.drawHPBar(context, 1, 0)) : [];
    }
    const bars = (yellow: number): readonly Fill[] => [
      { style: "red", x: -15, y: 0, width: 30, height: 5 },
      { style: "lime", x: -15, y: 0, width: 30, height: 5 },
      { style: "#1e1e0c", x: -15, y: 5, width: 30, height: 5 },
      { style: "#e0c020", x: -15, y: 5, width: yellow, height: 5 },
    ];
    expect([drawn, drill.events("rift-burst").map((e) => [e.at, e.rift])]).toEqual([
      { 67: bars(0), 69: bars(60 / 23), 78: bars(330 / 23), 89: bars(660 / 23), 90: bars(30) },
      [[90, "rift-67-0"], [90, "rift-67-1"]],
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
