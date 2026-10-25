import type { CacheAssets } from "osrs-sdk/asset-manifest";
import { ARCHIVE } from "./content/archive/timings";
import type { SpriteFrame } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P3, OCELLUS_P4 } from "./content/ocellus/js/OcellusTimings";

const { boss, gear, presentation, lifeforceOrb, rifts, explosion, geometry, floorHoles } = OCELLUS_P4;

const sequences = (poses: Readonly<Record<string, Readonly<{ value: number }>>>) => Object.fromEntries(Object.entries(poses).map(([pose, sequence]) => [pose, sequence.value]));

export const ARCHIVE_OCELLUS_ASSETS = {
  npcs: {
    ocellus: { id: boss.npcId.value, animations: { ...sequences(presentation.bossPoses), ...sequences(OCELLUS_P3.bossPoses) } },
    voidRift: { id: rifts.npcId.value, animations: sequences(rifts.poses) },
    bork: { id: ARCHIVE.bork.npcId },
    smorks: { id: ARCHIVE.bork.smorkNpcId },
    ezekiel: { id: ARCHIVE.ezekiel.npcId },
    archiveGuardian: { id: ARCHIVE.guardian.flyingNpcId },
    archiveGuardianGrounded: { id: ARCHIVE.guardian.groundedNpcId },
    moia: { id: ARCHIVE.moia.npcId },
    undeadBinder: { id: ARCHIVE.moia.binderNpcId },
    xarth: { id: ARCHIVE.xarth.npcId },
    dagonhai: { id: ARCHIVE.dagonhai.npcId },
    ocellusPhase1: { id: ARCHIVE.p1.npcId },
    theBlade: { id: ARCHIVE.p2.npcId },
    voidSiphon: { id: ARCHIVE.p3.siphonNpcId },
    voidAugmenter: { id: ARCHIVE.p3.augmenterNpcId },
  },
  models: {
    brazier: { id: geometry.brazier.value.model, animations: { burning: geometry.brazier.value.burning } },
    voidHole: { id: floorHoles.look.model.value, animations: { idle: floorHoles.look.idle.value } },
  },
  items: Object.fromEntries(Object.entries(gear.items).map(([key, item]) => [key, { id: item.itemId.value }])),
  spotAnims: Object.fromEntries([
    ...Object.entries(lifeforceOrb.look).map(([visual, spotAnim]) => [visual, { id: spotAnim.value }]),
    ...Object.entries(presentation.transitionTells).map(([variant, spotAnim]) => [`${variant.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())}Tell`, { id: spotAnim.value }]),
    ["riftFlare", { id: rifts.burstFlare.value }],
    ["explosion", { id: explosion.spotAnim.value }],
  ]),
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
