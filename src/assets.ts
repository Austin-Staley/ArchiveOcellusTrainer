import type { CacheAssets } from "osrs-sdk/asset-manifest";
import { BLADE_MODEL, BLADE_STAND, GRAPHICS, PLAYER_BLOCK, REGION_IDS, SEQUENCES } from "./content/archive/poses";
import { ARCHIVE } from "./content/archive/timings";
import type { SpriteFrame } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P3, OCELLUS_P4 } from "./content/ocellus/js/OcellusTimings";

const { boss, gear, presentation, lifeforceOrb, rifts, explosion, geometry, floorHoles } = OCELLUS_P4;

const sequences = (poses: Readonly<Record<string, Readonly<{ value: number }>>>) => Object.fromEntries(Object.entries(poses).map(([pose, sequence]) => [pose, sequence.value]));

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
    ocellusPhase1: { id: ARCHIVE.p1.npcId, animations: poseMap(SEQUENCES.p1) },
    hoodedFigure: { id: ARCHIVE.p1.hoodedNpcId, animations: poseMap(SEQUENCES.hooded) },
    theBlade: { id: ARCHIVE.p2.npcId },
    voidSiphon: { id: ARCHIVE.p3.siphonNpcId, animations: poseMap(SEQUENCES.siphon) },
    voidAugmenter: { id: ARCHIVE.p3.augmenterNpcId, animations: poseMap(SEQUENCES.augmenter) },
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
    ["raidP3Void", { id: GRAPHICS.p3Void }],
    ["raidSmorkBomb", { id: GRAPHICS.smorkBomb }],
  ]),
  playerAnimations: {
    block: { id: PLAYER_BLOCK },
  },
  sounds: Object.fromEntries(Object.entries(presentation.sounds).map(([cue, sound]) => [cue, { id: sound.value }])),
} as const satisfies CacheAssets;

export const ITEM_ICON_DIR = "item-icons";
export const itemIconFile = (itemId: number) => `${ITEM_ICON_DIR}/${itemId}.png`;
export const ITEM_ICON_IDS = [...Object.values(gear.items).map((item) => item.itemId.value), ...Object.values(gear.sdkIcons).map((itemId) => itemId.value)];

export const ARCHIVE_OCELLUS_OVERRIDES = {
  items: Object.fromEntries(Object.entries(gear.sdkCacheIds).map(([key, id]) => [key, { id: id.value }])),
} as const satisfies CacheAssets;

/** The asset tool extracts no sprites, so scripts/extract-sprites.mjs writes these beside its output. */
export const ARCHIVE_OCELLUS_SPRITES: readonly SpriteFrame[] = Object.values(presentation.overheadIcons).map((icon) => icon.value);

export function spriteFile({ archive, frame }: SpriteFrame): string {
  return `sprites/${archive}-${frame}.png`;
}
