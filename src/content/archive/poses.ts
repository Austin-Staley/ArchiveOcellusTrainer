import type { RaidId } from "./catalog";
import { ARCHIVE } from "./timings";

/**
 * Animation and graphic ids from the 25 Oct 2026 render digest.
 * A sequence with no captured id is absent here, and the room leaves it as a stand-in.
 * The Blade (16676) and the void vine (16681) have no captured animations.
 * Ocellus has no captured death animation. Projectile sources 4056 and 4057 were not resolved.
 */

/**
 * Compiled terrain sits at (tile height - the region's base) / 128.
 * These shifts are that value at each room's captured boss tile, from cache 2746,
 * so the fight plane lands on the walk floor.
 * Ocellus plane 1 is height byte 96, which is 768 above the plane below it: 768 / 128 = 6.
 * The compiled fight floor sits at that 6. The lower strip of the same region is a different height and is not the boss tile.
 */
export const OCELLUS_PLANE_DROP = 768 / 128;
const EZEKIEL_FLOOR_LIFT = 240 / 128;
const LOW_FLOOR_DROP = 120 / 128;

export const PLAYER_BLOCK = 424;

export const SEQUENCES = {
  bork: { drum: 14542, oof: 14545, veryAngry: 14549, stomp: 14550, cycle: 14551, death: 14541 },
  smorks: { bomb: 14555 },
  hooded: { idle: 14804 },
  battery: { idle: 15024, death: 15025 },
  ezekiel: { melee: 14685, sword: 14687, stun: 14691, recover: 14693, heal: 14688, wave: 14694 },
  guardian: { ranged: 14751, mushroom: 14753, takeoff: 14748, beam: 14754, land: 14747, death: 14749 },
  moia: { ranged: 14785, relocate: 14788, chant: 14787 },
  binder: { attack: 14791, death: 14792 },
  xarth: { magic: 14984, ranged: 14985, tell: 14992, blast: 14989, death: 14995 },
  dagon: { magic: 14597, ranged: 14593 },
  p1: { magic: 14806, ranged: 14807, charge: 14809, slam: 14811, strike: 14810 },
  p3: { melee: 14842, wave: 14846, voidShot: 14851, spin: 14869 },
  rift: { spawn: 14896, death: 14897 },
  siphon: { spawn: 14900, death: 14901 },
  augmenter: { spawn: 14904, death: 14905 },
} as const;

export const GRAPHICS = {
  guardianRanged: 4201,
  guardianBeam: 4204,
  guardianMushroom: 4205,
  moiaRanged: 4214,
  moiaRelocate: 4213,
  xarthMagic: 4034,
  xarthRanged: 4374,
  xarthTell: 4378,
  dagonRanged: 4071,
  dagonMagic: 1459,
  p1Magic: 4229,
  p1Ranged: 4232,
  /**
   * Portal bolt. Fight logs L1–L8 name projectile 4269 as each lit portal's bolt.
   * The digest counted 314 of them and did not resolve a source.
   */
  p2Volley: 4269,
  /** Sword-repair particles. 31 fights, 1,262 spawns, life mode 3. The logs play this on the middle every 3 ticks. */
  p2Repair: 4304,
  p3Void: 4297,
  /** On every phase 3 spin, animation 14869. 31 fights, 192 of 192. */
  p3Spin: 4325,
  /** From the Smorks, animation 14555. Flight in the capture is 4.5 ticks. */
  smorkBomb: 4440,
} as const;

/** Template regions from the digest. Chunk rotation is 0. Dreadnoth's 16728 is data only and is not loaded. */
export const REGION_IDS = {
  guardian: 16471,
  ocellus: 16472,
  bork: 16727,
  xarth: 16726,
  moia: 16216,
  ezekiel: 16214,
  dagonhai: 16215,
} as const;

/**
 * Cache 2746, region 16472. Object 62706, The Blade, is the only blade placed on the map,
 * at local (31, 41), the centre of monster 16676. Model 62699 holds both swords.
 * Sequence 14873 is that object's one-frame stand, and it hides the sword that is not on this tile.
 * The captures spawn 62707 and 62709 only in phase 2, and only for part of the fight.
 */
export const BLADE_SCENERY = 62706;
export const BLADE_MODEL = 62699;
export const BLADE_STAND = 14873;
/**
 * Tiles the drawn sword sits above model 62699's origin after sequence 14873.
 * Cache 2746. The faces that reach the origin are hidden; the sword that remains starts here.
 * A downward camera paints that height behind the ground marker, so phase 2 lowers the actor by it.
 */
export const BLADE_SEAT = 3.135;

export type ArenaPlace = Readonly<{ region: number; offsetX: number; offsetY: number; elevation: number }>;

/**
 * The scene mesh is region-local. Tile (tx, ty) lands on mesh X = tx and mesh Z = 63 - ty.
 * offsetX = trainerBossX - capturedLocalX. offsetY = trainerBossY - 63 + capturedLocalY.
 * The walk grid stays the room layout. This only slides the captured map onto the boss tile.
 */
export function arenaFor(id: RaidId): ArenaPlace {
  switch (id) {
    case "bork":
      return { region: REGION_IDS.bork, offsetX: -16, offsetY: -19, elevation: 0 };
    case "ezekiel":
      return { region: REGION_IDS.ezekiel, offsetX: -22, offsetY: -24, elevation: EZEKIEL_FLOOR_LIFT };
    case "guardian":
      return { region: REGION_IDS.guardian, offsetX: -18, offsetY: -23, elevation: 0 };
    case "moia":
      return { region: REGION_IDS.moia, offsetX: -23, offsetY: -26, elevation: -LOW_FLOOR_DROP };
    case "xarth":
      return { region: REGION_IDS.xarth, offsetX: -23, offsetY: -26, elevation: 0 };
    case "dagonhai":
      return { region: REGION_IDS.dagonhai, offsetX: -26, offsetY: -20, elevation: -LOW_FLOOR_DROP };
    case "ocellus-p1":
      return { region: REGION_IDS.ocellus, offsetX: -25, offsetY: -6, elevation: -OCELLUS_PLANE_DROP };
    case "ocellus-p2":
      // Object 62706, The Blade, is cache local (31, 41): the centre of monster 16676's 3x3, which is trainer (12, 12).
      // The scene mirror flips local Y, so offsetY pins that centre on tile y 12. Pinning the south-west tile (30, 40) on (11, 11) left the model two tiles toward the camera.
      return { region: REGION_IDS.ocellus, offsetX: -19, offsetY: -10, elevation: -OCELLUS_PLANE_DROP };
    case "ocellus-p3":
      return { region: REGION_IDS.ocellus, offsetX: -31, offsetY: -11, elevation: -OCELLUS_PLANE_DROP };
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

export type ActorRole = "boss" | "smorks" | "binder";

export function attackSequence(id: RaidId, name: string): Readonly<{ role: ActorRole; sequence: number }> | null {
  switch (id) {
    case "bork":
      switch (name) {
        case "drum":
        case "drum-resume":
          return { role: "boss", sequence: SEQUENCES.bork.drum };
        case "oof":
          return { role: "boss", sequence: SEQUENCES.bork.oof };
        case "very-angry":
          return { role: "boss", sequence: SEQUENCES.bork.veryAngry };
        case "14550":
          return { role: "boss", sequence: SEQUENCES.bork.stomp };
        case "14551":
          return { role: "boss", sequence: SEQUENCES.bork.cycle };
        case "bomb-tell":
          return { role: "smorks", sequence: SEQUENCES.smorks.bomb };
        default:
          return null;
      }
    case "ezekiel":
      switch (name) {
        case "melee":
          return { role: "boss", sequence: SEQUENCES.ezekiel.melee };
        case "special":
          return { role: "boss", sequence: SEQUENCES.ezekiel.sword };
        case "stun":
          return { role: "boss", sequence: SEQUENCES.ezekiel.stun };
        case "stun-end":
          return { role: "boss", sequence: SEQUENCES.ezekiel.recover };
        case "heal":
          return { role: "boss", sequence: SEQUENCES.ezekiel.heal };
        case "wave":
          return { role: "boss", sequence: SEQUENCES.ezekiel.wave };
        default:
          return null;
      }
    case "guardian":
      switch (name) {
        case "14751":
          return { role: "boss", sequence: SEQUENCES.guardian.ranged };
        case "mushroom":
          return { role: "boss", sequence: SEQUENCES.guardian.mushroom };
        case "14747":
          return { role: "boss", sequence: SEQUENCES.guardian.land };
        case "14748":
          return { role: "boss", sequence: SEQUENCES.guardian.takeoff };
        case "beam":
          return { role: "boss", sequence: SEQUENCES.guardian.beam };
        default:
          return null;
      }
    case "moia":
      switch (name) {
        case "14785":
          return { role: "boss", sequence: SEQUENCES.moia.ranged };
        case "relocate":
          return { role: "boss", sequence: SEQUENCES.moia.relocate };
        case "chant":
          return { role: "boss", sequence: SEQUENCES.moia.chant };
        case "14791":
          return { role: "binder", sequence: SEQUENCES.binder.attack };
        default:
          return null;
      }
    case "xarth":
      switch (name) {
        case "14984":
          return { role: "boss", sequence: SEQUENCES.xarth.magic };
        case "14985":
          return { role: "boss", sequence: SEQUENCES.xarth.ranged };
        case "14992":
          return { role: "boss", sequence: SEQUENCES.xarth.tell };
        case "14989":
          return { role: "boss", sequence: SEQUENCES.xarth.blast };
        default:
          return null;
      }
    case "dagonhai":
      switch (name) {
        case "14597":
          return { role: "boss", sequence: SEQUENCES.dagon.magic };
        case "14593":
          return { role: "boss", sequence: SEQUENCES.dagon.ranged };
        default:
          return null;
      }
    case "ocellus-p1":
      switch (name) {
        case "4229":
          return { role: "boss", sequence: SEQUENCES.p1.magic };
        case "4232":
          return { role: "boss", sequence: SEQUENCES.p1.ranged };
        case "14809":
          return { role: "boss", sequence: SEQUENCES.p1.charge };
        case "14811":
        case "slam":
          return { role: "boss", sequence: SEQUENCES.p1.slam };
        case "14810":
          return { role: "boss", sequence: SEQUENCES.p1.strike };
        default:
          return null;
      }
    case "ocellus-p2":
      return null;
    case "ocellus-p3":
      switch (name) {
        case "melee":
          return { role: "boss", sequence: SEQUENCES.p3.melee };
        case "wave":
          return { role: "boss", sequence: SEQUENCES.p3.wave };
        case "void-shot":
          return { role: "boss", sequence: SEQUENCES.p3.voidShot };
        case "spin":
          return { role: "boss", sequence: SEQUENCES.p3.spin };
        default:
          return null;
      }
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

export function deathSequence(npcId: number): number | null {
  switch (npcId) {
    case ARCHIVE.bork.npcId:
      return SEQUENCES.bork.death;
    case ARCHIVE.guardian.flyingNpcId:
    case ARCHIVE.guardian.groundedNpcId:
      return SEQUENCES.guardian.death;
    case ARCHIVE.guardian.batteryNpcId:
      return SEQUENCES.battery.death;
    case ARCHIVE.moia.binderNpcId:
      return SEQUENCES.binder.death;
    case ARCHIVE.xarth.npcId:
      return SEQUENCES.xarth.death;
    case ARCHIVE.p3.riftNpcId:
      return SEQUENCES.rift.death;
    case ARCHIVE.p3.siphonNpcId:
      return SEQUENCES.siphon.death;
    case ARCHIVE.p3.augmenterNpcId:
      return SEQUENCES.augmenter.death;
    default:
      return null;
  }
}

export function spawnSequence(npcId: number): number | null {
  switch (npcId) {
    case ARCHIVE.p3.riftNpcId:
      return SEQUENCES.rift.spawn;
    case ARCHIVE.p3.siphonNpcId:
      return SEQUENCES.siphon.spawn;
    case ARCHIVE.p3.augmenterNpcId:
      return SEQUENCES.augmenter.spawn;
    default:
      return null;
  }
}
