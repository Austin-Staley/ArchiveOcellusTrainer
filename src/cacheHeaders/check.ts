import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isViolation, servedCache } from "./cacheHeaders";

const USAGE = "usage: check.ts <dist directory>";

function main(args: readonly string[]): void {
  const [dist] = args;
  if (dist === undefined || args.length !== 1) throw new Error(USAGE);
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join("/"));
  const served = servedCache(readFileSync(join(dist, "_headers"), "utf8"), files);
  const violations = served.filter(({ verdict }) => isViolation(verdict));
  for (const { url, cacheControl, verdict } of violations) console.error(`cache-headers: ${verdict} ${url} (Cache-Control: ${cacheControl ?? "none"})`);
  const immutable = served.filter(({ verdict }) => verdict === "immutable").length;
  console.log(`cache-headers: ${served.length} URLs, ${immutable} immutable, ${violations.length} violations`);
  if (violations.length > 0) process.exitCode = 1;
}

main(process.argv.slice(2));
