import { defineConfig } from "osrs-sdk-assets";
import { ARCHIVE_OCELLUS_ASSETS, ARCHIVE_OCELLUS_OVERRIDES } from "./src/assets";
import { BLADE_SCENERY, REGION_IDS } from "./src/content/archive/poses";

export default defineConfig({
  cache: { openrs2: 2746 },
  assets: ARCHIVE_OCELLUS_ASSETS,
  overrides: ARCHIVE_OCELLUS_OVERRIDES,
  outDir: "./public/osrs-assets",
  // One compiled scene is shared by every phase of region 16472. Object 62706 is that map's blade.
  // Phase 2 draws the sword the boss occupies. Leaving the object in the scene showed both swords in phase 1 as well.
  hooks: {
    sceneLocation(regionId, location) {
      if (regionId === REGION_IDS.ocellus && location.id === BLADE_SCENERY) return null;
      return location;
    },
  },
});
