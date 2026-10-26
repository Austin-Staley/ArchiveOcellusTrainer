import type { Tile } from "../../sim/brands";
import { tile } from "../../sim/brands";
import type { Mobility } from "../movementDebug";
import type { RaidId } from "./catalog";
import type { RaidMemory } from "./clock";
import { ROOMS } from "./layout";
import { ARCHIVE } from "./timings";

type Bound = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

/**
 * Where a boss may put his south-west anchor, from the 25 Oct 2026 render digest.
 * `exact` is set only when the listed tiles account for every sample. Otherwise the inclusive box is the limit
 * and the tiles inside it that were not listed are a stand-in: the digest kept six rows, not the full histogram.
 */
export type BossWalk = Readonly<{
  actor: string;
  npcId: number;
  size: number;
  fights: number;
  samples: number;
  status: "captured" | "stand-in" | "disputed";
  exact: readonly Tile[] | null;
  bound: Bound;
  note: string;
}>;

export const BOSS_WALK: Readonly<Record<RaidId, BossWalk>> = {
  bork: {
    actor: "Bork",
    npcId: 16640,
    size: 4,
    fights: 107,
    samples: 6767,
    status: "stand-in",
    exact: null,
    bound: { minX: 8, minY: 8, maxX: 19, maxY: 21 },
    note: "107 fights. The six listed tiles are 1,293 of 6,767 samples, led by the mode (10, 12) at 229. No tick path. He holds that mode tile. An anchor outside the box is blocked.",
  },
  ezekiel: {
    actor: "Ezekiel",
    npcId: 16652,
    size: 3,
    fights: 10,
    samples: 470,
    status: "stand-in",
    exact: null,
    bound: { minX: 5, minY: 6, maxX: 11, maxY: 12 },
    note: "10 fights. The six listed tiles are 140 of 470 samples, led by (8, 8) at 27. No tick path. He holds (8, 8). Anchors outside the box are blocked.",
  },
  guardian: {
    actor: "Archive Guardian",
    npcId: 16659,
    size: 5,
    fights: 175,
    samples: 318,
    status: "stand-in",
    exact: null,
    bound: { minX: 2, minY: -4, maxX: 22, maxY: 36 },
    note: "175 flying fights, npc 16659, 318 samples. The mode (11, 11) leads with 41. The one grounded sample of 16660 is the same tile. No tick path. He holds (11, 11). The room clips the box to its grid.",
  },
  moia: {
    actor: "Moia",
    npcId: 16667,
    size: 3,
    fights: 3,
    samples: 17,
    status: "captured",
    exact: [tile(0, 7), tile(7, 0), tile(14, 7), tile(7, 7), tile(7, 14)],
    bound: { minX: 0, minY: 0, maxX: 14, maxY: 14 },
    note: "3 fights, 17 samples, and the five tiles are all of them: (0, 7) ×7, (7, 0) ×5, (14, 7) ×2, (7, 7) ×2, (7, 14) ×1. Every other anchor is blocked.",
  },
  xarth: {
    actor: "Xarth",
    npcId: 16684,
    size: 3,
    fights: 40,
    samples: 40,
    status: "captured",
    exact: [tile(7, 7)],
    bound: { minX: 7, minY: 7, maxX: 7, maxY: 7 },
    note: "40 fights, 40 samples, one tile (7, 7). He never moves. Every other anchor is blocked.",
  },
  dagonhai: {
    actor: "Dagon'hai Elder",
    npcId: 16643,
    size: 2,
    fights: 1,
    samples: 17,
    status: "stand-in",
    exact: null,
    bound: { minX: -1, minY: 8, maxX: 4, maxY: 16 },
    note: "1 fight, 17 samples. Six listed tiles sum to 7, led by the spawn (2, 9) at 2. No tick path. He holds (2, 9). The room clips the box, so the captured anchor at x -1 is blocked here.",
  },
  "ocellus-p1": {
    actor: "Ocellus",
    npcId: 16674,
    size: 3,
    fights: 32,
    samples: 2167,
    status: "disputed",
    exact: null,
    bound: { minX: -1, minY: 11, maxX: 11, maxY: 23 },
    note: "32 fights, 2,167 samples. The mode (5, 17) has 129 and is the middle. The four corner clusters are (-1, 23), (-1, 11), (11, 23) and (11, 11), the drill corners shifted by (-9, +3). He walks the logged straight-then-diagonal path between those stops. An anchor at x -1 is outside the room, so a west corner stops on the last tile of that path still inside it.",
  },
  "ocellus-p2": {
    actor: "The Blade",
    npcId: 16676,
    size: 3,
    fights: 31,
    samples: 31,
    status: "captured",
    exact: [tile(11, 13)],
    bound: { minX: 11, minY: 13, maxX: 11, maxY: 13 },
    note: "31 fights, 31 samples, one tile. He is stationary for the whole of phase 2. The only anchor is (11, 13), and the 3x3 is the footprint of that anchor. He has no walkable tile beyond it, and he does not path toward the player. The phase 2 drill's anchor is the same monster in that drill's grid.",
  },
  "ocellus-p3": {
    actor: "Ocellus",
    npcId: 16677,
    size: 3,
    fights: 31,
    samples: 850,
    status: "stand-in",
    exact: null,
    bound: { minX: -12, minY: 2, maxX: 9, maxY: 22 },
    note: "31 fights, 850 samples. The mode (5, 18) is tied at 45 with (5, 6) and leads the listed rows. No tick path. He holds (5, 18). The phase 3 drill holds its own assumed anchor and does not chase.",
  },
};

type AddExact = Readonly<{ actor: string; npcId: number; fights: number; samples: number; exact: readonly Tile[]; note: string }>;
type AddBound = Readonly<{ actor: string; npcId: number; fights: number; samples: number; bound: Bound; note: string }>;
type CauldronWalk = AddBound & Readonly<{ trail: readonly Tile[] }>;

export const ADD_WALK: Readonly<{ smorks: AddExact; binders: AddBound; cauldron: CauldronWalk; hooded: AddExact; batteries: AddExact }> = {
  smorks: {
    actor: "Smorks",
    npcId: 16641,
    fights: 107,
    samples: 107,
    exact: [tile(14, 14)],
    note: "107 of 107 captures, one tile. No walk pose. Stationary for the whole fight.",
  },
  binders: {
    actor: "Undead binder",
    npcId: 16670,
    fights: 3,
    samples: 747,
    bound: { minX: 4, minY: 2, maxX: 12, maxY: 10 },
    note: "3 fights, 747 samples. The six listed tiles are 163 of them. The box is the limit. A hop outside it is refused.",
  },
  cauldron: {
    actor: "Cauldron",
    npcId: 16649,
    fights: 1,
    samples: 7,
    bound: { minX: 5, minY: 12, maxX: 8, maxY: 14 },
    trail: [tile(5, 12), tile(6, 12), tile(6, 13), tile(7, 12), tile(8, 12), tile(8, 13)],
    note: "1 fight, 7 samples. Six tiles are listed and match the trail. One sample is not in the top six, so the box is the limit and the visit order stays a stand-in.",
  },
  hooded: {
    actor: "Hooded Figure",
    npcId: 16672,
    fights: 32,
    samples: 32,
    exact: [tile(5, 20)],
    note: "32 of 32 phase 1 captures, one tile. No walk. Stationary.",
  },
  batteries: {
    actor: "Guardian battery",
    npcId: 16662,
    fights: 175,
    samples: 229,
    exact: [tile(25, 3), tile(25, 16), tile(0, 3), tile(0, 16)],
    note: "The four corners, and the listed rows sum to all 229 samples. They do not move.",
  },
};

function contains(bound: Bound, at: Tile): boolean {
  return at.x >= bound.minX && at.x <= bound.maxX && at.y >= bound.minY && at.y <= bound.maxY;
}

function inRoom(id: RaidId, at: Tile): boolean {
  const room = ROOMS[id];
  return at.x >= 0 && at.y >= 0 && at.x < room.width && at.y < room.height;
}

/** Tiles the overlay tints: the exact set, or the captured box clipped to the room. */
export function overlayTiles(id: RaidId): readonly Tile[] {
  const walk = BOSS_WALK[id];
  if (walk.exact !== null) return walk.exact;
  const room = ROOMS[id];
  const minX = Math.max(0, walk.bound.minX);
  const minY = Math.max(0, walk.bound.minY);
  const maxX = Math.min(room.width - 1, walk.bound.maxX);
  const maxY = Math.min(room.height - 1, walk.bound.maxY);
  const tiles: Tile[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) tiles.push(tile(x, y));
  }
  return tiles;
}

export function bossMayStand(id: RaidId, at: Tile): boolean {
  const walk = BOSS_WALK[id];
  if (walk.exact !== null) return walk.exact.some((anchor) => anchor.x === at.x && anchor.y === at.y);
  return contains(walk.bound, at) && inRoom(id, at);
}

export function bossMobility(memory: RaidMemory, at: number): Mobility {
  switch (memory.id) {
    case "moia":
      return moiaMobility(memory, at);
    case "ocellus-p1":
      return p1Mobility(memory, at);
    case "bork":
    case "ezekiel":
    case "guardian":
    case "xarth":
    case "dagonhai":
    case "ocellus-p2":
    case "ocellus-p3":
      return "stationary";
    default: {
      const unhandled: never = memory;
      return unhandled;
    }
  }
}

function p1Mobility(memory: Extract<RaidMemory, { id: "ocellus-p1" }>, at: number): Mobility {
  if (memory.stage === "middle" && at - memory.since === ARCHIVE.p1.teleportIn) return "mobile";
  if (memory.stage !== "walk") return "stationary";
  const elapsed = at - memory.since;
  // The anchor is already the tile he stepped onto. The arrival tick is still a step, so it stays mobile.
  if (elapsed < 0 || elapsed >= memory.walkSteps) return "stationary";
  return "mobile";
}

function moiaMobility(memory: Extract<RaidMemory, { id: "moia" }>, at: number): Mobility {
  if (memory.phase === "gone") return "stationary";
  if (memory.phase === "p2" && at === memory.reappear) return "mobile";
  if (memory.phase !== "p1") return "stationary";
  const { relocateFirst, relocateInterval } = ARCHIVE.moia;
  if (at >= relocateFirst && (at - relocateFirst) % relocateInterval === 0) return "mobile";
  return "stationary";
}

/** A boss-at lands only on a legal anchor, and only on a mobile tick. A stationary tick keeps him where he is. */
export function acceptBossStep(id: RaidId, from: Tile, to: Tile, mobility: Mobility): Tile {
  if (mobility === "stationary") return from;
  if (!bossMayStand(id, to)) return from;
  return to;
}

export function addMobility(id: RaidId, at: number): Mobility {
  if (id === "moia" && at % ARCHIVE.moia.binderHop === 0) return "mobile";
  return "stationary";
}

export function acceptAddStep(id: RaidId, from: Tile, to: Tile, mobility: Mobility): Tile {
  if (id !== "moia") return from;
  if (mobility === "stationary") return from;
  if (!contains(ADD_WALK.binders.bound, to)) return from;
  return to;
}

export function cauldronMayStand(at: Tile): boolean {
  return contains(ADD_WALK.cauldron.bound, at);
}

export function cauldronMobile(at: number): boolean {
  const { cauldronFirst, cauldronStep, cauldronSteps, cycle } = ARCHIVE.dagonhai;
  return at >= cauldronFirst && (at - cauldronFirst) % cycle < cauldronSteps * cauldronStep && (at - cauldronFirst) % cauldronStep === 0;
}

export function actorName(id: RaidId): string {
  return BOSS_WALK[id].actor;
}
