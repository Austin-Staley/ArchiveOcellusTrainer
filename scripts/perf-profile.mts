import { spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, loadavg } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createGunzip } from "node:zlib";
import { SourceMapConsumer } from "source-map";

const require = createRequire(import.meta.url);

type Workload = "idle" | "busy";

type Bucket =
  | "engine-sdk"
  | "engine-ocellus"
  | "pathing"
  | "input"
  | "react"
  | "three"
  | "composite"
  | "assets"
  | "hud"
  | "gc"
  | "idle"
  | "other";

type Owner = "sdk" | "ocellus" | "react" | "three" | "browser" | "other";

type MappedFrame = {
  readonly name: string;
  readonly url: string;
  readonly line: number;
  readonly column: number;
  readonly owner: Owner;
  readonly bucket: Bucket;
  readonly caller: string;
  readonly callerFile: string;
  readonly callerLine: number;
  readonly approximate: boolean;
};

type HotFunction = {
  readonly name: string;
  readonly file: string;
  readonly line: number;
  readonly caller: string;
  readonly callerFile: string;
  readonly callerLine: number;
  readonly owner: Owner;
  readonly bucket: Bucket;
  readonly selfMs: number;
  readonly selfShare: number;
  readonly approximate: boolean;
};

type ProfileSummary = {
  readonly sampleMs: number;
  readonly selfByBucket: Readonly<Record<Bucket, number>>;
  readonly hot: readonly HotFunction[];
  readonly unmappedShare: number;
};

type FrameStats = {
  readonly count: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly over16Ms: number;
  readonly over33Ms: number;
  readonly over50Ms: number;
};

type ProbeProof = {
  readonly kind: "probe";
  readonly startTick: number;
  readonly endTick: number;
  readonly tickDelta: number;
  readonly rows: number;
  readonly bossHpStart: number;
  readonly bossHpEnd: number;
  readonly distinctTiles: number;
  readonly clicks: number;
  readonly clickMisses: number;
  readonly walkOrders: number;
  readonly combatDraws: number;
  readonly events: Readonly<Record<string, number>>;
  readonly fightKind: string;
  readonly visibleAtEnd: boolean;
  readonly pageErrors: readonly string[];
  readonly consoleErrors: readonly string[];
};

type SceneProof = {
  readonly kind: "scene";
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly nonZeroSamples: number;
  readonly clicks: number;
  readonly clickMisses: number;
  readonly pageErrors: readonly string[];
  readonly consoleErrors: readonly string[];
};

type FightProof = ProbeProof | SceneProof;

type Pixel = {
  readonly x: number;
  readonly y: number;
};

type DrawImageStat = {
  readonly count: number;
  readonly ms: number;
  readonly bigCount: number;
  readonly bigMs: number;
  readonly firstBlitMs: number;
  readonly secondBlitMs: number;
  readonly stack: string;
};

type HeapSample = {
  readonly startBytes: number | null;
  readonly endBytes: number | null;
  readonly growthBytes: number | null;
};

type BrowserRun = {
  readonly label: string;
  readonly url: string;
  readonly renderer: string;
  readonly readyMs: number;
  readonly fightMs: number;
  readonly frames: FrameStats;
  readonly longTasks: { readonly count: number; readonly totalMs: number; readonly maxMs: number };
  readonly heap: HeapSample;
  readonly heapSamples: readonly number[];
  readonly drawCalls: number | null;
  readonly drawImage: DrawImageStat | null;
  readonly walkPixels: readonly Pixel[];
  readonly proof: FightProof;
  readonly loadAvgStart: readonly number[];
  readonly loadAvg: readonly number[];
};

type HeadlessRun = {
  readonly workload: Workload;
  readonly ticks: number;
  readonly seconds: number;
  readonly ticksPerSecond: number;
  readonly rows: number;
  readonly bossHpStart: number;
  readonly bossHpEnd: number;
  readonly playerMoves: number;
  readonly errors: readonly string[];
};

const SCENE_OFFSETS: readonly Pixel[] = [
  { x: -160, y: -50 },
  { x: 120, y: -40 },
  { x: -80, y: 70 },
  { x: 40, y: 90 },
  { x: -140, y: 20 },
  { x: 160, y: -20 },
  { x: 0, y: 110 },
];

const WALK_TILES: readonly { readonly x: number; readonly y: number }[] = [
  { x: 8, y: 3 },
  { x: 6, y: 1 },
  { x: 5, y: 5 },
  { x: 4, y: 3 },
  { x: 7, y: 5 },
  { x: 3, y: 2 },
  { x: 5, y: 1 },
];

function emptyBuckets(): Record<Bucket, number> {
  return {
    "engine-sdk": 0,
    "engine-ocellus": 0,
    pathing: 0,
    input: 0,
    react: 0,
    three: 0,
    composite: 0,
    assets: 0,
    hud: 0,
    gc: 0,
    idle: 0,
    other: 0,
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[index] ?? 0;
}

function frameStats(samples: readonly number[]): FrameStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const over = (limit: number) => sorted.filter((value) => value > limit).length;
  return {
    count: sorted.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted[sorted.length - 1] ?? 0,
    over16Ms: over(16.7),
    over33Ms: over(33.4),
    over50Ms: over(50),
  };
}

function numberArg(argv: readonly string[], name: string, fallback: number): number {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const raw = argv[index + 1];
  const value = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} needs a positive number`);
  return value;
}

function stringArg(argv: readonly string[], name: string, fallback: string): string {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

function flag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} is not a finite number`);
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is not a string`);
  return value;
}

function parsePixel(value: unknown): Pixel | null {
  if (!isRecord(value)) return null;
  if (typeof value.x !== "number" || typeof value.y !== "number") return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y };
}

function parsePixels(value: unknown): readonly Pixel[] {
  if (!Array.isArray(value)) throw new Error("pixels file is not a list");
  return value.map((entry, index) => {
    const pixel = parsePixel(entry);
    if (!pixel) throw new Error(`pixel ${index} is not a point`);
    return pixel;
  });
}

type CallFrame = {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
};

type ProfileNode = {
  readonly id: number;
  readonly callFrame: CallFrame;
  readonly children: readonly number[];
};

type CpuProfile = {
  readonly nodes: readonly ProfileNode[];
  readonly samples: readonly number[];
  readonly timeDeltas: readonly number[];
};

function parseCallFrame(value: unknown): CallFrame {
  if (!isRecord(value)) throw new Error("profile call frame is not an object");
  return {
    functionName: readString(value.functionName ?? "", "functionName"),
    url: readString(value.url ?? "", "url"),
    lineNumber: readNumber(value.lineNumber ?? -1, "lineNumber"),
    columnNumber: readNumber(value.columnNumber ?? -1, "columnNumber"),
  };
}

function parseProfile(value: unknown): CpuProfile {
  if (!isRecord(value)) throw new Error("CPU profile is not an object");
  if (!Array.isArray(value.nodes) || !Array.isArray(value.samples) || !Array.isArray(value.timeDeltas)) {
    throw new Error("CPU profile is missing nodes, samples, or timeDeltas");
  }
  const nodes = value.nodes.map((node): ProfileNode => {
    if (!isRecord(node)) throw new Error("profile node is not an object");
    const children = Array.isArray(node.children) ? node.children.map((child) => readNumber(child, "child")) : [];
    return { id: readNumber(node.id, "node id"), callFrame: parseCallFrame(node.callFrame), children };
  });
  return {
    nodes,
    samples: value.samples.map((sample) => readNumber(sample, "sample")),
    timeDeltas: value.timeDeltas.map((delta) => readNumber(delta, "timeDelta")),
  };
}

type SourceMap = {
  readonly consumer: SourceMapConsumer;
  readonly raw: string;
};

const mapCache = new Map<string, Promise<SourceMap | null>>();

async function loadMap(urlOrPath: string): Promise<SourceMap | null> {
  const cached = mapCache.get(urlOrPath);
  if (cached) return cached;
  const pending = readMap(urlOrPath);
  mapCache.set(urlOrPath, pending);
  return pending;
}

async function readMap(urlOrPath: string): Promise<SourceMap | null> {
  try {
    const raw = urlOrPath.startsWith("http")
      ? await (await fetch(urlOrPath)).text()
      : await readFile(urlOrPath, "utf8");
    if (!raw.includes('"mappings"')) return null;
    const consumer = await new SourceMapConsumer(raw);
    return { consumer, raw };
  } catch {
    return null;
  }
}

function mapComment(source: string): string | null {
  const matches = [...source.matchAll(/[@#]\s*sourceMappingURL=([^\s]+)/g)];
  return matches[matches.length - 1]?.[1] ?? null;
}

async function mapForScript(scriptUrl: string): Promise<SourceMap | null> {
  if (!scriptUrl.startsWith("http")) return null;
  const script = await loadMap(scriptUrl);
  if (script) return script;
  try {
    const body = await (await fetch(scriptUrl)).text();
    const comment = mapComment(body);
    if (!comment) return null;
    const mapUrl = new URL(comment, scriptUrl).href;
    return await loadMap(mapUrl);
  } catch {
    return null;
  }
}

function ownerOf(url: string): Owner {
  const path = url.replaceAll("\\", "/");
  if (path.includes("node_modules/react") || path.includes("react-dom") || path.includes("/scheduler/")) return "react";
  if (path.includes("node_modules/three") || path.includes("/three/build") || path.includes("/three/src")) return "three";
  if (path.includes("osrs-sdk/src") || path.includes("/src/sdk/") || path.includes("OldSchoolSDK")) return "sdk";
  if (path.includes("node_modules/osrs-sdk")) return "sdk";
  if (
    path.includes("/src/content/ocellus/") ||
    path.includes("/src/sim/") ||
    path.includes("/src/ArchiveOcellus") ||
    path.includes("/src/telemetry/") ||
    path.includes("/src/hoverText")
  ) {
    return "ocellus";
  }
  if (path.startsWith("native ") || path === "" || path.includes("node:internal")) return "browser";
  return "other";
}

function includesAny(value: string, parts: readonly string[]): boolean {
  return parts.some((part) => value.includes(part));
}

function bucketOf(frame: { readonly name: string; readonly url: string }, owner: Owner): Bucket {
  const name = frame.name;
  const url = frame.url;
  const blob = `${name} ${url}`;
  if (name === "(idle)" || name === "(program)" || name === "(root)") return "idle";
  if (name === "(garbage collector)" || name === "(gc)") return "gc";
  if (name === "drawImage") return "composite";
  if (includesAny(name, ["bufferSubData", "drawElements", "drawArrays", "getProgramInfoLog", "texImage2D", "compressedTexImage2D"])) return "three";
  if (name === "getBoundingClientRect") return "hud";
  if (includesAny(blob, ["Pathing", "Collision", "LineOfSight", "constructPaths"])) return "pathing";
  if (includesAny(blob, ["InputController", "ClickController", "queueAction", "playerWalkClick", "playerAttackClick"])) return "input";
  if (includesAny(blob, ["GLTFLoader", "TextureLoader", "FileLoader", "ImageLoader", "decodeAudioData", "AudioBuffer"])) return "assets";
  if (owner === "react" || url.includes("osrs-sdk-react") || url.endsWith(".tsx")) return "react";
  if (owner === "three" || url.includes("/rendering/") || includesAny(name, ["WebGLRenderer", "WebGLUniforms", "WebGLBindingStates"])) return "three";
  if (includesAny(blob, ["ControlPanel", "MapController", "ContextMenu", "XpDrop", "drawBossHealth", "ClickAnimation"])) return "hud";
  if (owner === "ocellus") return "engine-ocellus";
  if (owner === "sdk") return "engine-sdk";
  return "other";
}

type MapPosition = {
  readonly source: string;
  readonly line: number;
  readonly column: number;
  readonly name: string | null;
};

type Located = {
  readonly position: MapPosition;
  readonly approximate: boolean;
};

function locate(consumer: SourceMapConsumer, line: number, column: number): Located | null {
  const read = (atLine: number, atColumn: number, bias: number): MapPosition | null => {
    const found = consumer.originalPositionFor({ line: atLine, column: atColumn, bias });
    if (found.source === null || found.line === null) return null;
    return { source: found.source, line: found.line, column: found.column ?? 0, name: found.name };
  };
  const onLine = read(line, column, SourceMapConsumer.GREATEST_LOWER_BOUND) ?? read(line, column, SourceMapConsumer.LEAST_UPPER_BOUND);
  if (onLine) return { position: onLine, approximate: false };
  for (let delta = 1; delta <= 8; delta += 1) {
    const found = read(Math.max(1, line - delta), 0, SourceMapConsumer.GREATEST_LOWER_BOUND);
    if (found) return { position: found, approximate: true };
  }
  return null;
}

type ResolvedFrame = {
  readonly name: string;
  readonly url: string;
  readonly line: number;
  readonly column: number;
  readonly approximate: boolean;
};

async function chainSdk(url: string, line: number, column: number): Promise<Located | null> {
  if (!url.includes("osrs-sdk/_bundles/main.js") && !url.endsWith("/_bundles/main.js")) return null;
  const sdkMap = await loadMap(resolve("node_modules/osrs-sdk/_bundles/main.js.map"));
  if (!sdkMap) return null;
  return locate(sdkMap.consumer, line, column);
}

async function originalFrame(frame: CallFrame): Promise<ResolvedFrame> {
  const generated: ResolvedFrame = {
    name: frame.functionName === "" ? "(anonymous)" : frame.functionName,
    url: frame.url,
    line: frame.lineNumber + 1,
    column: frame.columnNumber,
    approximate: false,
  };
  const map = await mapForScript(frame.url);
  if (!map || frame.lineNumber < 0) return generated;
  const position = locate(map.consumer, frame.lineNumber + 1, Math.max(0, frame.columnNumber));
  if (position === null) return generated;
  let line = position.position.line;
  let column = position.position.column;
  let url = position.position.source;
  let name = position.position.name && position.position.name !== "" ? position.position.name : generated.name;
  let approximate = position.approximate;
  const inner = await chainSdk(url, line, column);
  if (inner) {
    url = inner.position.source;
    line = inner.position.line;
    column = inner.position.column;
    if (inner.position.name && inner.position.name !== "") name = inner.position.name;
    approximate = approximate || inner.approximate;
  }
  return { name, url, line, column, approximate };
}

async function summariseProfile(profile: CpuProfile): Promise<ProfileSummary> {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parentOf = new Map<number, number>();
  for (const node of profile.nodes) for (const child of node.children) parentOf.set(child, node.id);
  const mapped = new Map<number, MappedFrame>();
  const frameFor = async (node: ProfileNode): Promise<MappedFrame> => {
    const cached = mapped.get(node.id);
    if (cached) return cached;
    const original = await originalFrame(node.callFrame);
    const owner = ownerOf(original.url);
    const bucket = bucketOf(original, owner);
    const placeholder: MappedFrame = {
      name: original.name,
      url: original.url,
      line: original.line,
      column: original.column,
      owner,
      bucket,
      caller: "",
      callerFile: "",
      callerLine: 0,
      approximate: original.approximate,
    };
    mapped.set(node.id, placeholder);
    let caller = "";
    let callerFile = "";
    let callerLine = 0;
    if (original.url === "" || bucket === "composite" || bucket === "gc") {
      let cursorId = parentOf.get(node.id);
      for (let guard = 0; cursorId !== undefined && guard < 16; guard += 1) {
        const ancestor = byId.get(cursorId);
        if (!ancestor) break;
        const ancestorFrame = await frameFor(ancestor);
        if (ancestorFrame.url !== "") {
          caller = `${ancestorFrame.name} ${ancestorFrame.url}:${ancestorFrame.line}`;
          callerFile = ancestorFrame.url;
          callerLine = ancestorFrame.line;
          break;
        }
        cursorId = parentOf.get(ancestor.id);
      }
    }
    const callerOwner = callerFile === "" ? owner : ownerOf(callerFile);
    const resolvedOwner = original.url === "" && callerOwner !== "browser" && callerOwner !== "other" ? callerOwner : owner;
    const frame: MappedFrame = { ...placeholder, caller, callerFile, callerLine, owner: resolvedOwner };
    mapped.set(node.id, frame);
    return frame;
  };
  const selfUs = new Map<string, { readonly frame: MappedFrame; us: number }>();
  const buckets = emptyBuckets();
  let sampleUs = 0;
  let unmappedUs = 0;
  const count = Math.min(profile.samples.length, profile.timeDeltas.length);
  for (let index = 0; index < count; index += 1) {
    const delta = profile.timeDeltas[index] ?? 0;
    if (delta < 0) continue;
    sampleUs += delta;
    const node = byId.get(profile.samples[index] ?? -1);
    if (!node) continue;
    const frame = await frameFor(node);
    buckets[frame.bucket] += delta / 1000;
    if (frame.url === node.callFrame.url && node.callFrame.url.includes("/assets/main")) unmappedUs += delta;
    const { owner } = frame;
    const key = frame.url === ""
      ? `${frame.name}\t${frame.callerFile}\t${frame.callerLine}\t${frame.bucket}\t${owner}`
      : `${frame.name}\t${frame.url}\t${frame.line}\t${frame.bucket}\t${owner}`;
    const existing = selfUs.get(key);
    if (existing) existing.us += delta;
    else selfUs.set(key, { frame, us: delta });
  }
  const busyUs = sampleUs - buckets.idle * 1000;
  const hot = [...selfUs.values()]
    .filter((entry) => entry.frame.bucket !== "idle")
    .sort((a, b) => b.us - a.us)
    .slice(0, 10)
    .map((entry): HotFunction => ({
      name: entry.frame.name,
      file: entry.frame.url === "" ? entry.frame.callerFile : entry.frame.url,
      line: entry.frame.url === "" ? entry.frame.callerLine : entry.frame.line,
      caller: entry.frame.caller,
      callerFile: entry.frame.callerFile,
      callerLine: entry.frame.callerLine,
      owner: entry.frame.owner,
      bucket: entry.frame.bucket,
      selfMs: entry.us / 1000,
      selfShare: busyUs > 0 ? entry.us / busyUs : 0,
      approximate: entry.frame.approximate,
    }));
  return {
    sampleMs: sampleUs / 1000,
    selfByBucket: buckets,
    hot,
    unmappedShare: sampleUs > 0 ? unmappedUs / sampleUs : 0,
  };
}

const OBSERVER = `(() => {
  const state = { frames: [], longs: [], heap: [], draws: 0, mark: 0, drawImageCount: 0, drawImageMs: 0, drawImageBigCount: 0, drawImageBigMs: 0, drawImageBigAMs: 0, drawImageBigBMs: 0, drawImageStack: "" };
  const wrap = (prototype, name) => {
    const original = prototype[name];
    if (typeof original !== "function") return;
    prototype[name] = function (...args) {
      state.draws += 1;
      return original.apply(this, args);
    };
  };
  if (typeof WebGL2RenderingContext === "function") {
    wrap(WebGL2RenderingContext.prototype, "drawElements");
    wrap(WebGL2RenderingContext.prototype, "drawArrays");
  }
  if (typeof WebGLRenderingContext === "function") {
    wrap(WebGLRenderingContext.prototype, "drawElements");
    wrap(WebGLRenderingContext.prototype, "drawArrays");
  }
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longs.push({ start: entry.startTime, duration: entry.duration });
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch (error) {
    state.longtaskError = String(error);
  }
  const sampleHeap = () => {
    const memory = performance.memory;
    if (!memory) return;
    state.heap.push({ t: performance.now(), used: memory.usedJSHeapSize });
  };
  setInterval(sampleHeap, 1000);
  let last = performance.now();
  const loop = (now) => {
    state.frames.push(now - last);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame((now) => {
    last = now;
    requestAnimationFrame(loop);
  });
  window.__ocellusPerf = state;
})();`;

const INSTRUMENT = `(() => {
  const perf = window.__ocellusPerf;
  if (!perf) return;
  const original = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    const source = args[0];
    const big = (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) && source.width >= 256;
    const start = performance.now();
    const result = original.apply(this, args);
    const elapsed = performance.now() - start;
    perf.drawImageMs += elapsed;
    perf.drawImageCount += 1;
    if (big) {
      perf.drawImageBigMs += elapsed;
      if (perf.drawImageBigCount % 2 === 0) perf.drawImageBigAMs += elapsed;
      else perf.drawImageBigBMs += elapsed;
      perf.drawImageBigCount += 1;
      if (perf.drawImageStack === "" && perf.drawImageBigCount === 5) perf.drawImageStack = new Error().stack || "";
    }
    return result;
  };
})();`;

type ProbeSnap = {
  readonly tick: number;
  readonly ticking: boolean;
  readonly tile: { readonly x: number; readonly y: number } | null;
  readonly bossHp: number | null;
  readonly visible: boolean;
  readonly fightKind: string;
  readonly rows: number;
};

function parseActivity(value: unknown): { readonly walks: number; readonly combat: number; readonly events: Readonly<Record<string, number>> } {
  if (!isRecord(value) || !isRecord(value.events)) throw new Error("fight activity is not an object");
  const events: Record<string, number> = {};
  for (const [key, count] of Object.entries(value.events)) {
    if (typeof count !== "number" || !Number.isFinite(count)) throw new Error(`event count for ${key} is not a number`);
    events[key] = count;
  }
  return { walks: readNumber(value.walks, "walks"), combat: readNumber(value.combat, "combat"), events };
}

function parseProbe(value: unknown): ProbeSnap {
  if (!isRecord(value)) throw new Error("probe snapshot is not an object");
  const player = value.player;
  const tile = isRecord(player) ? { x: readNumber(player.x, "player.x"), y: readNumber(player.y, "player.y") } : null;
  const fight = value.fight;
  const boss = isRecord(fight) ? fight.boss : null;
  const run = isRecord(fight) ? fight.run : null;
  return {
    tick: readNumber(value.tick, "tick"),
    ticking: value.ticking === true,
    tile,
    bossHp: isRecord(boss) ? readNumber(boss.hp, "boss.hp") : null,
    visible: isRecord(boss) && boss.visible === true,
    fightKind: isRecord(run) ? readString(run.kind, "run.kind") : "missing",
    rows: readNumber(value.rows, "rows"),
  };
}

type CdpSession = {
  send(method: string, params?: object): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
};

type Capture = {
  readonly profile: boolean;
  readonly trace: boolean;
  readonly traceMs: number | null;
  readonly probe: boolean;
  readonly pixels: readonly Pixel[];
  readonly instrument: boolean;
};

type PageHandle = {
  goto(url: string, options: object): Promise<unknown>;
  waitForSelector(selector: string, options: object): Promise<unknown>;
  waitForFunction(pageFunction: () => boolean, options: object): Promise<unknown>;
  evaluate(pageFunction: (...args: never[]) => unknown, arg?: unknown): Promise<unknown>;
  locator(selector: string): {
    click(options: object): Promise<void>;
    boundingBox(): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null>;
  };
  waitForTimeout(ms: number): Promise<void>;
  on(event: "pageerror", handler: (error: Error) => void): void;
  on(event: "console", handler: (message: { type(): string; text(): string }) => void): void;
};

type ContextHandle = {
  addInitScript(source: string): Promise<void>;
  route(pattern: string, handler: (route: { fulfill(options: object): Promise<void> }) => Promise<void>): Promise<void>;
  newPage(): Promise<PageHandle>;
  newCDPSession(page: PageHandle): Promise<CdpSession>;
  close(): Promise<void>;
};

type LaunchedBrowser = {
  newContext(options: object): Promise<ContextHandle>;
  close(): Promise<void>;
};

async function loadPlaywright(): Promise<{ readonly chromium: { launch(options: object): Promise<LaunchedBrowser> } }> {
  const fromEnv = process.env.PLAYWRIGHT_MODULE;
  const candidates = [fromEnv, "playwright", "/tmp/pw/node_modules/playwright/index.js"].filter(
    (candidate): candidate is string => typeof candidate === "string" && candidate !== "",
  );
  let failure: unknown = new Error("playwright import did not run");
  for (const candidate of candidates) {
    try {
      const href = candidate.startsWith("/") ? pathToFileURL(candidate).href : candidate;
      const imported: unknown = await import(href);
      const api = isRecord(imported) && isRecord(imported.chromium) ? imported : isRecord(imported) && isRecord(imported.default) ? imported.default : null;
      if (!api || !isRecord(api.chromium) || typeof api.chromium.launch !== "function") {
        failure = new Error(`playwright at ${candidate} has no chromium.launch`);
        continue;
      }
      const launch = api.chromium.launch.bind(api.chromium);
      return { chromium: { launch: (options) => launch(options) } };
    } catch (error) {
      failure = error;
    }
  }
  throw new Error(`cannot load playwright: ${failure instanceof Error ? failure.message : String(failure)}`);
}

function traceComplete(client: CdpSession): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tracing.tracingComplete timed out")), 120_000);
    client.on("Tracing.tracingComplete", (params: unknown) => {
      clearTimeout(timer);
      if (!isRecord(params)) {
        reject(new Error("Tracing.tracingComplete payload is not an object"));
        return;
      }
      resolve(params);
    });
  });
}

async function startTrace(client: CdpSession): Promise<void> {
  await client.send("Tracing.start", {
    transferMode: "ReturnAsStream",
    streamFormat: "json",
    streamCompression: "gzip",
    traceConfig: {
      recordMode: "recordAsMuchAsPossible",
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "disabled-by-default-v8.gc",
        "loading",
      ],
    },
  });
}

async function writeTrace(client: CdpSession, outDir: string, label: string): Promise<{ readonly tracePath: string; readonly metaPath: string }> {
  const pending = traceComplete(client);
  await client.send("Tracing.end");
  const ended = await pending;
  if (typeof ended.stream !== "string") throw new Error("trace completed without a stream");
  const tracePath = resolve(outDir, `${label}.trace.json.gz`);
  const stream = createWriteStream(tracePath);
  let eof = false;
  let bytes = 0;
  while (!eof) {
    const chunk: unknown = await client.send("IO.read", { handle: ended.stream, size: 1024 * 1024 });
    if (!isRecord(chunk) || typeof chunk.data !== "string") throw new Error("trace stream returned no data");
    const buffer = chunk.base64Encoded === true ? Buffer.from(chunk.data, "base64") : Buffer.from(chunk.data);
    bytes += buffer.length;
    stream.write(buffer);
    eof = chunk.eof === true;
  }
  await client.send("IO.close", { handle: ended.stream });
  await new Promise((done, reject) => {
    stream.end(() => done(undefined));
    stream.on("error", reject);
  });
  const metaPath = resolve(outDir, `${label}.trace-meta.json`);
  await writeFile(metaPath, JSON.stringify({
    dataLossOccurred: ended.dataLossOccurred === true,
    traceFormat: typeof ended.traceFormat === "string" ? ended.traceFormat : "json",
    streamCompression: "gzip",
    bytes,
  }, null, 2));
  return { tracePath, metaPath };
}

async function browserRun(url: string, fightMs: number, outDir: string, label: string, capture: Capture): Promise<{ readonly run: BrowserRun; readonly profile: ProfileSummary | null; readonly tracePath: string | null; readonly profilePath: string | null }> {
  const loadAvgStart = loadavg();
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--enable-precise-memory-info",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--window-size=1280,800",
    ],
  });
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await context.addInitScript(OBSERVER);
    if (capture.instrument) await context.addInitScript(INSTRUMENT);
    await context.route("**/telemetry.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"sampleRate":0}' }));
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const started = performance.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector("#trainer-loading", { state: "detached", timeout: 180_000 });
    if (capture.probe) {
      await page.waitForFunction(() => {
        const probe = window.__archiveOcellusProbe;
        if (!probe) return false;
        const snap = probe.snapshot();
        return snap.ticking && snap.tick >= 8 && snap.fight?.run?.kind === "running";
      }, { timeout: 180_000 });
    } else {
      await page.waitForTimeout(5_000);
    }
    const readyMs = performance.now() - started;
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl");
      if (!gl) return "no-webgl";
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const value: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return typeof value === "string" ? value : "unknown";
    });
    await page.evaluate(() => {
      const perf = window.__ocellusPerf;
      if (!perf) return;
      perf.frames.length = 0;
      perf.longs.length = 0;
      perf.heap.length = 0;
      perf.draws = 0;
      perf.mark = performance.now();
      perf.drawImageCount = 0;
      perf.drawImageMs = 0;
      perf.drawImageBigCount = 0;
      perf.drawImageBigMs = 0;
      perf.drawImageBigAMs = 0;
      perf.drawImageBigBMs = 0;
      perf.drawImageStack = "";
    });
    const client = capture.profile || capture.trace ? await context.newCDPSession(page) : null;
    if (client && capture.trace) await startTrace(client);
    if (client && capture.profile) {
      await client.send("Profiler.enable");
      await client.send("Profiler.setSamplingInterval", { interval: 200 });
      await client.send("Profiler.start");
    }
    const startSnap = capture.probe
      ? parseProbe(await page.evaluate(() => {
        const probe = window.__archiveOcellusProbe;
        if (!probe) return null;
        const snap = probe.snapshot();
        return { ...snap, rows: probe.log().rows.length };
      }))
      : null;
    const tiles = new Set<string>();
    if (startSnap?.tile) tiles.add(`${startSnap.tile.x},${startSnap.tile.y}`);
    let clicks = 0;
    let clickMisses = 0;
    const walkPixels: Pixel[] = [];
    const world = page.locator("#world");
    const box = capture.probe ? null : await world.boundingBox();
    if (!capture.probe && !box) throw new Error("world canvas has no box");
    const deadline = Date.now() + fightMs;
    const traceDeadline = capture.trace && capture.traceMs !== null ? Date.now() + capture.traceMs : null;
    let tracePath: string | null = null;
    let traceClosed = false;
    const finishTrace = async () => {
      if (!client || !capture.trace || traceClosed) return;
      traceClosed = true;
      const written = await writeTrace(client, outDir, label);
      tracePath = written.tracePath;
    };
    let step = 0;
    while (Date.now() < deadline) {
      const target = WALK_TILES[step % WALK_TILES.length] ?? WALK_TILES[0];
      const offset = SCENE_OFFSETS[step % SCENE_OFFSETS.length] ?? SCENE_OFFSETS[0];
      step += 1;
      const pixel = capture.probe
        ? parsePixel(await page.evaluate((tile) => window.__archiveOcellusProbe?.tileCentre(tile) ?? null, target))
        : capture.pixels.length > 0
          ? capture.pixels[(step - 1) % capture.pixels.length] ?? null
          : box
            ? { x: Math.min(box.width - 1, Math.max(0, box.width / 2 + (offset?.x ?? 0))), y: Math.min(box.height - 1, Math.max(0, box.height / 2 + (offset?.y ?? 0))) }
            : null;
      if (!pixel) {
        clickMisses += 1;
      } else {
        await world.click({ position: { x: pixel.x, y: pixel.y }, timeout: 5_000 });
        clicks += 1;
        walkPixels.push(pixel);
      }
      if (capture.probe) {
        const snap = parseProbe(await page.evaluate(() => {
          const probe = window.__archiveOcellusProbe;
          if (!probe) return null;
          const shot = probe.snapshot();
          return { ...shot, rows: probe.log().rows.length };
        }));
        if (snap.tile) tiles.add(`${snap.tile.x},${snap.tile.y}`);
        if (snap.fightKind === "ended") break;
      }
      if (traceDeadline !== null && Date.now() >= traceDeadline) await finishTrace();
      await page.waitForTimeout(700);
    }
    const endSnap = capture.probe
      ? parseProbe(await page.evaluate(() => {
        const probe = window.__archiveOcellusProbe;
        if (!probe) return null;
        const shot = probe.snapshot();
        return { ...shot, rows: probe.log().rows.length };
      }))
      : null;
    const activity = capture.probe
      ? parseActivity(await page.evaluate(() => {
        const rows = window.__archiveOcellusProbe?.log().rows ?? [];
        const events: Record<string, number> = {};
        let walks = 0;
        let combat = 0;
        for (const row of rows) {
          combat += row.combatDraws;
          for (const input of row.inputs) if (input.kind === "walk-ordered") walks += 1;
          for (const event of row.events) events[event.kind] = (events[event.kind] ?? 0) + 1;
        }
        return { walks, combat, events };
      }))
      : null;
    const observed = await page.evaluate(() => {
      const perf = window.__ocellusPerf;
      if (!perf) return null;
      return {
        frames: perf.frames.slice(1),
        longs: perf.longs.slice(),
        heap: perf.heap.slice(),
        draws: perf.draws,
        drawImageCount: perf.drawImageCount,
        drawImageMs: perf.drawImageMs,
        drawImageBigCount: perf.drawImageBigCount,
        drawImageBigMs: perf.drawImageBigMs,
        drawImageBigAMs: perf.drawImageBigAMs,
        drawImageBigBMs: perf.drawImageBigBMs,
        drawImageStack: perf.drawImageStack,
      };
    });
    if (!isRecord(observed)) throw new Error("the frame observer was missing");
    const canvasInk = capture.probe
      ? null
      : await page.evaluate(() => {
        const canvas = document.querySelector("#world");
        if (!(canvas instanceof HTMLCanvasElement)) return null;
        const context = canvas.getContext("2d");
        if (!context) return { width: canvas.width, height: canvas.height, nonZero: -1 };
        const step = 64;
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        let nonZero = 0;
        for (let index = 0; index < image.data.length; index += step) {
          const red = image.data[index] ?? 0;
          const green = image.data[index + 1] ?? 0;
          const blue = image.data[index + 2] ?? 0;
          if (red + green + blue > 12) nonZero += 1;
        }
        return { width: canvas.width, height: canvas.height, nonZero };
      });
    let profileSummary: ProfileSummary | null = null;
    let profilePath: string | null = null;
    if (client && capture.profile) {
      const stopped: unknown = await client.send("Profiler.stop");
      if (!isRecord(stopped)) throw new Error("Profiler.stop returned no profile");
      const profile = parseProfile(stopped.profile);
      profileSummary = await summariseProfile(profile);
      profilePath = resolve(outDir, `${label}.cpuprofile.json`);
      await writeFile(profilePath, JSON.stringify(stopped.profile));
    }
    await finishTrace();
    const heapValues = Array.isArray(observed.heap) ? observed.heap.flatMap((sample) => (isRecord(sample) && typeof sample.used === "number" ? [sample.used] : [])) : [];
    const longDurations = Array.isArray(observed.longs) ? observed.longs.flatMap((entry) => (isRecord(entry) && typeof entry.duration === "number" ? [entry.duration] : [])) : [];
    const frameValues = Array.isArray(observed.frames) ? observed.frames.filter((value): value is number => typeof value === "number" && Number.isFinite(value)) : [];
    const heapStart = heapValues[0] ?? null;
    const heapEnd = heapValues[heapValues.length - 1] ?? null;
    const drawImage = capture.instrument && typeof observed.drawImageCount === "number" && typeof observed.drawImageMs === "number" && typeof observed.drawImageBigCount === "number" && typeof observed.drawImageBigMs === "number" && typeof observed.drawImageBigAMs === "number" && typeof observed.drawImageBigBMs === "number"
      ? {
        count: observed.drawImageCount,
        ms: observed.drawImageMs,
        bigCount: observed.drawImageBigCount,
        bigMs: observed.drawImageBigMs,
        firstBlitMs: observed.drawImageBigAMs,
        secondBlitMs: observed.drawImageBigBMs,
        stack: typeof observed.drawImageStack === "string" ? observed.drawImageStack : "",
      }
      : null;
    const ink = isRecord(canvasInk) && typeof canvasInk.width === "number" && typeof canvasInk.height === "number" && typeof canvasInk.nonZero === "number"
      ? canvasInk
      : null;
    const proof: FightProof = startSnap && endSnap && activity
      ? {
        kind: "probe",
        startTick: startSnap.tick,
        endTick: endSnap.tick,
        tickDelta: endSnap.tick - startSnap.tick,
        rows: endSnap.rows - startSnap.rows,
        bossHpStart: startSnap.bossHp ?? -1,
        bossHpEnd: endSnap.bossHp ?? -1,
        distinctTiles: tiles.size,
        clicks,
        clickMisses,
        walkOrders: activity.walks,
        combatDraws: activity.combat,
        events: activity.events,
        fightKind: endSnap.fightKind,
        visibleAtEnd: endSnap.visible,
        pageErrors,
        consoleErrors,
      }
      : {
        kind: "scene",
        canvasWidth: ink?.width ?? 0,
        canvasHeight: ink?.height ?? 0,
        nonZeroSamples: ink?.nonZero ?? -1,
        clicks,
        clickMisses,
        pageErrors,
        consoleErrors,
      };
    const run: BrowserRun = {
      label,
      url,
      renderer,
      readyMs,
      fightMs,
      frames: frameStats(frameValues),
      longTasks: {
        count: longDurations.length,
        totalMs: longDurations.reduce((sum, value) => sum + value, 0),
        maxMs: longDurations.reduce((max, value) => Math.max(max, value), 0),
      },
      heap: { startBytes: heapStart, endBytes: heapEnd, growthBytes: heapStart !== null && heapEnd !== null ? heapEnd - heapStart : null },
      heapSamples: heapValues,
      drawCalls: typeof observed.draws === "number" ? observed.draws : null,
      drawImage,
      walkPixels,
      proof,
      loadAvgStart,
      loadAvg: loadavg(),
    };
    return { run, profile: profileSummary, tracePath, profilePath };
  } finally {
    await browser.close();
  }
}

function installDom(): void {
  const { JSDOM } = requireJsdom();
  const dom = new JSDOM("<!doctype html><html><body><canvas id='world'></canvas><div id='root'></div></body></html>", {
    url: "http://localhost/?seed=1&invincible=on",
    pretendToBeVisual: true,
  });
  const window = dom.window;
  const publish = (name: string, value: unknown) => {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };
  publish("window", window);
  publish("document", window.document);
  publish("navigator", window.navigator);
  publish("HTMLElement", window.HTMLElement);
  publish("HTMLCanvasElement", window.HTMLCanvasElement);
  publish("Element", window.Element);
  publish("Node", window.Node);
  publish("Image", window.Image);
  publish("Audio", window.Audio);
  publish("requestAnimationFrame", window.requestAnimationFrame.bind(window));
  publish("cancelAnimationFrame", window.cancelAnimationFrame.bind(window));
  publish("localStorage", window.localStorage);
  publish("getComputedStyle", window.getComputedStyle.bind(window));
  publish("MouseEvent", window.MouseEvent);
  publish("self", window);
  const canvasContext: Record<string | symbol, unknown> = new Proxy({}, {
    get(_target, property) {
      if (property === "measureText") return () => ({ width: 0 });
      if (property === "createImageData") return (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(4 * width * height) });
      return () => undefined;
    },
    set() {
      return true;
    },
  });
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(public width: number, public height: number) {}
    getContext() {
      return canvasContext;
    }
  };
  window.HTMLCanvasElement.prototype.getContext = () => canvasContext;
  globalThis.fetch = () => Promise.resolve(new Response(new ArrayBuffer(0)));
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      queueMicrotask(() => this.callback([{ contentRect: { width: 800, height: 800, x: 0, y: 0, top: 0, bottom: 800, left: 0, right: 800, toJSON() { return {}; } } }], this));
    }
    unobserve() {}
    disconnect() {}
  };
}

function requireJsdom(): { readonly JSDOM: new (...args: readonly unknown[]) => { readonly window: Window & typeof globalThis } } {
  const loaded: unknown = require("jsdom");
  if (!isRecord(loaded) || typeof loaded.JSDOM !== "function") throw new Error("jsdom did not load");
  return { JSDOM: loaded.JSDOM };
}

async function oneHeadless(workload: Workload, ticks: number): Promise<HeadlessRun> {
  installDom();
  const { Settings, TrainerInstance } = await import("osrs-sdk");
  const { parseDrillRequest } = await import("../src/content/ocellus/js/OcellusTimings.ts");
  const { OcellusRegion } = await import("../src/content/ocellus/js/OcellusRegion.ts");
  Settings.readFromStorage();
  const parsed = parseDrillRequest(new URL("http://localhost/?seed=1&invincible=on"), () => 1);
  if (parsed.rejected.length > 0) throw new Error(`drill rejected ${parsed.rejected.join(",")}`);
  const region = new OcellusRegion(parsed.config);
  region.invincible = parsed.invincible;
  const trainer = new TrainerInstance(region, { force2d: true });
  const canvas = document.querySelector("canvas");
  const root = document.querySelector("#root");
  if (!(canvas instanceof HTMLCanvasElement) || !(root instanceof HTMLElement)) throw new Error("headless mount nodes are missing");
  const player = trainer.mount(canvas, root);
  const readyLeft = region.world.getReadyTimer - 1;
  if (readyLeft > 0) region.world.tickWorld(readyLeft);
  for (let warm = 0; warm < 30; warm += 1) region.world.tickWorld();
  const before = region.snapshot();
  const boss = region.primaryBoss;
  const errors: string[] = [];
  const started = performance.now();
  let playerMoves = 0;
  let previous = `${player.location.x},${player.location.y}`;
  for (let tick = 0; tick < ticks; tick += 1) {
    try {
      if (workload === "busy") {
        const tile = WALK_TILES[tick % WALK_TILES.length] ?? WALK_TILES[0];
        player.moveTo(tile.x, tile.y);
      }
      region.world.tickWorld();
      const at = `${player.location.x},${player.location.y}`;
      if (at !== previous) playerMoves += 1;
      previous = at;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      break;
    }
  }
  const seconds = (performance.now() - started) / 1000;
  const after = region.snapshot();
  trainer.dispose();
  return {
    workload,
    ticks,
    seconds,
    ticksPerSecond: seconds > 0 ? ticks / seconds : 0,
    rows: region.fightLog().rows.length,
    bossHpStart: before?.boss.hp ?? -1,
    bossHpEnd: after?.boss.hp ?? -1,
    playerMoves,
    errors,
  };
}

type TraceNameSummary = {
  readonly name: string;
  readonly count: number;
  readonly completeMs: number;
  readonly maxMs: number;
};

type TraceSummary = {
  readonly events: number;
  readonly over50Ms: number;
  readonly gcMs: number;
  readonly layoutMs: number;
  readonly paintMs: number;
  readonly animationFrameMs: number;
  readonly top: readonly TraceNameSummary[];
};

function noteTrace(names: Map<string, { count: number; completeUs: number; maxUs: number }>, name: string, ph: string, dur: number): { readonly gc: number; readonly layout: number; readonly paint: number; readonly animation: number; readonly over50: number } {
  const row = names.get(name) ?? { count: 0, completeUs: 0, maxUs: 0 };
  row.count += 1;
  let gc = 0;
  let layout = 0;
  let paint = 0;
  let animation = 0;
  let over50 = 0;
  if (ph === "X" && dur > 0) {
    row.completeUs += dur;
    if (dur > row.maxUs) row.maxUs = dur;
    if (dur > 50_000) over50 = 1;
    if (name.includes("GC")) gc = dur;
    if (name === "Layout" || name === "UpdateLayoutTree") layout = dur;
    if (name === "Paint" || name === "PaintImage" || name === "CompositeLayers") paint = dur;
    if (name === "FireAnimationFrame") animation = dur;
  }
  names.set(name, row);
  return { gc, layout, paint, animation, over50 };
}

async function summariseTrace(tracePath: string): Promise<TraceSummary> {
  const file = createReadStream(tracePath);
  const source = tracePath.endsWith(".gz") ? file.pipe(createGunzip()) : file;
  const names = new Map<string, { count: number; completeUs: number; maxUs: number }>();
  let events = 0;
  let over50Ms = 0;
  let gcUs = 0;
  let layoutUs = 0;
  let paintUs = 0;
  let animationUs = 0;
  let pending = "";
  let started = false;
  let depth = 0;
  let inString = false;
  let escape = false;
  let key = "";
  let readingKey = true;
  let name = "";
  let ph = "";
  let dur = 0;
  let number = "";
  let readingNumber = false;

  const finishObject = () => {
    if (name !== "") {
      events += 1;
      const noted = noteTrace(names, name, ph, dur);
      gcUs += noted.gc;
      layoutUs += noted.layout;
      paintUs += noted.paint;
      animationUs += noted.animation;
      over50Ms += noted.over50;
    }
    name = "";
    ph = "";
    dur = 0;
    key = "";
    readingKey = true;
  };

  const consume = (text: string): string => {
    let index = 0;
    while (index < text.length) {
      const char = text[index] ?? "";
      if (!started) {
        if (char === "[") started = true;
        index += 1;
        continue;
      }
      if (depth === 0) {
        if (char === "{") {
          depth = 1;
          inString = false;
          escape = false;
          key = "";
          readingKey = true;
          name = "";
          ph = "";
          dur = 0;
          number = "";
          readingNumber = false;
        } else if (char === "]") {
          return "";
        }
        index += 1;
        continue;
      }
      if (inString) {
        const top = depth === 1;
        if (escape) {
          escape = false;
          if (top && readingKey) key += char;
          else if (top && key === "name") name += char;
          else if (top && key === "ph") ph += char;
        } else if (char === "\\") {
          escape = true;
        } else if (char === "\"") {
          inString = false;
          if (readingKey) readingKey = false;
        } else if (top && readingKey) {
          key += char;
        } else if (top && key === "name") {
          name += char;
        } else if (top && key === "ph") {
          ph += char;
        }
        index += 1;
        continue;
      }
      if (char === "\"") {
        inString = true;
        if (depth === 1) {
          if (!readingKey) {
            if (key !== "name" && key !== "ph") key = "";
          } else {
            key = "";
          }
        }
        index += 1;
        continue;
      }
      if (char === ":") {
        readingKey = false;
        index += 1;
        continue;
      }
      if (char === "{" || char === "[") {
        depth += 1;
        readingNumber = false;
        index += 1;
        continue;
      }
      if (char === "}" || char === "]") {
        if (readingNumber && key === "dur") dur = Number(number);
        readingNumber = false;
        number = "";
        depth -= 1;
        if (depth === 0 && char === "}") finishObject();
        readingKey = true;
        key = "";
        index += 1;
        continue;
      }
      if (char === ",") {
        if (readingNumber && key === "dur") dur = Number(number);
        readingNumber = false;
        number = "";
        readingKey = true;
        key = "";
        index += 1;
        continue;
      }
      if (char === "-" || char === "." || (char >= "0" && char <= "9")) {
        if (!readingKey && depth === 1) {
          readingNumber = true;
          number += char;
        }
        index += 1;
        continue;
      }
      index += 1;
    }
    return "";
  };

  for await (const chunk of source) {
    pending += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    if (!started) {
      const marker = pending.indexOf("\"traceEvents\"");
      const arrayAt = pending.indexOf("[");
      const cut = marker === -1 ? arrayAt : pending.indexOf("[", marker);
      if (cut === -1) {
        pending = pending.slice(-80);
        continue;
      }
      pending = pending.slice(cut);
    }
    consume(pending);
    pending = "";
  }
  const top = [...names.entries()]
    .map(([eventName, row]): TraceNameSummary => ({
      name: eventName,
      count: row.count,
      completeMs: row.completeUs / 1000,
      maxMs: row.maxUs / 1000,
    }))
    .sort((a, b) => b.completeMs - a.completeMs)
    .slice(0, 15);
  return {
    events,
    over50Ms,
    gcMs: gcUs / 1000,
    layoutMs: layoutUs / 1000,
    paintMs: paintUs / 1000,
    animationFrameMs: animationUs / 1000,
    top,
  };
}

function parseHeadless(value: unknown): HeadlessRun {
  if (!isRecord(value)) throw new Error("headless result is not an object");
  const workload = value.workload === "busy" || value.workload === "idle" ? value.workload : null;
  if (!workload) throw new Error("headless workload is missing");
  if (!Array.isArray(value.errors)) throw new Error("headless errors are missing");
  return {
    workload,
    ticks: readNumber(value.ticks, "ticks"),
    seconds: readNumber(value.seconds, "seconds"),
    ticksPerSecond: readNumber(value.ticksPerSecond, "ticksPerSecond"),
    rows: readNumber(value.rows, "rows"),
    bossHpStart: readNumber(value.bossHpStart, "bossHpStart"),
    bossHpEnd: readNumber(value.bossHpEnd, "bossHpEnd"),
    playerMoves: readNumber(value.playerMoves, "playerMoves"),
    errors: value.errors.map((entry) => readString(entry, "error")),
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

function rangeOf(values: readonly number[]): { readonly min: number; readonly max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const outDir = resolve(stringArg(argv, "--out", process.env.OCELLUS_PERF_OUT ?? "/tmp/ocellus-perf"));
  await mkdir(outDir, { recursive: true });
  if (command === "headless") {
    const runs = numberArg(argv, "--runs", 5);
    const ticks = numberArg(argv, "--ticks", 2000);
    const workloadArg = stringArg(argv, "--workload", "alternate");
    if (runs > 1 && process.env.OCELLUS_PERF_CHILD !== "1") {
      const plan: Workload[] = workloadArg === "alternate"
        ? Array.from({ length: runs * 2 }, (_, index) => (index % 2 === 0 ? "idle" : "busy"))
        : Array.from({ length: runs }, () => (workloadArg === "busy" ? "busy" : "idle"));
      const results: HeadlessRun[] = [];
      for (let index = 0; index < plan.length; index += 1) {
        const workload = plan[index] ?? "idle";
        const child = spawnSync(process.execPath, [...process.execArgv, process.argv[1] ?? "", "headless", "--runs", "1", "--ticks", String(ticks), "--workload", workload, "--out", outDir], {
          env: { ...process.env, OCELLUS_PERF_CHILD: "1" },
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        });
        if (child.status !== 0) throw new Error(child.stderr || child.stdout || `headless child ${index} failed`);
        const line = child.stdout.trim().split("\n").find((row) => row.startsWith("RESULT "));
        if (!line) throw new Error(`headless child ${index} printed no RESULT`);
        results.push(parseHeadless(JSON.parse(line.slice("RESULT ".length))));
        process.stderr.write(`headless ${index + 1}/${plan.length} ${workload} done\n`);
      }
      await writeFile(resolve(outDir, "headless.json"), JSON.stringify({ runs: results, cores: cpus().length, load: loadavg() }, null, 2));
      const summarise = (kind: Workload) => {
        const side = results.filter((run) => run.workload === kind);
        const rates = side.map((run) => run.ticksPerSecond);
        return { kind, n: side.length, median: median(rates), range: rangeOf(rates), errors: side.reduce((sum, run) => sum + run.errors.length, 0) };
      };
      process.stdout.write(`${JSON.stringify({ idle: summarise("idle"), busy: summarise("busy") }, null, 2)}\n`);
      return;
    }
    const workload: Workload = workloadArg === "busy" ? "busy" : "idle";
    const result = await oneHeadless(workload, ticks);
    if (process.env.OCELLUS_PERF_CHILD === "1") {
      process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
      return;
    }
    await writeFile(resolve(outDir, "headless.json"), JSON.stringify({ runs: [result] }, null, 2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "browser") {
    const url = stringArg(argv, "--url", "");
    if (url === "") throw new Error("browser needs --url");
    const runs = numberArg(argv, "--runs", 1);
    const fightMs = numberArg(argv, "--ms", 150_000);
    const captureProfile = flag(argv, "--profile");
    const captureTrace = flag(argv, "--trace");
    const traceMs = argv.includes("--trace-ms") ? numberArg(argv, "--trace-ms", fightMs) : null;
    const prefix = stringArg(argv, "--label", "fight");
    const pixels = argv.includes("--pixels") ? parsePixels(JSON.parse(await readFile(stringArg(argv, "--pixels", ""), "utf8"))) : [];
    const results: BrowserRun[] = [];
    const profiles: ProfileSummary[] = [];
    for (let index = 0; index < runs; index += 1) {
      const label = `${prefix}-${index + 1}`;
      process.stderr.write(`browser ${label} load ${loadavg().join(",")} cores ${cpus().length}\n`);
      const { run, profile, tracePath, profilePath } = await browserRun(url, fightMs, outDir, label, {
        profile: captureProfile,
        trace: captureTrace,
        traceMs,
        probe: !flag(argv, "--no-probe"),
        pixels,
        instrument: flag(argv, "--instrument"),
      });
      results.push(run);
      if (profile) profiles.push(profile);
      await writeFile(resolve(outDir, `${label}.json`), JSON.stringify({ run, profile, tracePath, profilePath }, null, 2));
      const ticks = run.proof.kind === "probe" ? String(run.proof.tickDelta) : "scene";
      process.stderr.write(`browser ${label} p50 ${run.frames.p50Ms.toFixed(2)} ticks ${ticks} errors ${run.proof.pageErrors.length}\n`);
    }
    await writeFile(resolve(outDir, `${prefix}.json`), JSON.stringify({ results, profiles, cores: cpus().length }, null, 2));
    const p50s = results.map((run) => run.frames.p50Ms);
    process.stdout.write(`${JSON.stringify({ n: results.length, p50: { median: median(p50s), range: rangeOf(p50s) }, renderer: results[0]?.renderer ?? "" }, null, 2)}\n`);
    return;
  }
  if (command === "reduce") {
    const profilePath = stringArg(argv, "--profile", "");
    if (profilePath === "") throw new Error("reduce needs --profile");
    const summary = await summariseProfile(parseProfile(JSON.parse(await readFile(profilePath, "utf8"))));
    const summaryPath = stringArg(argv, "--summary", profilePath.replace(/\.cpuprofile\.json$/, ".summary.json"));
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    process.stdout.write(`${JSON.stringify({ summaryPath, sampleMs: summary.sampleMs, unmappedShare: summary.unmappedShare, selfByBucket: summary.selfByBucket, hot: summary.hot }, null, 2)}\n`);
    return;
  }
  if (command === "reduce-trace") {
    const tracePath = stringArg(argv, "--trace", "");
    if (tracePath === "") throw new Error("reduce-trace needs --trace");
    const summary = await summariseTrace(tracePath);
    const summaryPath = stringArg(argv, "--summary", `${tracePath}.summary.json`);
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    process.stdout.write(`${JSON.stringify({ summaryPath, ...summary }, null, 2)}\n`);
    return;
  }
  throw new Error("usage: perf-profile.mts headless|browser|reduce|reduce-trace");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
