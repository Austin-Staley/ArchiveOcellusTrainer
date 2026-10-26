import { ARCHIVE_OCELLUS_ASSETS, archiveOcellusAssets } from "./assets";

const DRILL_SPOTANIMS = [4270, 4271, 4272, 4273, 4280, 4281, 4282, 4283, 4305, 4388] as const;

function spotIds(spots: object): readonly number[] {
  return Object.values(spots).flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("id" in entry) || typeof entry.id !== "number") return [];
    return [entry.id];
  });
}

describe("phase flags and the asset bundle", () => {
  test("an unset flag extracts phase 2's npc and the spotanims the flags-on page draws", () => {
    const npcs: Readonly<Record<string, Readonly<{ id: number }>>> = ARCHIVE_OCELLUS_ASSETS.npcs;
    const ids = spotIds(ARCHIVE_OCELLUS_ASSETS.spotAnims);
    expect(npcs.ocellusP2?.id).toBe(16675);
    expect(DRILL_SPOTANIMS.every((id) => ids.includes(id))).toBe(true);
  });

  test("ARCHIVE_P2 off leaves the drill's npc and spotanims out of the cache request", () => {
    const hidden = archiveOcellusAssets({ p1: false, p2: false, p3: false, full: false });
    const ids = spotIds(hidden.spotAnims);
    expect("ocellusP2" in hidden.npcs).toBe(false);
    expect(DRILL_SPOTANIMS.some((id) => ids.includes(id))).toBe(false);
  });
});
