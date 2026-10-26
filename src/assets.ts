import type { CacheRenderBundleManifest } from "osrs-sdk";
import type { CacheAssets } from "osrs-sdk/asset-manifest";
import { BLADE_MODEL, BLADE_STAND, GRAPHICS, PLAYER_BLOCK, REGION_IDS, SEQUENCES } from "./content/archive/poses";
import { ARCHIVE } from "./content/archive/timings";
import type { SpriteFrame } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P1, OCELLUS_P2, OCELLUS_P3, OCELLUS_P4 } from "./content/ocellus/js/OcellusTimings";
import { readBuildFlags } from "./flags";

const { boss, gear, presentation, lifeforceOrb, rifts, explosion, geometry, floorHoles } = OCELLUS_P4;

const sequences = (poses: Readonly<Record<string, Readonly<{ value: number }>>>) => Object.fromEntries(Object.entries(poses).map(([pose, sequence]) => [pose, sequence.value]));
const { looks: portalLooks } = OCELLUS_P2.portals;
const p2Key = (name: string) => `p2${name.charAt(0).toUpperCase()}${name.slice(1)}`;
/**
 * The encounter room always draws the two portal models. The rest of phase 2's poses and spotanims stay behind ARCHIVE_P2,
 * so a build with the drill hidden does not ask the cache for the drill. Cache 2746 also lacks three of its poses' frame sounds (12814, 12825, 12832).
 */
const { p2 } = readBuildFlags();

const P1_LOOK = OCELLUS_P1.presentation;
const p1CrackPieces = [...Object.values(P1_LOOK.crackPieces.straight), ...Object.values(P1_LOOK.crackPieces.diagonal)].flatMap(({ value }) => [value.start, value.piece, value.end]);
const p1SpotAnims = [
  ...Object.entries(P1_LOOK.spotAnims).map(([name, spotAnim]) => [`p1${name.charAt(0).toUpperCase()}${name.slice(1)}`, { id: spotAnim.value }]),
  ...[...p1CrackPieces, ...P1_LOOK.floorExplosions.value.pieces].map((id) => [`p1Floor${id}`, { id }]),
];

function poseMap<T extends Readonly<Record<string, number>>>(poses: T): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(poses));
}

export const ARCHIVE_OCELLUS_ASSETS = {
  npcs: {
    ocellus: { id: boss.npcId.value, animations: { ...sequences(presentation.bossPoses), ...sequences(OCELLUS_P3.bossPoses) } },
    voidRift: { id: rifts.npcId.value, animations: sequences(rifts.poses) },
    bork: { id: ARCHIVE.bork.npcId, animations: poseMap(SEQUENCES.bork) },
    smorks: { id: ARCHIVE.bork.smorkNpcId, animations: poseMap(SEQUENCES.smorks) },
    ezekiel: { id: ARCHIVE.ezekiel.npcId, animations: poseMap(SEQUENCES.ezekiel) },
    archiveGuardian: { id: ARCHIVE.guardian.flyingNpcId, animations: poseMap(SEQUENCES.guardian) },
    archiveGuardianGrounded: { id: ARCHIVE.guardian.groundedNpcId, animations: poseMap(SEQUENCES.guardian) },
    guardianBattery: { id: ARCHIVE.guardian.batteryNpcId, animations: poseMap(SEQUENCES.battery) },
    moia: { id: ARCHIVE.moia.npcId, animations: poseMap(SEQUENCES.moia) },
    undeadBinder: { id: ARCHIVE.moia.binderNpcId, animations: poseMap(SEQUENCES.binder) },
    xarth: { id: ARCHIVE.xarth.npcId, animations: poseMap(SEQUENCES.xarth) },
    dagonhai: { id: ARCHIVE.dagonhai.npcId, animations: poseMap(SEQUENCES.dagon) },
    ocellusPhase1: { id: ARCHIVE.p1.npcId, animations: { ...poseMap(SEQUENCES.p1), ...sequences(P1_LOOK.bossPoses) } },
    hoodedFigure: { id: ARCHIVE.p1.hoodedNpcId, animations: poseMap(SEQUENCES.hooded) },
    theBlade: { id: ARCHIVE.p2.npcId },
    voidSiphon: { id: ARCHIVE.p3.siphonNpcId, animations: poseMap(SEQUENCES.siphon) },
    voidAugmenter: { id: ARCHIVE.p3.augmenterNpcId, animations: poseMap(SEQUENCES.augmenter) },
    ...(p2 ? { ocellusP2: { id: OCELLUS_P2.ocellusNpcId.value, animations: sequences(OCELLUS_P2.bossPoses) } } : {}),
  },
  regions: {
    raidBork: { id: REGION_IDS.bork },
    raidEzekiel: { id: REGION_IDS.ezekiel },
    raidGuardian: { id: REGION_IDS.guardian },
    raidMoia: { id: REGION_IDS.moia },
    raidXarth: { id: REGION_IDS.xarth },
    raidDagonhai: { id: REGION_IDS.dagonhai },
    raidOcellus: { id: REGION_IDS.ocellus },
  },
  models: {
    brazier: { id: geometry.brazier.value.model, animations: { burning: geometry.brazier.value.burning } },
    voidHole: { id: floorHoles.look.model.value, animations: { idle: floorHoles.look.idle.value } },
    theBlade: { id: BLADE_MODEL, animations: { stand: BLADE_STAND } },
    raggedTile: { id: ARCHIVE.bork.oil.model },
    p2PortalInactive: { id: portalLooks.value.inactive.model, animations: { idle: portalLooks.value.inactive.idle } },
    p2PortalLit: { id: portalLooks.value.lit.model, animations: { idle: portalLooks.value.lit.idle } },
  },
  items: Object.fromEntries(Object.entries(gear.items).map(([key, item]) => [key, { id: item.itemId.value }])),
  spotAnims: Object.fromEntries([
    ...Object.entries(lifeforceOrb.look).map(([visual, spotAnim]) => [visual, { id: spotAnim.value }]),
    ...Object.entries(presentation.transitionTells).map(([variant, spotAnim]) => [`${variant.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())}Tell`, { id: spotAnim.value }]),
    ["riftFlare", { id: rifts.burstFlare.value }],
    ["explosion", { id: explosion.spotAnim.value }],
    ["raidGuardianRanged", { id: GRAPHICS.guardianRanged }],
    ["raidGuardianBeam", { id: GRAPHICS.guardianBeam }],
    ["raidGuardianMushroom", { id: GRAPHICS.guardianMushroom }],
    ["raidMoiaRanged", { id: GRAPHICS.moiaRanged }],
    ["raidMoiaRelocate", { id: GRAPHICS.moiaRelocate }],
    ["raidXarthMagic", { id: GRAPHICS.xarthMagic }],
    ["raidXarthRanged", { id: GRAPHICS.xarthRanged }],
    ["raidXarthTell", { id: GRAPHICS.xarthTell }],
    ["raidDagonRanged", { id: GRAPHICS.dagonRanged }],
    ["raidDagonMagic", { id: GRAPHICS.dagonMagic }],
    ["raidP1Magic", { id: GRAPHICS.p1Magic }],
    ["raidP1Ranged", { id: GRAPHICS.p1Ranged }],
    ["raidP2Volley", { id: GRAPHICS.p2Volley }],
    ["raidP2Repair", { id: GRAPHICS.p2Repair }],
    ["raidP3Void", { id: GRAPHICS.p3Void }],
    ["raidP3Spin", { id: GRAPHICS.p3Spin }],
    ["raidSmorkBomb", { id: GRAPHICS.smorkBomb }],
    ["raidSmorkNapalm", { id: GRAPHICS.smorkNapalm }],
    ["raidSmorkMarker", { id: GRAPHICS.smorkMarker }],
    ["raidSmorkFire", { id: GRAPHICS.smorkFire }],
    ["raidSmorkHeavyMarker", { id: GRAPHICS.smorkHeavyMarker }],
    ["raidSmorkHeavySpot", { id: GRAPHICS.smorkHeavySpot }],
    ["raidSmorkHeavyFlash", { id: GRAPHICS.smorkHeavyFlash }],
    ...ARCHIVE.bork.cannon.splats.map((id) => [`raidSmorkSplat${id}`, { id }] as const),
    ...p1SpotAnims,
    ...(p2 ? Object.entries(OCELLUS_P2.spotAnims).map(([name, spotAnim]) => [p2Key(name), { id: spotAnim.value }]) : []),
  ]),
  playerAnimations: {
    block: { id: PLAYER_BLOCK },
  },
  sounds: Object.fromEntries(Object.entries(presentation.sounds).map(([cue, sound]) => [cue, { id: sound.value }])),
} as const satisfies CacheAssets;

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

const RENDERED: Readonly<Record<(typeof RENDER_CATEGORIES)[number], ConfiguredIds>> = ARCHIVE_OCELLUS_ASSETS;

export function reportUnservedAssets(manifest: CacheRenderBundleManifest): void {
  for (const category of RENDER_CATEGORIES) {
    for (const [name, { id }] of Object.entries(RENDERED[category])) {
      if (manifestAssetKeys(manifest, category, id) === undefined) console.error(`assets: osrs-assets/manifest.json has no ${category}.${name} (${id}); rebuild public/osrs-assets with npm run assets`);
    }
  }
}

export const ITEM_ICON_DIR = "item-icons";
export const itemIconFile = (itemId: number) => `${ITEM_ICON_DIR}/${itemId}.png`;
export const ITEM_ICON_IDS = [...Object.values(gear.items).map((item) => item.itemId.value), ...Object.values(gear.sdkIcons).map((itemId) => itemId.value)];

export const ARCHIVE_OCELLUS_OVERRIDES = {
  items: Object.fromEntries(Object.entries(gear.sdkCacheIds).map(([key, id]) => [key, { id: id.value }])),
} as const satisfies CacheAssets;

/** The asset tool extracts no sprites, so scripts/extract-sprites.mjs writes these beside its output. */
export const ARCHIVE_OCELLUS_SPRITES: readonly SpriteFrame[] = [...Object.values(presentation.overheadIcons).map((icon) => icon.value), P1_LOOK.overheadIcon.value];

export function spriteFile({ archive, frame }: SpriteFrame): string {
  return `sprites/${archive}-${frame}.png`;
}
