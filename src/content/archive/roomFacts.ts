/**
 * Values the always-on encounter rooms read from the phase recipes.
 * Those recipes live in the flag-gated timing modules, so a flags-off page cannot import them.
 * src/content/archive/tests/roomFacts.test.ts locks every field to the recipe it was copied from.
 */
/**
 * The phase 1 walk the encounter room plays.
 * Copied from the phase 1 recipe so this room does not import the flag-gated timing module.
 */
export const P1_ROUTE = {
  weights: { anticlockwise: 10, clockwise: 3, across: 6 },
  start: { x: 14, y: 17 },
  middle: { x: 14, y: 14 },
  corners: {
    "north-east": { x: 20, y: 8 },
    "south-east": { x: 20, y: 20 },
    "south-west": { x: 8, y: 20 },
    "north-west": { x: 8, y: 8 },
  },
  beats: {
    length: 6,
    cracks: {
      east: [{ dx: 3, dy: -2, run: { dx: 1, dy: -1 } }, { dx: 3, dy: 0, run: { dx: 1, dy: 1 } }],
      south: [{ dx: 2, dy: 1, run: { dx: 1, dy: 1 } }, { dx: 0, dy: 1, run: { dx: -1, dy: 1 } }],
      west: [{ dx: -1, dy: 0, run: { dx: -1, dy: 1 } }, { dx: -1, dy: -2, run: { dx: -1, dy: -1 } }],
      north: [{ dx: 0, dy: -3, run: { dx: -1, dy: -1 } }, { dx: 2, dy: -3, run: { dx: 1, dy: -1 } }],
    },
  },
} as const;

export const P1_ROOM = {
  crackLength: 8,
  blastRadius: 2,
  crackPieces: {
    straight: {
      north: { start: 4236, piece: 4240, end: 4241 },
      east: { start: 4237, piece: 4242, end: 4243 },
      south: { start: 4238, piece: 4244, end: 4245 },
      west: { start: 4239, piece: 4246, end: 4247 },
    },
    diagonal: {
      "north-east": { start: 4248, piece: 4252, end: 4253 },
      "south-east": { start: 4249, piece: 4254, end: 4255 },
      "south-west": { start: 4250, piece: 4256, end: 4257 },
      "north-west": { start: 4251, piece: 4258, end: 4259 },
    },
  },
  crackTiming: { openDelay: 60, perTile: 1 },
  floorExplosions: { pieces: [4262, 4263, 4264, 4265], ringDelays: [0, 2] },
} as const;

export const P2_ROOM = {
  perArm: 6,
  rotation: { north: 3, east: 0, south: 1, west: 2 },
  looks: { inactive: { model: 62758, idle: 14830 }, lit: { model: 62757, idle: 14830 } },
} as const;

export const P3_ROOM = {
  swingProtectedMax: 6,
  swingUnprotectedMax: 26,
} as const;
