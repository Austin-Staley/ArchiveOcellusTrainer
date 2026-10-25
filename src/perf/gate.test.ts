import type { Capture, Line, Pair, View } from "./gate";
import { budgetRaises, judge, parseBaseLimits, parseCapture, parseConfig, passes } from "./gate";

const BUDGETS = {
  drawCallsMedian3d: 500,
  drawCallsMax3d: 700,
  canvasToViewport2d: 2,
  tickGapExcess3d: 200,
  tickGapExcess2d: 200,
  geometriesPerRetiredRift3d: 2,
  texturesPerRetiredRift3d: 1,
  heapGrowthMiB3d: 8,
  mobGrowth3d: 0,
  entityGrowth3d: 0,
  projectileGrowth3d: 0,
  sceneObjectGrowth3d: 0,
};
const RAW_CONFIG = {
  workload: { query: "?seed=1", cpuThrottleRate: 4, window: { from: 8, to: 80 }, resources: { from: 100, to: 280 } },
  budgets: BUDGETS,
  timing: { pairs: 3, medianRatioLimit: 1.5 },
  exceptions: [],
};
const CONFIG = parseConfig(RAW_CONFIG);
const MIB = 1024 * 1024;
const LEAD_IN_TICKS = 3;
const LEAD_IN_FRAME_MS = 500;
const LEAD_IN_DRAW_CALLS = 5000;
const RETIRED = [90, 90, 150, 150, 210, 210, 270, 270];

type Leaks = Readonly<{ heapMiB?: number; mobs?: number; entities?: number; projectiles?: number; sceneObjects?: number }>;
type Run = Readonly<{
  view: View;
  lastTick?: number;
  tickMs?: number;
  stallAfterTick?: number;
  frameMs?: number;
  draws?: readonly number[];
  canvas?: readonly [number, number];
  geometriesPerRift?: number;
  texturesPerRift?: number;
  leaks?: Leaks;
  heapReadings?: boolean;
  errors?: readonly string[];
}>;

function capture({ view, lastTick = 280, tickMs = 600, stallAfterTick, frameMs = 16, draws = [500], canvas = [1280, 800], geometriesPerRift = 2, texturesPerRift = 1, leaks = {}, heapReadings = true, errors = [] }: Run): Capture {
  const { from, to } = CONFIG.workload.resources;
  const retiredBy = (p4: number) => RETIRED.filter((at) => at <= p4).length;
  const leaked = (p4: number | null, amount = 0) => (p4 !== null && p4 > from ? amount : 0);
  const tickTime = (world: number) => world * tickMs + (stallAfterTick !== undefined && world - LEAD_IN_TICKS > stallAfterTick ? 1500 : 0);
  const ticks = Array.from({ length: lastTick + LEAD_IN_TICKS + 1 }, (_, world) => {
    const p4 = world >= LEAD_IN_TICKS ? world - LEAD_IN_TICKS : null;
    const stage = p4 === null ? null : p4 % 60 >= 8 && p4 % 60 < 30 ? "inner-void" : "outer-void";
    const renderer =
      view === "3d" && p4 !== null
        ? { geometries: 100 + geometriesPerRift * retiredBy(p4), textures: 10 + texturesPerRift * retiredBy(p4), sceneObjects: 400 + leaked(p4, leaks.sceneObjects) }
        : null;
    const counts = { mobs: 1 + leaked(p4, leaks.mobs), entities: 50 + leaked(p4, leaks.entities), projectiles: leaked(p4, leaks.projectiles) };
    return { at: tickTime(world), p4, stage, world: counts, renderer };
  });
  const fightStart = tickTime(LEAD_IN_TICKS + CONFIG.workload.window.from);
  const end = tickTime(LEAD_IN_TICKS + lastTick);
  const frames = [];
  for (let at = 0; at <= end; at += at < fightStart ? LEAD_IN_FRAME_MS : frameMs) frames.push(at);
  const heap = [
    { p4: from, usedBytes: 50 * MIB, backingBytes: 10 * MIB },
    { p4: to, usedBytes: 50 * MIB, backingBytes: (10 + (leaks.heapMiB ?? 0)) * MIB },
  ];
  return parseCapture({
    view,
    viewport: { width: 1280, height: 800, dpr: 1 },
    frames,
    ticks,
    draws: view === "3d" ? frames.map((at, i) => [at, at < fightStart ? LEAD_IN_DRAW_CALLS : draws[i % draws.length]]) : [],
    heap: heapReadings && lastTick >= to ? heap : [],
    largestCanvas: { width: canvas[0], height: canvas[1] },
    retired: RETIRED.filter((at) => at <= lastTick),
    errors,
  });
}

function pairs(head: Readonly<Record<View, Run>>): Pair[] {
  return [1, 2, 3].map(() => ({
    "3d": { base: capture({ view: "3d", lastTick: 80 }), head: capture({ lastTick: 80, ...head["3d"] }) },
    "2d": { base: capture({ view: "2d", lastTick: 80 }), head: capture({ lastTick: 80, ...head["2d"] }) },
  }));
}

const UNCHANGED = { "3d": { view: "3d" }, "2d": { view: "2d" } } as const;

function summary(line: Line): readonly (string | number | boolean)[] {
  switch (line.kind) {
    case "budget":
      return [line.name, line.observed, passes(line)];
    case "timing":
      return [`${line.measure} ${line.view}`, line.medianRatio, passes(line)];
    case "raise":
      return [line.limit, line.base, line.head, passes(line)];
    case "measurement":
      return [line.run, line.problem, passes(line)];
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

describe("judge", () => {
  test("passes a head that matches its base and stays within every budget, counting only the fight window", () => {
    const lines = judge(CONFIG, { pairs: pairs(UNCHANGED), long: capture({ view: "3d" }) });

    expect(lines.map(summary)).toEqual([
      ["drawCallsMedian3d", 500, true],
      ["drawCallsMax3d", 500, true],
      ["canvasToViewport2d", 1, true],
      ["tickGapExcess3d", 0, true],
      ["tickGapExcess2d", 0, true],
      ["geometriesPerRetiredRift3d", 2, true],
      ["texturesPerRetiredRift3d", 1, true],
      ["heapGrowthMiB3d", 0, true],
      ["mobGrowth3d", 0, true],
      ["entityGrowth3d", 0, true],
      ["projectileGrowth3d", 0, true],
      ["sceneObjectGrowth3d", 0, true],
      ["frameP95 3d", 1, true],
      ["tickGapP95 3d", 1, true],
      ["frameP95 2d", 1, true],
      ["tickGapP95 2d", 1, true],
    ]);
  });

  test("fails each budget the head breaks and a timing measure the head slows beyond the limit, and nothing else", () => {
    const head = {
      "3d": { view: "3d", draws: [500, 500, 500, 900] },
      "2d": { view: "2d", frameMs: 40, canvas: [2560, 1600] },
    } as const;
    const lines = judge(CONFIG, { pairs: pairs(head), long: capture({ view: "3d", geometriesPerRift: 3 }) });

    expect(lines.filter((line) => !passes(line)).map(summary)).toEqual([
      ["drawCallsMax3d", 900, false],
      ["canvasToViewport2d", 4, false],
      ["geometriesPerRetiredRift3d", 3, false],
      ["frameP95 2d", 2.5, false],
    ]);
  });

  test("fails median draw calls, texture growth, 3D frame time, one long stall and slower ticks", () => {
    const head = {
      "3d": { view: "3d", draws: [600], frameMs: 40, stallAfterTick: 40 },
      "2d": { view: "2d", tickMs: 1000 },
    } as const;
    const lines = judge(CONFIG, { pairs: pairs(head), long: capture({ view: "3d", texturesPerRift: 2 }) });

    expect(lines.filter((line) => !passes(line)).map(summary)).toEqual([
      ["drawCallsMedian3d", 600, false],
      ["tickGapExcess3d", 1500, false],
      ["tickGapExcess2d", 400, false],
      ["texturesPerRetiredRift3d", 2, false],
      ["frameP95 3d", 2.5, false],
      ["tickGapP95 2d", 1000 / 600, false],
    ]);
  });

  test("fails heap, mob, entity, projectile and scene object growth between the long run's resource ticks", () => {
    const long = capture({ view: "3d", leaks: { heapMiB: 180, mobs: 1, entities: 2, projectiles: 3, sceneObjects: 4 } });
    const lines = judge(CONFIG, { pairs: pairs(UNCHANGED), long });

    expect(lines.filter((line) => !passes(line)).map(summary)).toEqual([
      ["heapGrowthMiB3d", 180, false],
      ["mobGrowth3d", 1, false],
      ["entityGrowth3d", 2, false],
      ["projectileGrowth3d", 3, false],
      ["sceneObjectGrowth3d", 4, false],
    ]);
  });

  test("rejects runs that missed the window or logged a page error, resource samples from different points of the cycle, and a long run without heap readings", () => {
    const config = parseConfig({ ...RAW_CONFIG, workload: { ...RAW_CONFIG.workload, resources: { from: 100, to: 250 } } });
    const head = { "3d": { view: "3d", errors: ["Uncaught TypeError: boom"] }, "2d": { view: "2d", lastTick: 60 } } as const;
    const lines = judge(config, { pairs: pairs(head).slice(0, 1), long: capture({ view: "3d" }) });
    const unweighed = judge(CONFIG, { pairs: pairs(UNCHANGED), long: capture({ view: "3d", heapReadings: false }) });

    expect([...lines, ...unweighed].map(summary)).toEqual([
      ["head-3d-1", "page error: Uncaught TypeError: boom", false],
      ["head-2d-1", "never reached P4 tick 80", false],
      ["long-3d", "P4 ticks 100 and 250 are at cycle offsets 32 and 2", false],
      ["long-3d", "no heap reading between P4 ticks 100 and 280", false],
    ]);
  });
});

describe("budgetRaises", () => {
  const exception = (budget: string, from: number, to: number) => ({ budget, from, to, reason: `${budget} pays for a new effect`, evidence: "https://example.test/run/1" });

  test("fails a raise against the base unless this pull request adds an exception for exactly that raise", () => {
    const inherited = exception("medianRatioLimit", 1.25, 1.3);
    const base = parseBaseLimits({
      budgets: { drawCallsMax3d: 1234, tickGapExcess3d: 900, canvasToViewport2d: 3, heapGrowthMiB3d: 8 },
      timing: { medianRatioLimit: 1.25 },
      exceptions: [inherited],
    });
    const head = parseConfig({
      ...RAW_CONFIG,
      budgets: { ...BUDGETS, drawCallsMax3d: 1258, tickGapExcess3d: 1000, heapGrowthMiB3d: 16 },
      timing: { pairs: 3, medianRatioLimit: 1.3 },
      exceptions: [inherited, exception("tickGapExcess3d", 900, 1000), exception("heapGrowthMiB3d", 4, 16)],
    });

    expect(budgetRaises(base, head).map(summary)).toEqual([
      ["drawCallsMax3d", 1234, 1258, false],
      ["tickGapExcess3d", 900, 1000, true],
      ["heapGrowthMiB3d", 8, 16, false],
      ["medianRatioLimit", 1.25, 1.3, false],
    ]);
    expect(budgetRaises(null, head)).toEqual([]);
  });
});
