import type { BuildFlags } from "../flags";

const CHECKER = "./phaseCode";

async function strayPhaseModules(sources: readonly string[], flags: BuildFlags) {
  const checker: typeof import("./phaseCode") = await import(/* @vite-ignore */ CHECKER);
  return checker.strayPhaseModules(sources, flags);
}

const SOURCES = [
  "webpack://archive-ocellus-trainer/./src/content/ocellus/js/OcellusRegion.ts",
  "webpack://archive-ocellus-trainer/./src/content/ocellus/js/P2Region.ts",
  "webpack://archive-ocellus-trainer/./src/content/ocellus/js/p3/arena.ts",
  "webpack://archive-ocellus-trainer/./src/content/ocellus/js/P3Region.ts",
  "webpack://archive-ocellus-trainer/./node_modules/osrs-sdk/_bundles/main.js",
];

describe("strayPhaseModules", () => {
  test.each([
    {
      flags: { p2: false, p3: false },
      strays: [
        { module: "src/content/ocellus/js/P2Region.ts", phases: ["p2"] },
        { module: "src/content/ocellus/js/p3/arena.ts", phases: ["p1", "p2", "p3"] },
        { module: "src/content/ocellus/js/P3Region.ts", phases: ["p3"] },
      ],
    },
    { flags: { p2: true, p3: false }, strays: [{ module: "src/content/ocellus/js/P3Region.ts", phases: ["p3"] }] },
    { flags: { p2: true, p3: true }, strays: [] },
  ])("with $flags, reports each emitted phase module whose phases are all off", async ({ flags, strays }) => {
    expect(await strayPhaseModules(SOURCES, { ...flags, p1: false, full: false })).toEqual(strays);
  });

  test.each([
    {
      flags: { p3: false, p2: false, p1: false, full: false },
      strays: [
        { module: "src/content/ocellus/js/P1Region.ts", phases: ["p1"] },
        { module: "src/content/ocellus/js/p3/arena.ts", phases: ["p1", "p2", "p3"] },
      ],
    },
    { flags: { p3: false, p2: false, p1: true, full: false }, strays: [] },
  ])("with $flags, P1's region is stray unless p1 is on, and P1 keeps P3's arena it builds on", async ({ flags, strays }) => {
    expect(await strayPhaseModules(["webpack://archive-ocellus-trainer/./src/content/ocellus/js/P1Region.ts", "webpack://archive-ocellus-trainer/./src/content/ocellus/js/p3/arena.ts"], flags)).toEqual(strays);
  });

  test("the phase timing modules and the sidebar are stray when their flags are off, and the encounter rooms are not phase-only", async () => {
    const sources = [
      "webpack://archive-ocellus-trainer/./src/content/ocellus/js/OcellusTimingsP1.ts",
      "webpack://archive-ocellus-trainer/./src/content/ocellus/js/OcellusTimingsP2.ts",
      "webpack://archive-ocellus-trainer/./src/content/ocellus/js/OcellusTimingsP3.ts",
      "webpack://archive-ocellus-trainer/./src/content/ocellus/js/p1/movement.ts",
      "webpack://archive-ocellus-trainer/./src/menu/Sidebar.tsx",
      "webpack://archive-ocellus-trainer/./src/content/archive/cracks.ts",
      "webpack://archive-ocellus-trainer/./src/content/archive/portals.ts",
      "webpack://archive-ocellus-trainer/./src/content/archive/clock.ts",
    ];
    const off = await strayPhaseModules(sources, { p1: false, p2: false, p3: false, full: false });
    const on = await strayPhaseModules(sources, { p1: true, p2: true, p3: true, full: true });
    expect(off.map((stray) => stray.module)).toEqual([
      "src/content/ocellus/js/OcellusTimingsP1.ts",
      "src/content/ocellus/js/OcellusTimingsP2.ts",
      "src/content/ocellus/js/OcellusTimingsP3.ts",
      "src/content/ocellus/js/p1/movement.ts",
      "src/menu/Sidebar.tsx",
    ]);
    expect(on).toEqual([]);
  });
});
