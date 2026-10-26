import type { CacheRenderBundleManifest } from "osrs-sdk";
import { ARCHIVE_OCELLUS_ASSETS, archiveOcellusAssets, reportUnservedAssets } from "./assets";

function manifestWithout(missing: ReadonlySet<string>): CacheRenderBundleManifest {
  const keys = (prefix: string, assets: Readonly<Record<string, Readonly<{ id: number }>>>) =>
    Object.values(assets).map(({ id }) => `${prefix}${id}`).filter((key) => !missing.has(key));
  return {
    schemaVersion: 3,
    bundleVersion: "test",
    cache: { revision: 241, source: "openrs2:2746", contentHash: "test" },
    assets: {},
    references: Object.fromEntries([...keys("npc:", ARCHIVE_OCELLUS_ASSETS.npcs), ...keys("model:", ARCHIVE_OCELLUS_ASSETS.models)].map((key) => [key, [key]])),
    spotAnims: Object.fromEntries(keys("", ARCHIVE_OCELLUS_ASSETS.spotAnims).map((id) => [id, `spotanim-${id}`])),
  };
}

const DRILL_SPOTANIMS = [4270, 4271, 4272, 4273, 4280, 4281, 4282, 4283, 4305, 4388] as const;

function spotIds(spots: object): readonly number[] {
  return Object.values(spots).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("id" in entry) || typeof entry.id !== "number") return [];
    return [entry.id];
  });
}

describe("phase flags and the asset bundle", () => {
  test("an unset flag matches the webpack default, so phase 2's npc and the ten spotanims the served manifest lacked are required", () => {
    const npcs: Readonly<Record<string, Readonly<{ id: number }>>> = ARCHIVE_OCELLUS_ASSETS.npcs;
    const ids = spotIds(ARCHIVE_OCELLUS_ASSETS.spotAnims);
    expect(npcs.ocellusP2?.id).toBe(16675);
    expect(DRILL_SPOTANIMS.every((id) => ids.includes(id))).toBe(true);
  });

  test("ARCHIVE_P2 off leaves the drill's npc and spotanims out of the cache request", () => {
    const hidden = archiveOcellusAssets({ p1: false, p2: false, p3: false });
    const ids = spotIds(hidden.spotAnims);
    expect("ocellusP2" in hidden.npcs).toBe(false);
    expect(DRILL_SPOTANIMS.some((id) => ids.includes(id))).toBe(false);
  });
});

describe("reportUnservedAssets", () => {
  test("logs one error per configured npc, model or spotanim the served manifest lacks, and none for a manifest that serves them all", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportUnservedAssets(manifestWithout(new Set(["npc:16677", "4339", "model:62508"])));
    reportUnservedAssets(manifestWithout(new Set()));

    expect(errors.mock.calls).toEqual([
      ["assets: osrs-assets/manifest.json has no npcs.ocellus (16677); rebuild public/osrs-assets with npm run assets"],
      ["assets: osrs-assets/manifest.json has no models.voidHole (62508); rebuild public/osrs-assets with npm run assets"],
      ["assets: osrs-assets/manifest.json has no spotAnims.explosion (4339); rebuild public/osrs-assets with npm run assets"],
    ]);
    errors.mockRestore();
  });
});
