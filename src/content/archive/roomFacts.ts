/**
 * Values the always-on encounter rooms read from the phase recipes.
 * Those recipes live in the flag-gated timing modules, so a flags-off page cannot import them.
 * src/content/archive/tests/roomFacts.test.ts locks every field to the recipe it was copied from.
 */
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
