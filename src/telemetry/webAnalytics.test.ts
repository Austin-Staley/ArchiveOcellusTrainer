const TOKEN = "0123456789abcdef0123456789abcdef";

// The token is fixed at build time, so each case imports the module afresh under its own environment.
async function loadWith(token: string | undefined) {
  vi.resetModules();
  vi.stubEnv("CF_WEB_ANALYTICS_TOKEN", token ?? "");
  const { loadWebAnalytics } = await vi.importActual<typeof import("./perfTelemetry")>("./perfTelemetry");
  loadWebAnalytics();
  return [...document.querySelectorAll("script")].map((script) => ({ src: script.src, beacon: script.dataset.cfBeacon, defer: script.defer }));
}

describe("Cloudflare Web Analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    document.querySelectorAll("script").forEach((script) => script.remove());
  });

  afterEach(() => vi.unstubAllEnvs());

  test.each([
    { name: "built with a token and the box ticked", token: TOKEN, optedOut: false, scripts: [{ src: "https://static.cloudflareinsights.com/beacon.min.js", beacon: `{"token":"${TOKEN}","spa":false}`, defer: true }] },
    { name: "built with a token and the box unticked", token: TOKEN, optedOut: true, scripts: [] },
    { name: "built without a token", token: undefined, optedOut: false, scripts: [] },
  ])("a page $name loads $scripts.length analytics scripts", async ({ token, optedOut, scripts }) => {
    if (optedOut) localStorage.setItem("archive-ocellus:perf-data", "off");
    expect(await loadWith(token)).toEqual(scripts);
  });
});
