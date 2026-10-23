#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const usage = `usage: shell-test-runs-entry.mjs [ROOT]

Every *.test.sh under ROOT (default: the current directory) must run the
script it tests as a process. The script's path, and every variable that
resolves to it, may appear only where it runs: as the command itself, or as
the word right after bash, sh or node, behind if, !, command, env, timeout
and the other wrappers whose options the check knows. Every other appearance
is a finding, whatever command, redirect, here-string or here-document
carries it, because a test that can read the script's text can run extracted
pieces under its own shell options. Exits 0 when every test only runs its
script and 1 on a finding. Without a finding it exits 2 when a test names a
path the check cannot resolve or redefines a command the rule trusts. It also
exits 2 when a test cannot be parsed or names no script under test, and when
ROOT holds no shell tests.
`;

const INTERPRETERS = new Set(["bash", "sh", "node"]);
const DECLARATIONS = new Set(["export", "local", "readonly", "declare", "typeset"]);
const wrapper = ({ flags = [], valued = [], split = [], duration = false, assignments = false } = {}) => ({
  flags: new Set(flags),
  valued: new Set(valued),
  split: new Set(split),
  duration,
  assignments,
});
// Words that run the command after their options. An option outside these sets leaves the run slot unknown, so the rest of the command is denied.
const WRAPPERS = new Map([
  ...["!", "{", "if", "then", "elif", "else", "do", "while", "until", "nohup", "builtin"].map((word) => [word, wrapper()]),
  ["time", wrapper({ flags: ["-p"] })],
  ["command", wrapper({ flags: ["-p"] })],
  ["exec", wrapper({ flags: ["-c", "-l"], valued: ["-a"] })],
  ["nice", wrapper({ valued: ["-n"] })],
  ["timeout", wrapper({ flags: ["--foreground", "--preserve-status", "-v", "--verbose"], valued: ["-s", "--signal", "-k", "--kill-after"], duration: true })],
  ["env", wrapper({ flags: ["-i", "--ignore-environment"], valued: ["-u", "--unset", "-C", "--chdir"], split: ["-S", "--split-string"], assignments: true })],
]);
const TRUSTED = new Set([...INTERPRETERS, ...WRAPPERS.keys()]);
const ASSIGNMENT = /^([A-Za-z_]\w*)(?:\[[^\]]*\])?\+?=/;
const IDENTIFIER = /^[A-Za-z_]\w*$/;
const DURATION = /^\d+(?:\.\d+)?[smhd]?$/;
const SPLIT_STRING = /^[\w./=:+-]+(?: +[\w./=:+-]+)*$/;
const SCRIPT_PATH = /[\w.-]+\.(?:sh|mjs|cjs|js)\b/g;
const DYNAMIC_PATH = /(?:\$\w+|\$\{[^}]*\}|\$\(\)|[})])[\w.-]*\.(?:sh|mjs|cjs|js)\b/g;
const ANSI_ESCAPES = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };

class ShellSyntax extends Error {
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

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

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function ansiC(body) {
  return body.replace(/\\(x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3}|c.|.)/gs, (escape, code) => {
    if (/^[xuU]/.test(code)) {
      const point = parseInt(code.slice(1), 16);
      return point <= 0x10ffff ? String.fromCodePoint(point) : escape;
    }
    if (/^[0-7]/.test(code)) return String.fromCharCode(parseInt(code, 8));
    if (code[0] === "c" && code.length === 2) return String.fromCharCode(code.charCodeAt(1) & 31);
    return ANSI_ESCAPES[code] ?? escape;
  });
}

// A word's surface is its text after quote removal, with every command substitution shown as $().
// pattern matches the word's last path component when unquoted glob or brace characters make it a pattern.
function parseShell(text) {
  const commands = [];
  const bodies = [];
  const functions = [];
  const pendingBodies = [];
  const closers = [];
  let at = 0;
  let line = 1;

  function readBodies() {
    while (pendingBodies.length > 0) {
      const { delimiter, stripTabs } = pendingBodies.shift();
      while (at < text.length) {
        const newline = text.indexOf("\n", at);
        const end = newline === -1 ? text.length : newline;
        const row = text.slice(at, end);
        const number = line;
        at = end + 1;
        line++;
        if ((stripTabs ? row.replace(/^\t+/, "") : row) === delimiter) break;
        bodies.push({ line: number, text: row });
      }
    }
  }

  function closingParen(from) {
    let depth = 0;
    for (let index = from; index < text.length; index++) {
      if (text[index] === "(") depth++;
      if (text[index] === ")" && --depth === 0) return index;
    }
    throw new ShellSyntax("unterminated (", line);
  }

  function readWord() {
    const start = at;
    const startLine = line;
    const components = [""];
    let surface = "";
    let glob = false;
    let braces = 0;
    const literal = (chars) => {
      for (const char of chars) {
        if (char === "/") components.push("");
        else components[components.length - 1] += escapeRegex(char);
      }
      surface += chars;
    };
    const wildcard = (source, raw) => {
      components[components.length - 1] += source;
      surface += raw;
      glob = true;
    };
    const substitution = (closer, skip) => {
      at += skip;
      commandList(closer);
      literal("$()");
    };
    const doubleQuoted = () => {
      at++;
      while (at < text.length && text[at] !== '"') {
        const char = text[at];
        if (char === "\\" && '$`"\\\n'.includes(text[at + 1] ?? "")) {
          if (text[at + 1] === "\n") line++;
          else literal(text[at + 1]);
          at += 2;
        } else if (char === "$" && text[at + 1] === "(") substitution(")", 2);
        else if (char === "`") substitution("`", 1);
        else {
          if (char === "\n") line++;
          literal(char);
          at++;
        }
      }
      if (at >= text.length) throw new ShellSyntax('unterminated "', startLine);
      at++;
    };

    while (at < text.length) {
      const char = text[at];
      const next = text[at + 1];
      if (braces === 0 && "<>".includes(char) && next === "(" && at === start) substitution(")", 2);
      else if (braces === 0 && char === "(" && ASSIGNMENT.test(text.slice(start, at)) && text.slice(start, at).endsWith("=")) {
        at++;
        const elements = [];
        for (;;) {
          while (at < text.length && /[ \t\n]/.test(text[at])) if (text[at++] === "\n") line++;
          if (at >= text.length) throw new ShellSyntax("unterminated array", startLine);
          if (text[at] === ")") break;
          elements.push(readWord().surface);
        }
        at++;
        literal(`(${elements.join(" ")})`);
      } else if (braces === 0 && "?*+@!".includes(char) && next === "(") {
        const end = closingParen(at + 1);
        wildcard("[^/]*", text.slice(at, end + 1));
        at = end + 1;
      } else if (braces === 0 && (/[\s;&|()<>]/.test(char) || (char === "`" && closers.at(-1) === "`"))) break;
      else if (char === "'") {
        const end = text.indexOf("'", at + 1);
        if (end === -1) throw new ShellSyntax("unterminated '", startLine);
        const quoted = text.slice(at + 1, end);
        line += quoted.split("\n").length - 1;
        literal(quoted);
        at = end + 1;
      } else if (char === "$" && next === "'") {
        let end = at + 2;
        while (end < text.length && text[end] !== "'") end += text[end] === "\\" ? 2 : 1;
        if (end >= text.length) throw new ShellSyntax("unterminated $'", startLine);
        const quoted = text.slice(at + 2, end);
        line += quoted.split("\n").length - 1;
        literal(ansiC(quoted));
        at = end + 1;
      } else if (char === '"') doubleQuoted();
      else if (char === "$" && next === '"') {
        at++;
        doubleQuoted();
      } else if (char === "\\") {
        if (next === "\n") line++;
        else if (next !== undefined) literal(next);
        at += 2;
      } else if (char === "$" && next === "(") substitution(")", 2);
      else if (char === "`") substitution("`", 1);
      else if (char === "$" && next === "{") {
        literal("${");
        braces++;
        at += 2;
      } else if (char === "}" && braces > 0) {
        literal("}");
        braces--;
        at++;
      } else if (braces === 0 && (char === "*" || char === "?")) {
        wildcard(char === "*" ? "[^/]*" : "[^/]", char);
        at++;
      } else if (braces === 0 && char === "[" && /^\[!?[^\s\]]+\]/.test(text.slice(at))) {
        const raw = text.slice(at).match(/^\[!?[^\s\]]+\]/)[0];
        wildcard(`[${raw.slice(1, -1).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`, raw);
        at += raw.length;
      } else if (braces === 0 && char === "{" && /^\{[^\s'"$`{}]*[,.][^\s'"$`{}]*\}/.test(text.slice(at))) {
        const raw = text.slice(at).match(/^\{[^\s'"$`{}]*\}/)[0];
        const body = raw.slice(1, -1);
        if (body.includes(",") && !body.includes("..") && !body.includes("/")) wildcard(`(?:${body.split(",").map(escapeRegex).join("|")})`, raw);
        else if (body.includes(",") || body.includes("..")) wildcard("[^/]*", raw);
        else literal(raw);
        at += raw.length;
      } else {
        if (char === "\n") line++;
        literal(char);
        at++;
      }
    }
    if (braces > 0) throw new ShellSyntax("unterminated ${", startLine);
    let pattern = null;
    if (glob) {
      try {
        pattern = new RegExp(`^${components.at(-1)}$`);
      } catch {
        pattern = null;
      }
    }
    return { line: startLine, raw: text.slice(start, at), surface, pattern };
  }

  function commandList(closer) {
    closers.push(closer);
    let command = { words: [], redirects: [] };
    let pending = null;
    let depth = 0;
    const finish = () => {
      if (command.words.length > 0 || command.redirects.length > 0) commands.push(command);
      command = { words: [], redirects: [] };
      pending = null;
    };
    while (at < text.length) {
      const char = text[at];
      if (char === " " || char === "\t") at++;
      else if (char === "\\" && text[at + 1] === "\n") {
        at += 2;
        line++;
      } else if (char === "\n") {
        at++;
        line++;
        finish();
        readBodies();
      } else if (char === "#") {
        while (at < text.length && text[at] !== "\n") at++;
      } else if (char === "`" && closer === "`") {
        at++;
        finish();
        closers.pop();
        return;
      } else if (char === ")") {
        at++;
        finish();
        if (depth === 0 && closer === ")") {
          closers.pop();
          return;
        }
        depth = Math.max(0, depth - 1);
      } else if (char === "(") {
        at++;
        const empty = text.slice(at).match(/^[ \t]*\)/);
        const words = command.words;
        if (empty && (words.length === 1 || (words.length === 2 && words[0].surface === "function"))) {
          functions.push(words.at(-1).surface);
          at += empty[0].length;
        } else depth++;
        finish();
      } else {
        const redirect = /(?:\d+|\{\w+\})?(<<<|<<-|<<|<>|<&|>>|>\||>&|&>>|&>|<(?!\()|>(?!\())/y;
        redirect.lastIndex = at;
        const operator = redirect.exec(text);
        if (operator) {
          at = redirect.lastIndex;
          const kind = operator[1];
          pending = kind.startsWith("<<") && kind !== "<<<" ? { heredoc: kind === "<<-" } : { use: kind === "<<<" ? "a here-string" : "a redirect" };
        } else if (";&|".includes(char)) {
          at++;
          if (";&|".includes(text[at] ?? "") && !(text[at] === "&" && text[at + 1] === ">")) at++;
          finish();
        } else {
          const word = readWord();
          if (pending === null) command.words.push(word);
          else if ("heredoc" in pending) pendingBodies.push({ delimiter: word.surface, stripTabs: pending.heredoc });
          else command.redirects.push({ use: pending.use, word });
          pending = null;
        }
      }
    }
    if (closer !== null) throw new ShellSyntax(`unterminated ${closer === ")" ? "$(" : "`"}`, line);
    finish();
    closers.pop();
  }

  commandList(null);
  return { commands, bodies, functions };
}

function nameOf(word) {
  return path.posix.basename(word.surface) || word.surface;
}

function splitString(word) {
  const value = word.surface.trim();
  if (!SPLIT_STRING.test(value)) return null;
  return value.split(/ +/).map((part) => ({ line: word.line, raw: part, surface: part, pattern: null }));
}

function unwrap(rules, words) {
  const options = [];
  const rest = [...words];
  let ended = false;
  for (;;) {
    const word = rest[0];
    if (word === undefined) break;
    const option = word.surface;
    if (!ended && option === "--") {
      options.push(rest.shift());
      ended = true;
    } else if (!ended && option.startsWith("-")) {
      if (rules.flags.has(option)) options.push(rest.shift());
      else if (rules.valued.has(option) && rest.length > 1) options.push(rest.shift(), rest.shift());
      else if (rules.split.has(option) && rest.length > 1) {
        const parts = splitString(rest[1]);
        if (parts === null) return null;
        options.push(rest.shift(), rest.shift());
        rest.unshift(...parts);
      } else return null;
    } else if (rules.assignments && ASSIGNMENT.test(word.raw)) options.push(rest.shift());
    else break;
  }
  if (rules.duration) {
    if (rest[0] === undefined || !DURATION.test(rest[0].surface)) return null;
    options.push(rest.shift());
  }
  return { options, rest };
}

function classify(words) {
  const definitions = [];
  const denied = [];
  let run = words;
  for (;;) {
    while (run.length > 0 && ASSIGNMENT.test(run[0].raw)) {
      definitions.push(run[0]);
      run = run.slice(1);
    }
    if (run.length === 0 || !WRAPPERS.has(run[0].surface)) break;
    const [head, ...after] = run;
    const unwrapped = unwrap(WRAPPERS.get(head.surface), after);
    if (unwrapped === null) {
      denied.push(...after.map((word) => ({ word, use: nameOf(head) })));
      return { definitions, denied };
    }
    denied.push(...unwrapped.options.map((word) => ({ word, use: nameOf(head) })));
    run = unwrapped.rest;
  }
  const [program, ...args] = run;
  if (program === undefined) return { definitions, denied };
  if (DECLARATIONS.has(program.surface)) {
    for (const word of args) {
      if (ASSIGNMENT.test(word.raw)) definitions.push(word);
      else if (!IDENTIFIER.test(word.surface)) denied.push({ word, use: nameOf(program) });
    }
    return { definitions, denied };
  }
  const free = INTERPRETERS.has(program.surface) ? 1 : 0;
  denied.push(...args.slice(free).map((word) => ({ word, use: nameOf(program) })));
  return { definitions, denied };
}

function redefines(words) {
  const [program, ...args] = words;
  switch (program?.surface) {
    case "function":
      return args.slice(0, 1).map((word) => word.surface);
    case "alias":
      return args.map((word) => word.surface.split("=")[0]);
    case "hash":
      return args.filter((word) => !word.surface.startsWith("-")).map(nameOf);
    default:
      return [];
  }
}

function valueOf(definition) {
  const surface = definition.surface.slice(definition.surface.indexOf("=") + 1);
  return { ...definition, surface, pattern: null };
}

function scriptsIn(surface) {
  return [...surface.matchAll(SCRIPT_PATH)].map((match) => match[0]).filter((name) => !name.endsWith(".test.sh"));
}

function dynamicPath(surface) {
  return [...surface.matchAll(DYNAMIC_PATH)].map((match) => match[0]).find((name) => !name.endsWith(".test.sh"));
}

function appearance(word, guarded) {
  for (const [variable, script] of guarded.variables) {
    if (new RegExp(`\\b${variable}\\b`).test(word.surface)) return script;
  }
  for (const script of guarded.scripts) {
    if (scriptsIn(word.surface).includes(script) || word.pattern?.test(script)) return script;
  }
  return null;
}

function check(where, text) {
  let parsed;
  try {
    parsed = parseShell(text);
  } catch (error) {
    if (error instanceof ShellSyntax) refuse(`${where}:${error.line}: cannot parse the test: ${error.message}`);
    throw error;
  }
  const classified = parsed.commands.map((command) => ({ command, ...classify(command.words) }));
  const definitions = classified.flatMap((entry) => entry.definitions);

  const undecided = [];
  const guarded = { variables: new Map(), scripts: new Set() };
  for (const definition of definitions) {
    const value = valueOf(definition);
    const dynamic = dynamicPath(value.surface);
    if (dynamic !== undefined) undecided.push(`${where}:${definition.line}: cannot tell which script ${dynamic} names; assign the script's literal file name`);
    const scripts = scriptsIn(value.surface);
    if (scripts.length === 0) continue;
    guarded.variables.set(definition.raw.match(ASSIGNMENT)[1], scripts.at(-1));
    for (const script of scripts) guarded.scripts.add(script);
  }
  if (guarded.variables.size === 0) refuse(`${where} names no script under test; assign its path to a variable such as SCRIPT`);
  for (let grew = true; grew; ) {
    grew = false;
    for (const definition of definitions) {
      const variable = definition.raw.match(ASSIGNMENT)[1];
      const script = guarded.variables.has(variable) ? null : appearance(valueOf(definition), guarded);
      if (script !== null) {
        guarded.variables.set(variable, script);
        grew = true;
      }
    }
  }

  const shadowed = [...parsed.functions, ...parsed.commands.flatMap((command) => redefines(command.words))].find((name) => TRUSTED.has(name));
  if (shadowed !== undefined) undecided.push(`${where} redefines ${shadowed}, so the check cannot tell what runs the script`);

  const findings = [];
  const uses = classified.flatMap((entry) => [...entry.denied, ...entry.command.redirects]);
  for (const { word, use } of uses) {
    const script = appearance(word, guarded);
    if (script !== null) {
      findings.push({ line: word.line, script, use });
      continue;
    }
    const dynamic = dynamicPath(word.surface);
    if (dynamic !== undefined) undecided.push(`${where}:${word.line}: cannot tell whether ${dynamic} names the script under test`);
    if (word.surface.includes("/") && TRUSTED.has(nameOf(word))) undecided.push(`${where}:${word.line}: writes or names a file called ${nameOf(word)}, so the check cannot tell what runs the script`);
  }
  for (const body of parsed.bodies) {
    const script = appearance({ line: body.line, raw: body.text, surface: body.text, pattern: null }, guarded);
    if (script !== null) findings.push({ line: body.line, script, use: "a here-document" });
  }
  const messages = findings
    .sort((a, b) => a.line - b.line)
    .map(({ line, script, use }) => `${where}:${line}: uses ${script} with ${use}; run it only as the program, as in bash ${script}, so its own shell options apply`);
  return { findings: [...new Set(messages)], undecided };
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
const undecided = [];
for (const file of tests) {
  const where = path.relative(root, file);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    refuse(`cannot read ${where}: ${error.message}`);
  }
  const result = check(where, text);
  findings.push(...result.findings);
  undecided.push(...result.undecided);
}

for (const finding of findings) console.log(finding);
console.log(`shell-test-runs-entry: ${findings.length} finding(s) in ${tests.length} shell test(s)`);
if (findings.length > 0) process.exit(1);
if (undecided.length > 0) refuse(undecided.join("\nshell-test-runs-entry: "));
process.exit(0);
