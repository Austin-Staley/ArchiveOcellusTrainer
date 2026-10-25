import type { BrowserFamily, GpuFamily } from "./perfSummary";

const GPU_RULES: readonly (readonly [RegExp, GpuFamily])[] = [
  [/swiftshader|llvmpipe|softpipe|basic render|software/i, "software"],
  [/nvidia|geforce|quadro|\brtx\b|\bgtx\b/i, "nvidia"],
  [/radeon|\bamd\b|\bati\b/i, "amd"],
  [/intel.*\barc\b/i, "intel-arc"],
  [/intel/i, "intel"],
  [/apple/i, "apple"],
  [/adreno/i, "adreno"],
  [/\bmali\b/i, "mali"],
  [/powervr|imagination/i, "powervr"],
];

/** Order matters: Edge, Opera and Samsung Internet also say Chrome, and Chrome also says Safari. */
const BROWSER_RULES: readonly (readonly [RegExp, BrowserFamily])[] = [
  [/\bEdg(e|A|iOS)?\//, "edge"],
  [/\bOPR\/|\bOpera\b/, "opera"],
  [/\bSamsungBrowser\//, "samsung"],
  [/\bFirefox\/|\bFxiOS\//, "firefox"],
  [/Chrome\/|\bCriOS\//, "chrome"],
  [/\bSafari\//, "safari"],
];

export function gpuFamily(renderer: string | null): GpuFamily {
  if (renderer === null || renderer.trim() === "") return "unavailable";
  return GPU_RULES.find(([pattern]) => pattern.test(renderer))?.[1] ?? "other";
}

export function browserFamily(userAgent: string): BrowserFamily {
  return BROWSER_RULES.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "other";
}

export function webglRenderer(): string | null {
  const gl = document.createElement("canvas").getContext("webgl");
  if (!gl) return null;
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return typeof renderer === "string" ? renderer : null;
}
