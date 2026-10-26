import type { CacheRenderBundleManifest } from "osrs-sdk";
import type { ConfiguredIds } from "./servedAssets";

const loadServedAssetsInEachTest = () => vi.importActual<typeof import("./servedAssets")>("./servedAssets");
const loadAssetConfigInEachTest = () => vi.importActual<typeof import("./assets")>("./assets");

type Rendered = Readonly<Record<"npcs" | "models" | "spotAnims", ConfiguredIds>>;

function manifestWithout(rendered: Rendered, missing: ReadonlySet<string>): CacheRenderBundleManifest {
  const keys = (prefix: string, assets: ConfiguredIds) => Object.values(assets).map(({ id }) => `${prefix}${id}`).filter((key) => !missing.has(key));
  return {
    schemaVersion: 3,
    bundleVersion: "test",
    cache: { revision: 241, source: "openrs2:2746", contentHash: "test" },
    assets: {},
    references: Object.fromEntries([...keys("npc:", rendered.npcs), ...keys("model:", rendered.models)].map((key) => [key, [key]])),
    spotAnims: Object.fromEntries(keys("", rendered.spotAnims).map((id) => [id, `spotanim-${id}`])),
  };
}

function idsOf(assets: ConfiguredIds): ReadonlySet<number> {
  return new Set(Object.values(assets).map(({ id }) => id));
}

function covers(configured: ReadonlySet<number>, served: ReadonlySet<number>): boolean {
  return [...served].every((id) => configured.has(id));
}

describe("reportUnservedAssets", () => {
  test("logs one error per phase 4 or encounter-room npc, model or spotanim the served manifest lacks, and none for a manifest that serves them all", async () => {
    const { SERVED_ASSETS, reportUnservedAssets } = await loadServedAssetsInEachTest();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportUnservedAssets(manifestWithout(SERVED_ASSETS, new Set(["npc:16677", "4339", "model:62508", `npc:${SERVED_ASSETS.npcs.bork.id}`])));
    reportUnservedAssets(manifestWithout(SERVED_ASSETS, new Set()));

    expect(errors.mock.calls).toEqual([
      ["assets: osrs-assets/manifest.json has no npcs.ocellus (16677); rebuild public/osrs-assets with npm run assets"],
      [`assets: osrs-assets/manifest.json has no npcs.bork (${SERVED_ASSETS.npcs.bork.id}); rebuild public/osrs-assets with npm run assets`],
      ["assets: osrs-assets/manifest.json has no models.voidHole (62508); rebuild public/osrs-assets with npm run assets"],
      ["assets: osrs-assets/manifest.json has no spotAnims.explosion (4339); rebuild public/osrs-assets with npm run assets"],
    ]);
    errors.mockRestore();
  });

  test("every npc, model and spotanim a flags-off page checks is in the asset config, so the guard cannot ask for an id the bundle never extracts", async () => {
    const { SERVED_ASSETS } = await loadServedAssetsInEachTest();
    const { ARCHIVE_OCELLUS_ASSETS } = await loadAssetConfigInEachTest();
    expect(covers(idsOf(ARCHIVE_OCELLUS_ASSETS.npcs), idsOf(SERVED_ASSETS.npcs))).toBe(true);
    expect(covers(idsOf(ARCHIVE_OCELLUS_ASSETS.models), idsOf(SERVED_ASSETS.models))).toBe(true);
    expect(covers(idsOf(ARCHIVE_OCELLUS_ASSETS.spotAnims), idsOf(SERVED_ASSETS.spotAnims))).toBe(true);
  });
});
