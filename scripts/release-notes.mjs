#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";

const usage = `usage: release-notes.mjs [CHANGELOG]

Prints the newest release in CHANGELOG (default: src/content/ocellus/changelog.ts)
as Markdown, for gh release create VERSION --notes-file -.
Exits 1 when the newest version is not YYYY.MM.DD or YYYY.MM.DD.N, or repeats
an earlier release's version.
`;

const VERSION = /^\d{4}\.\d{2}\.\d{2}(\.[1-9]\d*)?$/;

if (process.argv.length > 3 || process.argv[2]?.startsWith("-")) {
  process.stderr.write(usage);
  process.exit(2);
}
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.resolve(process.argv[2] ?? path.join(root, "src/content/ocellus/changelog.ts"));
const { CHANGELOG } = await tsImport(pathToFileURL(file).href, import.meta.url);
const [newest, ...earlier] = CHANGELOG;

const problem = !VERSION.test(newest.version)
  ? `newest version ${JSON.stringify(newest.version)} is not YYYY.MM.DD or YYYY.MM.DD.N`
  : earlier.some((release) => release.version === newest.version)
    ? `newest version ${newest.version} repeats an earlier release`
    : null;
if (problem !== null) {
  process.stderr.write(`release-notes: ${problem}\n`);
  process.exit(1);
}
process.stdout.write(`## ${newest.version}\n\n${newest.notes.map((note) => `- ${note}`).join("\n")}\n`);
