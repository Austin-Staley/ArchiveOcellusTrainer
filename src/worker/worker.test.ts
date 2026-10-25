import type { DataPoint } from "../telemetry/perfSummary";
import type { Env } from "./worker";

const loadWorkerInEachTest = () => vi.importActual<typeof import("./worker")>("./worker");

const SUMMARY = {
  version: "2026.10.25.2",
  view: "3d",
  gpu: "nvidia",
  browser: "chrome",
  stage: "after-inner",
  end: "kill",
  sampleRate: 0.4,
  runTicks: 31,
  frames: 1100,
  frameMedianMs: 16,
  frameP95Ms: 33,
  frameP99Ms: 50,
  framesOver50Ms: 4,
  tickMedianMs: 600,
  tickP95Ms: 640,
  tickMaxMs: 812.5,
  lateTicks: 1,
  devicePixelRatio: 1.25,
  canvasWidth: 1600,
  canvasHeight: 1000,
  cores: 8,
};

function bindings() {
  const written: DataPoint[] = [];
  const env: Env = {
    ASSETS: { fetch: async (request) => new Response(`asset ${new URL(request.url).pathname}`) },
    PERF: { writeDataPoint: (point) => void written.push(point) },
  };
  return { env, written };
}

const SUMMARY_WITHOUT_CORES = Object.fromEntries(Object.entries(SUMMARY).filter(([key]) => key !== "cores"));

async function send(env: Env, path: string, init?: RequestInit) {
  const { default: worker } = await loadWorkerInEachTest();
  const response = await worker.fetch(new Request(`https://trainer.example${path}`, init), env);
  return { status: response.status, body: await response.text() };
}

describe("Performance beacon Worker", () => {
  test("a valid summary posted to /t becomes one Analytics Engine data point in the documented order and answers 204", async () => {
    const { env, written } = bindings();
    const response = await send(env, "/t", { method: "POST", body: JSON.stringify(SUMMARY), headers: { "CF-Connecting-IP": "192.0.2.1", "User-Agent": "Mozilla/5.0 (a player's browser)" } });
    expect({ response, written }).toEqual({
      response: { status: 204, body: "" },
      written: [
        {
          blobs: ["2026.10.25.2", "3d", "nvidia", "chrome", "after-inner", "kill"],
          doubles: [0.4, 31, 1100, 16, 33, 50, 4, 600, 640, 812.5, 1, 1.25, 1600, 1000, 8],
          indexes: ["2026.10.25.2"],
        },
      ],
    });
  });

  test.each([
    { name: "a body that is not JSON", init: { method: "POST", body: "{not json" }, status: 400 },
    { name: "a summary with an extra field", init: { method: "POST", body: JSON.stringify({ ...SUMMARY, userAgent: "Mozilla/5.0" }) }, status: 400 },
    { name: "a summary missing a field", init: { method: "POST", body: JSON.stringify({ ...SUMMARY, cores: undefined }) }, status: 400 },
    { name: "a GPU family outside the list", init: { method: "POST", body: JSON.stringify({ ...SUMMARY, gpu: "NVIDIA GeForce RTX 4090" }) }, status: 400 },
    { name: "a sample rate of 0", init: { method: "POST", body: JSON.stringify({ ...SUMMARY, sampleRate: 0 }) }, status: 400 },
    { name: "cores replaced by constructor", init: { method: "POST", body: JSON.stringify({ ...SUMMARY_WITHOUT_CORES, constructor: "unexpected" }) }, status: 400 },
    { name: "cores replaced by __proto__", init: { method: "POST", body: JSON.stringify({ ...SUMMARY_WITHOUT_CORES, ["__proto__"]: "unexpected" }) }, status: 400 },
    { name: "a body over 2 KB", init: { method: "POST", body: JSON.stringify({ ...SUMMARY, pad: "x".repeat(2048) }) }, status: 413 },
    { name: "a Content-Length over 2 KB", init: { method: "POST", body: JSON.stringify(SUMMARY), headers: { "content-length": "4096" } }, status: 413 },
    { name: "a GET", init: { method: "GET" }, status: 405 },
  ])("$name at /t writes nothing and answers $status", async ({ init, status }) => {
    const { env, written } = bindings();
    const response = await send(env, "/t", init);
    expect({ status: response.status, written }).toEqual({ status, written: [] });
  });

  test("every other path, including a POST, is served from the static assets", async () => {
    const { env, written } = bindings();
    const responses = await Promise.all([
      send(env, "/"),
      send(env, "/telemetry.json"),
      send(env, "/t/extra", { method: "POST", body: JSON.stringify(SUMMARY) }),
      send(env, "/osrs-assets/manifest.json"),
    ]);
    expect({ responses, written }).toEqual({
      responses: [
        { status: 200, body: "asset /" },
        { status: 200, body: "asset /telemetry.json" },
        { status: 200, body: "asset /t/extra" },
        { status: 200, body: "asset /osrs-assets/manifest.json" },
      ],
      written: [],
    });
  });
});
