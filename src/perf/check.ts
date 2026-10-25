import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Capture, Line, Pair } from "./gate";
import { SIDES, VIEWS, judge, parseCapture, parseConfig, passes, runMetrics } from "./gate";

const USAGE = "usage: check.ts <perfGate.json> <captures directory>";

function read(file: string): unknown {
  if (!existsSync(file)) throw new Error(`missing capture ${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function describe(line: Line): string {
  switch (line.kind) {
    case "budget":
      return `${line.name}: ${line.observed} against a budget of ${line.budget}`;
    case "timing":
      return `${line.measure} ${line.view}: head/base median ratio ${line.medianRatio.toFixed(3)} against a limit of ${line.limit} (base ${line.base.map((v) => v.toFixed(1)).join(", ")}; head ${line.head.map((v) => v.toFixed(1)).join(", ")})`;
    case "measurement":
      return `${line.run}: ${line.problem}`;
    default: {
      const unreachable: never = line;
      return unreachable;
    }
  }
}

function main(args: readonly string[]): void {
  const [configFile, dir] = args;
  if (configFile === undefined || dir === undefined || args.length !== 2) throw new Error(USAGE);
  const config = parseConfig(read(configFile));
  const capture = (name: string): Capture => parseCapture(read(join(dir, `${name}.json`)));
  const pairs = Array.from({ length: config.timing.pairs }, (_, i): Pair => {
    const sides = (view: (typeof VIEWS)[number]) => ({ base: capture(`base-${view}-${i + 1}`), head: capture(`head-${view}-${i + 1}`) });
    return { "3d": sides("3d"), "2d": sides("2d") };
  });
  const long = capture("long-3d");
  const lines = judge(config, { pairs, long });
  const measured = lines.every(({ kind }) => kind !== "measurement");
  const runs = measured
    ? Object.fromEntries([
        ...pairs.flatMap((pair, i) => VIEWS.flatMap((view) => SIDES.map((side) => [`${side}-${view}-${i + 1}`, runMetrics(pair[view][side], config.workload.window)]))),
        ["long-3d", runMetrics(long, config.workload.resources)],
      ])
    : {};
  for (const line of lines) console.error(`perf: ${passes(line) ? "PASS" : "FAIL"} ${describe(line)}`);
  console.log(JSON.stringify({ lines: lines.map((line) => ({ ...line, pass: passes(line) })), runs }, null, 2));
  if (!lines.every(passes)) process.exitCode = 1;
}

main(process.argv.slice(2));
