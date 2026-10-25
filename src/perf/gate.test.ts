import type { Capture, Line, Pair, View } from "./gate";
import { judge, parseCapture, parseConfig, passes } from "./gate";

const CONFIG = parseConfig({
  workload: { query: "?seed=1", window: { from: 8, to: 80 }, resources: { from: 100, to: 280 } },
  budgets: { drawCallsMedian3d: 500, drawCallsMax3d: 700, canvasToViewport2d: 2, geometriesPerRetiredRift3d: 2, texturesPerRetiredRift3d: 1 },
  timing: { pairs: 3, medianRatioLimit: 1.5 },
});
const TICK_MS = 600;
const LEAD_IN_TICKS = 3;
const LEAD_IN_FRAME_MS = 500;
const LEAD_IN_DRAW_CALLS = 5000;
const RETIRED = [90, 90, 150, 150, 210, 210, 270, 270];

type Run = Readonly<{ view: View; lastTick?: number; frameMs?: number; draws?: readonly number[]; canvas?: readonly [number, number]; geometriesPerRift?: number; errors?: readonly string[] }>;

function capture({ view, lastTick = 280, frameMs = 16, draws = [500], canvas = [1280, 800], geometriesPerRift = 2, errors = [] }: Run): Capture {
  const retiredBy = (p4: number) => RETIRED.filter((at) => at <= p4).length;
  const ticks = Array.from({ length: lastTick + LEAD_IN_TICKS + 1 }, (_, world) => {
    const p4 = world >= LEAD_IN_TICKS ? world - LEAD_IN_TICKS : null;
    const stage = p4 === null ? null : p4 % 60 >= 8 && p4 % 60 < 30 ? "inner-void" : "outer-void";
    const resources = view === "3d" && p4 !== null ? [100 + geometriesPerRift * retiredBy(p4), 10 + retiredBy(p4)] : [null, null];
    return [world * TICK_MS, p4, stage, ...resources];
  });
  const fightStart = (LEAD_IN_TICKS + CONFIG.workload.window.from) * TICK_MS;
  const end = (LEAD_IN_TICKS + lastTick) * TICK_MS;
  const frames = [];
  for (let at = 0; at <= end; at += at < fightStart ? LEAD_IN_FRAME_MS : frameMs) frames.push(at);
  return parseCapture({
    view,
    viewport: { width: 1280, height: 800, dpr: 1 },
    frames,
    ticks,
    draws: view === "3d" ? frames.map((at, i) => [at, at < fightStart ? LEAD_IN_DRAW_CALLS : draws[i % draws.length]]) : [],
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

function summary(line: Line): readonly (string | number | boolean)[] {
  switch (line.kind) {
    case "budget":
      return [line.name, line.observed, passes(line)];
    case "timing":
      return [`${line.measure} ${line.view}`, line.medianRatio, passes(line)];
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
    const lines = judge(CONFIG, { pairs: pairs({ "3d": { view: "3d" }, "2d": { view: "2d" } }), long: capture({ view: "3d" }) });

    expect(lines.map(summary)).toEqual([
      ["drawCallsMedian3d", 500, true],
      ["drawCallsMax3d", 500, true],
      ["canvasToViewport2d", 1, true],
      ["geometriesPerRetiredRift3d", 2, true],
      ["texturesPerRetiredRift3d", 1, true],
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

  test("rejects runs that missed the window or logged a page error, and resource samples from different points of the cycle", () => {
    const config = parseConfig({
      workload: { query: "?seed=1", window: { from: 8, to: 80 }, resources: { from: 100, to: 250 } },
      budgets: { drawCallsMedian3d: 500, drawCallsMax3d: 700, canvasToViewport2d: 2, geometriesPerRetiredRift3d: 2, texturesPerRetiredRift3d: 1 },
      timing: { pairs: 3, medianRatioLimit: 1.5 },
    });
    const head = { "3d": { view: "3d", errors: ["Uncaught TypeError: boom"] }, "2d": { view: "2d", lastTick: 60 } } as const;
    const lines = judge(config, { pairs: pairs(head).slice(0, 1), long: capture({ view: "3d" }) });

    expect(lines.map(summary)).toEqual([
      ["head-3d-1", "page error: Uncaught TypeError: boom", false],
      ["head-2d-1", "never reached P4 tick 80", false],
      ["long-3d", "P4 ticks 100 and 250 are at cycle offsets 32 and 2", false],
    ]);
  });
});
