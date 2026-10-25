import type { Tick } from "../sim/brands";
import { tick } from "../sim/brands";

export const VIEWS = ["3d", "2d"] as const;
export type View = (typeof VIEWS)[number];
export const SIDES = ["base", "head"] as const;
export type Side = (typeof SIDES)[number];
const BUDGETS = ["drawCallsMedian3d", "drawCallsMax3d", "canvasToViewport2d", "geometriesPerRetiredRift3d", "texturesPerRetiredRift3d"] as const;
export type BudgetName = (typeof BUDGETS)[number];
const TIMINGS = ["frameP95", "tickGapP95"] as const;
export type TimingMeasure = (typeof TIMINGS)[number];

type TickRange = Readonly<{ from: Tick; to: Tick }>;
export type Config = Readonly<{
  workload: Readonly<{ query: string; window: TickRange; resources: TickRange }>;
  budgets: Readonly<Record<BudgetName, number>>;
  timing: Readonly<{ pairs: number; medianRatioLimit: number }>;
}>;

type TickSample = Readonly<{ at: number; p4: Tick | null; stage: string | null; geometries: number | null; textures: number | null }>;
type DrawSample = Readonly<{ at: number; calls: number }>;
export type Capture = Readonly<{
  view: View;
  viewportPixels: number;
  frames: readonly number[];
  ticks: readonly TickSample[];
  draws: readonly DrawSample[];
  largestCanvasPixels: number;
  retired: readonly Tick[];
  errors: readonly string[];
}>;
export type Pair = Readonly<Record<View, Readonly<Record<Side, Capture>>>>;
export type Runs = Readonly<{ pairs: readonly Pair[]; long: Capture }>;

export type RunMetrics = Readonly<{
  frameP95: number;
  tickGapP95: number;
  tickGapMax: number;
  drawCallsMedian: number | null;
  drawCallsMax: number | null;
  canvasToViewport: number;
}>;

export type Line =
  | Readonly<{ kind: "budget"; name: BudgetName; observed: number; budget: number }>
  | Readonly<{ kind: "timing"; measure: TimingMeasure; view: View; base: readonly number[]; head: readonly number[]; medianRatio: number; limit: number }>
  | Readonly<{ kind: "measurement"; run: string; problem: string }>;

export function passes(line: Line): boolean {
  switch (line.kind) {
    case "budget":
      return line.observed <= line.budget;
    case "timing":
      return line.medianRatio <= line.limit;
    case "measurement":
      return false;
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

const median = (values: readonly number[]): number => percentile(values, 0.5);

function gaps(times: readonly number[]): number[] {
  return times.slice(1).map((at, i) => at - times[i]);
}

function tickAt(capture: Capture, p4: Tick): TickSample | undefined {
  return capture.ticks.find((sample) => sample.p4 === p4);
}

function span(capture: Capture, { from, to }: TickRange): Readonly<{ start: number; end: number }> | null {
  const start = tickAt(capture, from);
  const end = tickAt(capture, to);
  return start && end ? { start: start.at, end: end.at } : null;
}

function measurementProblems(name: string, capture: Capture, window: TickRange): Line[] {
  const problem = (text: string): Line => ({ kind: "measurement", run: name, problem: text });
  const within = span(capture, window);
  if (within === null) return [problem(`never reached P4 tick ${window.to}`)];
  return [
    ...capture.errors.map((error) => problem(`page error: ${error}`)),
    ...(capture.frames.filter((at) => at >= within.start && at <= within.end).length < 2 ? [problem("fewer than 2 frames in the window")] : []),
    ...(capture.view === "3d" && !capture.draws.some(({ at }) => at >= within.start && at <= within.end) ? [problem("no 3D render in the window")] : []),
  ];
}

export function runMetrics(capture: Capture, window: TickRange): RunMetrics {
  const within = span(capture, window);
  if (within === null) throw new RangeError(`the run never reached P4 tick ${window.to}`);
  const inWindow = (at: number) => at >= within.start && at <= within.end;
  const frameGaps = gaps(capture.frames.filter(inWindow));
  const tickGaps = gaps(capture.ticks.filter(({ p4 }) => p4 !== null && p4 >= window.from && p4 <= window.to).map(({ at }) => at));
  const draws = capture.draws.filter(({ at }) => inWindow(at)).map(({ calls }) => calls);
  return {
    frameP95: percentile(frameGaps, 0.95),
    tickGapP95: percentile(tickGaps, 0.95),
    tickGapMax: Math.max(...tickGaps),
    drawCallsMedian: draws.length > 0 ? median(draws) : null,
    drawCallsMax: draws.length > 0 ? Math.max(...draws) : null,
    canvasToViewport: capture.largestCanvasPixels / capture.viewportPixels,
  };
}

function ticksSinceInnerVoidOnset(capture: Capture, sample: TickSample): number | null {
  const onsets = capture.ticks.filter(({ at, stage }, i) => at <= sample.at && stage === "inner-void" && capture.ticks[i - 1]?.stage !== "inner-void");
  const onset = onsets[onsets.length - 1];
  if (!onset || onset.p4 === null || sample.p4 === null) return null;
  return sample.p4 - onset.p4;
}

type Growth = Readonly<{ geometries: number; textures: number }> | Readonly<{ problem: string }>;

function growthPerRetiredRift(capture: Capture, { from, to }: TickRange): Growth {
  const first = tickAt(capture, from);
  const last = tickAt(capture, to);
  if (!first || !last) return { problem: `never reached P4 tick ${to}` };
  if (first.geometries === null || first.textures === null || last.geometries === null || last.textures === null) return { problem: "no renderer resource counts" };
  const offsets = [ticksSinceInnerVoidOnset(capture, first), ticksSinceInnerVoidOnset(capture, last)];
  if (offsets[0] === null || offsets[0] !== offsets[1]) return { problem: `P4 ticks ${from} and ${to} are at cycle offsets ${offsets.join(" and ")}` };
  const retired = capture.retired.filter((at) => at > from && at <= to).length;
  if (retired === 0) return { problem: `no rift retired between P4 ticks ${from} and ${to}` };
  return { geometries: (last.geometries - first.geometries) / retired, textures: (last.textures - first.textures) / retired };
}

export function judge(config: Config, runs: Runs): readonly Line[] {
  const { window, resources } = config.workload;
  const named = runs.pairs.flatMap((pair, i) => VIEWS.flatMap((view) => SIDES.map((side) => [`${side}-${view}-${i + 1}`, pair[view][side]] as const)));
  const problems = [...named.flatMap(([name, capture]) => measurementProblems(name, capture, window)), ...measurementProblems("long-3d", runs.long, resources)];
  const growth = growthPerRetiredRift(runs.long, resources);
  if ("problem" in growth) problems.push({ kind: "measurement", run: "long-3d", problem: growth.problem });
  if (problems.length > 0 || "problem" in growth) return problems;

  const metrics = (view: View, side: Side) => runs.pairs.map((pair) => runMetrics(pair[view][side], window));
  const worst = (values: readonly (number | null)[]) => Math.max(...values.map((value) => value ?? Infinity));
  const observed: Readonly<Record<BudgetName, number>> = {
    drawCallsMedian3d: worst(metrics("3d", "head").map((run) => run.drawCallsMedian)),
    drawCallsMax3d: worst(metrics("3d", "head").map((run) => run.drawCallsMax)),
    canvasToViewport2d: worst(metrics("2d", "head").map((run) => run.canvasToViewport)),
    geometriesPerRetiredRift3d: growth.geometries,
    texturesPerRetiredRift3d: growth.textures,
  };
  const budgets: Line[] = BUDGETS.map((name) => ({ kind: "budget", name, observed: observed[name], budget: config.budgets[name] }));
  const timings: Line[] = VIEWS.flatMap((view) =>
    TIMINGS.map((measure) => {
      const base = metrics(view, "base").map((run) => run[measure]);
      const head = metrics(view, "head").map((run) => run[measure]);
      return { kind: "timing", measure, view, base, head, medianRatio: median(head.map((value, i) => value / base[i])), limit: config.timing.medianRatioLimit };
    }),
  );
  return [...budgets, ...timings];
}

type Json = unknown;

function field(raw: Json, key: string): Json {
  if (typeof raw !== "object" || raw === null || !(key in raw)) throw new TypeError(`missing ${key}`);
  return Object.getOwnPropertyDescriptor(raw, key)?.value;
}

function num(raw: Json, key: string): number {
  return finite(field(raw, key));
}

function finite(raw: Json): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) throw new TypeError(`${String(raw)} is not a number`);
  return raw;
}

function finiteOrNull(raw: Json): number | null {
  return raw === null ? null : finite(raw);
}

function list(raw: Json, key: string): readonly Json[] {
  const value = field(raw, key);
  if (!Array.isArray(value)) throw new TypeError(`${key} is not a list`);
  return value;
}

function tuple(raw: Json, length: number): readonly Json[] {
  if (!Array.isArray(raw) || raw.length !== length) throw new TypeError(`${JSON.stringify(raw)} is not a ${length}-tuple`);
  return raw;
}

function range(raw: Json, key: string): TickRange {
  const value = field(raw, key);
  return { from: tick(num(value, "from")), to: tick(num(value, "to")) };
}

function isView(value: Json): value is View {
  return VIEWS.some((view) => view === value);
}

export function parseConfig(raw: Json): Config {
  const workload = field(raw, "workload");
  const query = field(workload, "query");
  if (typeof query !== "string") throw new TypeError("workload.query is not a string");
  const budgets = field(raw, "budgets");
  const timing = field(raw, "timing");
  const pairs = num(timing, "pairs");
  if (!Number.isInteger(pairs) || pairs < 1) throw new RangeError("timing.pairs is not a positive whole number");
  return {
    workload: { query, window: range(workload, "window"), resources: range(workload, "resources") },
    budgets: {
      drawCallsMedian3d: num(budgets, "drawCallsMedian3d"),
      drawCallsMax3d: num(budgets, "drawCallsMax3d"),
      canvasToViewport2d: num(budgets, "canvasToViewport2d"),
      geometriesPerRetiredRift3d: num(budgets, "geometriesPerRetiredRift3d"),
      texturesPerRetiredRift3d: num(budgets, "texturesPerRetiredRift3d"),
    },
    timing: { pairs, medianRatioLimit: num(timing, "medianRatioLimit") },
  };
}

export function parseCapture(raw: Json): Capture {
  const view = field(raw, "view");
  if (!isView(view)) throw new TypeError(`view ${String(view)} is not 3d or 2d`);
  const viewport = field(raw, "viewport");
  const canvas = field(raw, "largestCanvas");
  return {
    view,
    viewportPixels: num(viewport, "width") * num(viewport, "height") * num(viewport, "dpr") ** 2,
    frames: list(raw, "frames").map(finite),
    ticks: list(raw, "ticks").map((sample) => {
      const [at, p4, stage, geometries, textures] = tuple(sample, 5);
      if (stage !== null && typeof stage !== "string") throw new TypeError(`stage ${String(stage)} is not a string`);
      return { at: finite(at), p4: p4 === null ? null : tick(finite(p4)), stage, geometries: finiteOrNull(geometries), textures: finiteOrNull(textures) };
    }),
    draws: list(raw, "draws").map((sample) => {
      const [at, calls] = tuple(sample, 2);
      return { at: finite(at), calls: finite(calls) };
    }),
    largestCanvasPixels: num(canvas, "width") * num(canvas, "height"),
    retired: list(raw, "retired").map((at) => tick(finite(at))),
    errors: list(raw, "errors").map(String),
  };
}
