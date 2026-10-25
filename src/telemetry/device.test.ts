
const loadDeviceInEachTest = () => vi.importActual<typeof import("./device")>("./device");

describe("Device families", () => {
  test.each([
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)", "nvidia"],
    ["NVIDIA GeForce GTX 980, or similar", "nvidia"],
    ["ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)", "amd"],
    ["ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)", "intel-arc"],
    ["ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)", "intel"],
    ["ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)", "apple"],
    ["Apple GPU", "apple"],
    ["Adreno (TM) 650", "adreno"],
    ["Mali-G78 MP14", "mali"],
    ["PowerVR Rogue GE8320", "powervr"],
    ["ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)", "software"],
    ["ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)", "software"],
    ["Mesa Virtio GPU", "other"],
    ["", "unavailable"],
    [null, "unavailable"],
  ])("renderer %j is the %s family", async (renderer, family) => {
    const { gpuFamily } = await loadDeviceInEachTest();
    expect(gpuFamily(renderer)).toBe(family);
  });

  test.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", "edge"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0", "opera"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36", "samsung"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "firefox"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "chrome"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36", "chrome"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1", "chrome"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", "safari"],
    ["Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/30.1.2", "other"],
  ])("user agent %j is the %s family", async (userAgent, family) => {
    const { browserFamily } = await loadDeviceInEachTest();
    expect(browserFamily(userAgent)).toBe(family);
  });
});
