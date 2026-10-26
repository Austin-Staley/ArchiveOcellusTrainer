import type { CacheAssets } from "osrs-sdk/asset-manifest";
import { BLADE_MODEL, BLADE_STAND, GRAPHICS, PLAYER_BLOCK, REGION_IDS, SEQUENCES } from "./content/archive/poses";
import { ARCHIVE } from "./content/archive/timings";
import type { SpriteFrame } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P4 } from "./content/ocellus/js/OcellusTimings";
import { OCELLUS_P1 } from "./content/ocellus/js/OcellusTimingsP1";
import { OCELLUS_P2 } from "./content/ocellus/js/OcellusTimingsP2";
import { OCELLUS_P3 } from "./content/ocellus/js/OcellusTimingsP3";
import { readBuildFlags } from "./flags";
import { P4_ASSETS, sequences } from "./servedAssets";

export { spriteFile } from "./servedAssets";

const { gear, presentation } = OCELLUS_P4;

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
    ocellus: { ...P4_ASSETS.npcs.ocellus, animations: { ...P4_ASSETS.npcs.ocellus.animations, ...sequences(OCELLUS_P3.bossPoses) } },
    voidRift: P4_ASSETS.npcs.voidRift,
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
    ...P4_ASSETS.models,
    theBlade: { id: BLADE_MODEL, animations: { stand: BLADE_STAND } },
    p2PortalInactive: { id: portalLooks.value.inactive.model, animations: { idle: portalLooks.value.inactive.idle } },
    p2PortalLit: { id: portalLooks.value.lit.model, animations: { idle: portalLooks.value.lit.idle } },
  },
  items: P4_ASSETS.items,
  spotAnims: Object.fromEntries([
    ...Object.entries(P4_ASSETS.spotAnims),
    ...Object.entries(GRAPHICS).map(([name, id]) => [name, { id }]),
    ...p1SpotAnims,
    ...(p2 ? Object.entries(OCELLUS_P2.spotAnims).map(([name, spotAnim]) => [p2Key(name), { id: spotAnim.value }]) : []),
  ]),
  playerAnimations: {
    block: { id: PLAYER_BLOCK },
  },
  sounds: P4_ASSETS.sounds,
} as const satisfies CacheAssets;

export const ITEM_ICON_IDS = [...Object.values(gear.items).map((item) => item.itemId.value), ...Object.values(gear.sdkIcons).map((itemId) => itemId.value)];

export const ARCHIVE_OCELLUS_OVERRIDES = {
  items: Object.fromEntries(Object.entries(gear.sdkCacheIds).map(([key, id]) => [key, { id: id.value }])),
} as const satisfies CacheAssets;

/** The asset tool extracts no sprites, so scripts/extract-sprites.mjs writes these beside its output. */
export const ARCHIVE_OCELLUS_SPRITES: readonly SpriteFrame[] = [...Object.values(presentation.overheadIcons).map((icon) => icon.value), P1_LOOK.overheadIcon.value];
