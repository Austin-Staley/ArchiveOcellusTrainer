import type { CacheRenderBundleManifest } from "osrs-sdk";
import type { CacheAssets } from "osrs-sdk/asset-manifest";
import { BLADE_MODEL, GRAPHICS, OIL_MODEL, SMORK_SPLATS } from "./content/archive/poses";
import { P1_ROOM, P2_ROOM } from "./content/archive/roomFacts";
import { ARCHIVE } from "./content/archive/timings";
import type { SpriteFrame } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P4 } from "./content/ocellus/js/OcellusTimings";

const { boss, presentation, lifeforceOrb, rifts, explosion, geometry, floorHoles } = OCELLUS_P4;

export const sequences = (poses: Readonly<Record<string, Readonly<{ value: number }>>>) => Object.fromEntries(Object.entries(poses).map(([pose, sequence]) => [pose, sequence.value]));

export const P4_ASSETS = {
  npcs: {
    ocellus: { id: boss.npcId.value, animations: sequences(presentation.bossPoses) },
    voidRift: { id: rifts.npcId.value, animations: sequences(rifts.poses) },
  },
  models: {
    brazier: { id: geometry.brazier.value.model, animations: { burning: geometry.brazier.value.burning } },
    voidHole: { id: floorHoles.look.model.value, animations: { idle: floorHoles.look.idle.value } },
  },
  items: Object.fromEntries(Object.entries(OCELLUS_P4.gear.items).map(([key, item]) => [key, { id: item.itemId.value }])),
  spotAnims: Object.fromEntries([
    ...Object.entries(lifeforceOrb.look).map(([visual, spotAnim]) => [visual, { id: spotAnim.value }]),
    ...Object.entries(presentation.transitionTells).map(([variant, spotAnim]) => [`${variant.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())}Tell`, { id: spotAnim.value }]),
    ["riftFlare", { id: rifts.burstFlare.value }],
    ["explosion", { id: explosion.spotAnim.value }],
  ]),
  sounds: Object.fromEntries(Object.entries(presentation.sounds).map(([cue, sound]) => [cue, { id: sound.value }])),
} as const satisfies CacheAssets;

/** Npc, model and spotanim ids a flags-off page can draw: phase 4 plus the encounter rooms. */
const crackSpotAnims = [
  ...Object.entries(P1_ROOM.crackPieces.straight),
  ...Object.entries(P1_ROOM.crackPieces.diagonal),
].flatMap(([name, pieces]) => (["start", "piece", "end"] as const).map((part) => [`p1Crack${name}${part}`, { id: pieces[part] }] as const));

export const SERVED_ASSETS = {
  npcs: {
    ...P4_ASSETS.npcs,
    bork: { id: ARCHIVE.bork.npcId },
    smorks: { id: ARCHIVE.bork.smorkNpcId },
    ezekiel: { id: ARCHIVE.ezekiel.npcId },
    archiveGuardian: { id: ARCHIVE.guardian.flyingNpcId },
    archiveGuardianGrounded: { id: ARCHIVE.guardian.groundedNpcId },
    guardianBattery: { id: ARCHIVE.guardian.batteryNpcId },
    moia: { id: ARCHIVE.moia.npcId },
    undeadBinder: { id: ARCHIVE.moia.binderNpcId },
    xarth: { id: ARCHIVE.xarth.npcId },
    dagonhai: { id: ARCHIVE.dagonhai.npcId },
    ocellusPhase1: { id: ARCHIVE.p1.npcId },
    hoodedFigure: { id: ARCHIVE.p1.hoodedNpcId },
    theBlade: { id: ARCHIVE.p2.npcId },
    voidSiphon: { id: ARCHIVE.p3.siphonNpcId },
    voidAugmenter: { id: ARCHIVE.p3.augmenterNpcId },
  },
  models: {
    ...P4_ASSETS.models,
    theBlade: { id: BLADE_MODEL },
    raggedTile: { id: OIL_MODEL },
    p2PortalInactive: { id: P2_ROOM.looks.inactive.model },
    p2PortalLit: { id: P2_ROOM.looks.lit.model },
  },
  spotAnims: Object.fromEntries([
    ...Object.entries(P4_ASSETS.spotAnims),
    ...Object.entries(GRAPHICS).map(([name, id]) => [name, { id }]),
    ...SMORK_SPLATS.map((id) => [`raidSmorkSplat${id}`, { id }] as const),
    ...crackSpotAnims,
    ...P1_ROOM.floorExplosions.pieces.map((id) => [`p1Floor${id}`, { id }] as const),
  ]),
} as const;

export type ConfiguredIds = Readonly<Record<string, Readonly<{ id: number }>>>;

export type ManifestIndex = Pick<CacheRenderBundleManifest, "references" | "spotAnims" | "playerItems" | "sharedAssets">;

export const INDEXED_CATEGORIES = ["npcs", "models", "spotAnims", "items", "playerAnimations"] as const;
export type IndexedCategory = (typeof INDEXED_CATEGORIES)[number];

export function manifestAssetKeys(manifest: ManifestIndex, category: IndexedCategory, id: number): readonly string[] | undefined {
  const one = (key: string | undefined) => (key === undefined ? undefined : [key]);
  switch (category) {
    case "npcs":
      return manifest.references[`npc:${id}`];
    case "models":
      return manifest.references[`model:${id}`];
    case "spotAnims":
      return one(manifest.spotAnims?.[id]);
    case "items":
      return one(manifest.playerItems?.[`item:${id}`]);
    case "playerAnimations":
      return one(manifest.sharedAssets?.playerAnimations);
    default: {
      const unhandled: never = category;
      return unhandled;
    }
  }
}

const RENDER_CATEGORIES = ["npcs", "models", "spotAnims"] as const satisfies readonly IndexedCategory[];

const RENDERED: Readonly<Record<(typeof RENDER_CATEGORIES)[number], ConfiguredIds>> = SERVED_ASSETS;

export function reportUnservedAssets(manifest: CacheRenderBundleManifest): void {
  for (const category of RENDER_CATEGORIES) {
    for (const [name, { id }] of Object.entries(RENDERED[category])) {
      if (manifestAssetKeys(manifest, category, id) === undefined) console.error(`assets: osrs-assets/manifest.json has no ${category}.${name} (${id}); rebuild public/osrs-assets with npm run assets`);
    }
  }
}

export const ITEM_ICON_DIR = "item-icons";
export const itemIconFile = (itemId: number) => `${ITEM_ICON_DIR}/${itemId}.png`;

export function spriteFile({ archive, frame }: SpriteFrame): string {
  return `sprites/${archive}-${frame}.png`;
}
