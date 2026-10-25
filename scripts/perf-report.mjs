#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { tsImport } from "tsx/esm/api";

const usage = `usage: perf-report.mjs --account ID [--days N] [--version V] [--dataset NAME] [--print-sql]

Summarises the anonymous performance summaries in Workers Analytics Engine:
estimated runs, then the median across runs of each run's frame and tick
percentiles, by 2D or 3D, by GPU family and by device pixel ratio. Runs are
scaled up by each summary's sample rate. Needs CLOUDFLARE_API_TOKEN with
Account Analytics Read, unless --print-sql only prints the queries.
`;

const { values: options } = parseArgs({
  options: {
    account: { type: "string" },
    days: { type: "string", default: "7" },
    version: { type: "string" },
    dataset: { type: "string", default: "archive_ocellus_perf" },
    "print-sql": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});
if (options.help) {
  process.stdout.write(usage);
  process.exit(0);
}
const token = process.env.CLOUDFLARE_API_TOKEN;
const problem = !/^[1-9]\d*$/.test(options.days)
  ? "--days must be a whole number of days"
  : !/^[a-z0-9_]+$/.test(options.dataset)
    ? "--dataset must be lowercase letters, digits and underscores"
    : options.version !== undefined && !/^\d{4}\.\d{2}\.\d{2}(\.[1-9]\d*)?$/.test(options.version)
      ? "--version must be YYYY.MM.DD or YYYY.MM.DD.N"
      : options["print-sql"]
        ? null
        : !options.account || !/^[0-9a-f]{32}$/.test(options.account)
          ? "--account must be the 32 hex digit Cloudflare account id"
          : !token
            ? "CLOUDFLARE_API_TOKEN is not set"
            : null;
if (problem !== null) {
  process.stderr.write(`perf-report: ${problem}\n${usage}`);
  process.exit(2);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { SUMMARY_FIELDS } = await tsImport(pathToFileURL(path.join(root, "src/telemetry/perfSummary.ts")).href, import.meta.url);
const fields = Object.entries(SUMMARY_FIELDS);
const column = Object.fromEntries([
  ...fields.filter(([, field]) => field.kind !== "double").map(([name], i) => [name, `blob${i + 1}`]),
  ...fields.filter(([, field]) => field.kind === "double").map(([name], i) => [name, `double${i + 1}`]),
]);

const runs = `_sample_interval / ${column.sampleRate}`;
const median = (name) => `quantileExactWeighted(0.5)(${column[name]}, _sample_interval) AS ${name}`;
const where = [`timestamp > NOW() - INTERVAL '${options.days}' DAY`, ...(options.version ? [`${column.version} = '${options.version}'`] : [])].join(" AND ");

const GROUPS = [
  { title: "By view", by: ["view"] },
  { title: "By GPU family and view", by: ["gpu", "view"] },
  { title: "By device pixel ratio and view", by: ["devicePixelRatio", "view"] },
];
const STATS = ["frameMedianMs", "frameP95Ms", "frameP99Ms", "tickMedianMs", "tickP95Ms", "tickMaxMs"];

function query({ by }) {
  return [
    `SELECT ${by.map((name) => `${column[name]} AS ${name}`).join(", ")},`,
    `  round(sum(${runs})) AS runs,`,
    `  round(sumIf(${runs}, ${column.lateTicks} > 0) / sum(${runs}), 3) AS lateTickRunShare,`,
    `  ${STATS.map(median).join(",\n  ")}`,
    `FROM ${options.dataset}`,
    `WHERE ${where}`,
    `GROUP BY ${by.join(", ")}`,
    `ORDER BY runs DESC`,
    `FORMAT JSON`,
  ].join("\n");
}

if (options["print-sql"]) {
  for (const group of GROUPS) process.stdout.write(`-- ${group.title}\n${query(group)};\n\n`);
  process.exit(0);
}

async function rows(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${options.account}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: sql,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Analytics Engine answered ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text).data;
}

for (const group of GROUPS) {
  const data = await rows(query(group));
  const headers = [...group.by, "runs", "lateTickRunShare", ...STATS];
  process.stdout.write(`## ${group.title}, last ${options.days} days${options.version ? `, version ${options.version}` : ""}\n\n`);
  process.stdout.write(`| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n`);
  for (const row of data) process.stdout.write(`| ${headers.map((name) => row[name]).join(" | ")} |\n`);
  process.stdout.write("\n");
}
