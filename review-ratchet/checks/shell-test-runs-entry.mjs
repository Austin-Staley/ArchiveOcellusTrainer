#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const usage = `usage: shell-test-runs-entry.mjs [ROOT]

Every *.test.sh under ROOT (default: the current directory) must run the
script it tests as a process. Reading that script's text, with sed, grep,
awk, cat, source and the like, lets the test run extracted pieces under its
own shell options instead of the script's. A reader counts behind prefixes
such as command, builtin, env, timeout and if, and when quoted, escaped or
named by path. Exits 0 when every test runs its script, 1 on a test that
reads it, and 2 when a test names no script under test or ROOT holds no
shell tests.
`;

const READERS = new Set(["sed", "grep", "egrep", "fgrep", "awk", "gawk", "cat", "head", "tail", "cut", "perl", "python", "python3", "source", ".", "mapfile", "readarray"]);
const NO_VALUES = new Set();
// Words that run the next word as the command, with the options that take a separate value.
const PREFIXES = new Map([
  ...["!", "{", "if", "then", "elif", "else", "do", "while", "until", "time", "command", "builtin", "nohup"].map((word) => [word, NO_VALUES]),
  ["exec", new Set(["-a"])],
  ["env", new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"])],
  ["nice", new Set(["-n", "--adjustment"])],
  ["timeout", new Set(["-s", "--signal", "-k", "--kill-after"])],
  ["stdbuf", new Set(["-i", "-o", "-e"])],
  ["sudo", new Set(["-u", "--user", "-g", "--group", "-C", "-D", "-h", "-p", "-r", "-t", "-U"])],
]);
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const DURATION = /^\d+(?:\.\d+)?[smhd]?$/;
const TARGET = /^\s*(?:readonly\s+|local\s+|export\s+)?([A-Za-z_]\w*)=(.*)$/;
const SCRIPT_PATH = /[\w.-]+\.(?:sh|mjs|cjs|js)\b/g;

function refuse(message) {
  process.stderr.write(`shell-test-runs-entry: ${message}\n`);
  process.exit(2);
}

function shellTests(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".git") return [];
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return shellTests(file);
    return entry.name.endsWith(".test.sh") ? [file] : [];
  });
}

function codeLines(text) {
  const lines = [];
  let heredoc = null;
  text.split("\n").forEach((line, index) => {
    if (heredoc !== null) {
      if (line.replace(/^\t+/, "") === heredoc) heredoc = null;
      return;
    }
    if (/^\s*#/.test(line)) return;
    lines.push({ number: index + 1, line });
    const opened = line.match(/<<-?\s*['"]?(\w+)['"]?/);
    if (opened) heredoc = opened[1];
  });
  return lines;
}

function scriptsUnderTest(lines) {
  const targets = new Map();
  for (const { line } of lines) {
    const assignment = line.match(TARGET);
    if (!assignment) continue;
    const scripts = [...assignment[2].matchAll(SCRIPT_PATH)].map((match) => match[0]).filter((name) => !name.endsWith(".test.sh"));
    if (scripts.length > 0) targets.set(assignment[1], scripts.at(-1));
  }
  return targets;
}

function segments(line) {
  const found = [];
  const contexts = [{ quote: null }];
  let current = "";
  const cut = () => {
    found.push(current);
    current = "";
  };
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const context = contexts[contexts.length - 1];
    if (context.quote === "'") {
      current += char;
      if (char === "'") context.quote = null;
    } else if (char === "\\") {
      current += char + (line[index + 1] ?? "");
      index++;
    } else if (char === "$" && line[index + 1] === "(") {
      cut();
      contexts.push({ quote: null });
      index++;
    } else if (char === "`") {
      cut();
    } else if (context.quote === '"') {
      current += char;
      if (char === '"') context.quote = null;
    } else if (char === "'" || char === '"') {
      context.quote = char;
      current += char;
    } else if (char === ")" && contexts.length > 1) {
      cut();
      contexts.pop();
    } else if ("|;&()".includes(char)) {
      cut();
    } else {
      current += char;
    }
  }
  cut();
  return found;
}

function command(segment) {
  const words = segment.trim().split(/\s+/).map((word) => word.replace(/["'\\]/g, ""));
  let valued = null;
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (ASSIGNMENT.test(word)) continue;
    if (valued !== null && word.startsWith("-")) {
      if (valued.has(word)) index++;
      continue;
    }
    if (valued !== null && DURATION.test(word)) continue;
    const name = path.posix.basename(word);
    if (!PREFIXES.has(name)) return name;
    valued = PREFIXES.get(name);
  }
  return "";
}

function readsOf(line, variable) {
  const reference = new RegExp(`\\$\\{?${variable}\\b`);
  if (!reference.test(line)) return null;
  if (new RegExp(`<\\s*"?\\$\\{?${variable}\\b`).test(line)) return "a redirect";
  const reader = segments(line).find((segment) => reference.test(segment) && READERS.has(command(segment)));
  return reader === undefined ? null : command(reader);
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(usage);
  process.exit(0);
}
if (args.length > 1) refuse(`expected at most one ROOT\n${usage}`);
const root = path.resolve(args[0] ?? ".");
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) refuse(`ROOT is not a directory: ${root}`);

const tests = shellTests(root);
if (tests.length === 0) refuse(`no *.test.sh under ${root}`);

const findings = [];
for (const file of tests) {
  const where = path.relative(root, file);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    refuse(`cannot read ${where}: ${error.message}`);
  }
  const lines = codeLines(text);
  const targets = scriptsUnderTest(lines);
  if (targets.size === 0) refuse(`${where} names no script under test; assign its path to a variable such as SCRIPT`);
  for (const { number, line } of lines) {
    for (const [variable, script] of targets) {
      const reader = readsOf(line, variable);
      if (reader !== null) findings.push(`${where}:${number}: reads the text of ${script} with ${reader}; run it as a process so its own shell options apply`);
    }
  }
}

for (const finding of findings) console.log(finding);
console.log(`shell-test-runs-entry: ${findings.length} finding(s) in ${tests.length} shell test(s)`);
process.exit(findings.length === 0 ? 0 : 1);
