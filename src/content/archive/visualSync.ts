import type { Location3 } from "osrs-sdk";
import type { Tile } from "../../sim/brands";
import type { RaidId } from "./catalog";

/**
 * Planes, sequence lengths and projectile cycles from cache 2746 and the 25 Oct 2026 render digest.
 * The digest stores flight modes and launch delays. It does not store start height, end height or slope.
 * Those three stay the room's existing stand-in: 1.2 at both ends, slope 0, a straight line.
 * A client cycle is 20 ms. Thirty cycles are one game tick.
 */

export const CYCLES_PER_TICK = 30;
/** The height already drawn before this pass. The capture has no projectile height to replace it. */
export const STAND_IN_SHOT_HEIGHT = 1.2;
/** The SDK's projectile graphic size when a shot does not set one. The mesh is drawn half of this off the perceived point. */
export const SDK_PROJECTILE_SIZE = 0.5;

export type SyncStatus = "captured" | "stand-in" | "disputed";

export type FloorSeat = Readonly<{
  region: number;
  plane: 0 | 1;
  localX: number;
  localY: number;
  settings: number | null;
  heightByte: number;
  raw: number;
  below: number | null;
  base: number;
  rise: number;
}>;

const seat = (
  region: number,
  plane: 0 | 1,
  localX: number,
  localY: number,
  settings: number | null,
  heightByte: number,
  raw: number,
  below: number | null,
  base: number,
  rise: number,
): FloorSeat => ({ region, plane, localX, localY, settings, heightByte, raw, below, base, rise });

/** Boss-tile terrain from cache 2746. `rise` is (raw height − the region's base) / 128. The scene drops by that rise so the walk floor sits at 0. */
export const FLOOR_SEATS = {
  bork: seat(16727, 0, 26, 32, null, 60, 480, null, 480, 0),
  ezekiel: seat(16214, 0, 30, 31, null, 30, 240, null, 480, -1.875),
  guardian: seat(16471, 0, 29, 29, 4, 30, 240, null, 240, 0),
  moia: seat(16216, 0, 23, 30, null, 75, 600, null, 480, 0.9375),
  xarth: seat(16726, 0, 30, 30, null, 60, 480, null, 480, 0),
  dagonhai: seat(16215, 0, 28, 34, null, 75, 600, null, 480, 0.9375),
  ocellusP1: seat(16472, 1, 30, 40, 4, 96, 1008, 240, 240, 6),
  ocellusHooded: seat(16472, 1, 30, 37, 4, 96, 1008, 240, 240, 6),
  ocellusBlade: seat(16472, 1, 30, 40, 4, 96, 1008, 240, 240, 6),
  ocellusP3: seat(16472, 1, 36, 34, 4, 96, 1008, 240, 240, 6),
} as const;

/** Map settings bit 1 (value 2) is the bridge flag. Value 4 is a different bit, and it is set on the Guardian and on Ocellus. */
export function bridgeFlag(settings: number | null): boolean {
  return settings !== null && (settings & 2) !== 0;
}

/** The scene elevation that puts this room's measured rise on the walk floor. */
export function sceneElevation(id: RaidId): number {
  switch (id) {
    case "bork":
      return -FLOOR_SEATS.bork.rise;
    case "ezekiel":
      return -FLOOR_SEATS.ezekiel.rise;
    case "guardian":
      return -FLOOR_SEATS.guardian.rise;
    case "moia":
      return -FLOOR_SEATS.moia.rise;
    case "xarth":
      return -FLOOR_SEATS.xarth.rise;
    case "dagonhai":
      return -FLOOR_SEATS.dagonhai.rise;
    case "ocellus-p1":
      return -FLOOR_SEATS.ocellusP1.rise;
    case "ocellus-p2":
      return -FLOOR_SEATS.ocellusBlade.rise;
    case "ocellus-p3":
      return -FLOOR_SEATS.ocellusP3.rise;
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

export type SequenceSpan =
  | Readonly<{ id: number; kind: "maya"; start: number; end: number }>
  | Readonly<{ id: number; kind: "classic"; frames: readonly number[] }>;

/** Cache 2746 sequence lengths. Maya length is end − start, in client cycles. Classic length is the sum of the frame timings. */
export const SEQUENCE_SPANS: readonly SequenceSpan[] = [
  { id: 14539, kind: "maya", start: 0, end: 60 },
  { id: 14540, kind: "maya", start: 0, end: 90 },
  { id: 14542, kind: "maya", start: 0, end: 90 },
  { id: 14553, kind: "maya", start: 0, end: 90 },
  { id: 14555, kind: "maya", start: 0, end: 90 },
  { id: 14581, kind: "classic", frames: [12, 11, 11, 11, 12, 11, 11, 11] },
  { id: 14587, kind: "classic", frames: [4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4] },
  { id: 14593, kind: "classic", frames: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { id: 14597, kind: "classic", frames: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
  { id: 14683, kind: "maya", start: 0, end: 120 },
  { id: 14684, kind: "maya", start: 0, end: 60 },
  { id: 14745, kind: "maya", start: 0, end: 90 },
  { id: 14751, kind: "maya", start: 0, end: 90 },
  { id: 14783, kind: "maya", start: 0, end: 90 },
  { id: 14785, kind: "maya", start: 0, end: 60 },
  { id: 14788, kind: "maya", start: 0, end: 34 },
  { id: 14789, kind: "classic", frames: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6] },
  { id: 14790, kind: "classic", frames: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  { id: 14804, kind: "maya", start: 0, end: 90 },
  { id: 14805, kind: "maya", start: 0, end: 60 },
  { id: 14806, kind: "maya", start: 0, end: 90 },
  { id: 14807, kind: "maya", start: 0, end: 30 },
  { id: 14809, kind: "maya", start: 0, end: 120 },
  { id: 14811, kind: "maya", start: 0, end: 60 },
  { id: 14840, kind: "maya", start: 0, end: 90 },
  { id: 14842, kind: "maya", start: 0, end: 60 },
  { id: 14849, kind: "maya", start: 0, end: 60 },
  { id: 14851, kind: "maya", start: 0, end: 90 },
  { id: 14869, kind: "maya", start: 0, end: 168 },
  { id: 14979, kind: "classic", frames: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { id: 14980, kind: "classic", frames: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  { id: 14984, kind: "classic", frames: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4] },
  { id: 14985, kind: "classic", frames: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 3, 3, 3, 4, 4, 4, 4, 4, 4] },
  { id: 15024, kind: "classic", frames: [4, 5, 5, 5, 5, 5, 5, 5] },
  { id: 4269, kind: "classic", frames: [6, 7, 6, 7, 6, 7, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 8, 5, 5, 5, 5] },
  { id: 4440, kind: "classic", frames: [4, 4, 4, 4, 15, 15, 15, 15, 15, 15, 15, 4, 4, 4, 10] },
];

export function sequenceCycles(span: SequenceSpan): number {
  switch (span.kind) {
    case "maya":
      return span.end - span.start;
    case "classic":
      return span.frames.reduce((sum, frame) => sum + frame, 0);
    default: {
      const unhandled: never = span;
      return unhandled;
    }
  }
}

export type MovementPose = Readonly<{
  npcId: number;
  idle: number;
  walk: number;
  run: number;
  turn: number;
}>;

/**
 * Cache 2746 movement poses. Run is −1 on every audited NPC, so there is no run sequence to play.
 * Turn is −1 except Xarth, whose turn is his idle 14979. Pose index 0 is idle and 1 is walk.
 */
export const MOVEMENT_POSES: readonly MovementPose[] = [
  { npcId: 16640, idle: 14540, walk: 14539, run: -1, turn: -1 },
  { npcId: 16641, idle: 14553, walk: 14553, run: -1, turn: -1 },
  { npcId: 16652, idle: 14683, walk: 14684, run: -1, turn: -1 },
  { npcId: 16659, idle: 14745, walk: 14745, run: -1, turn: -1 },
  { npcId: 16660, idle: 14745, walk: 14745, run: -1, turn: -1 },
  { npcId: 16662, idle: 15024, walk: -1, run: -1, turn: -1 },
  { npcId: 16667, idle: 14783, walk: 14783, run: -1, turn: -1 },
  { npcId: 16670, idle: 14789, walk: 14790, run: -1, turn: -1 },
  { npcId: 16684, idle: 14979, walk: 14980, run: -1, turn: 14979 },
  { npcId: 16643, idle: 14581, walk: 14587, run: -1, turn: -1 },
  { npcId: 16674, idle: 14804, walk: 14805, run: -1, turn: -1 },
  { npcId: 16672, idle: 14804, walk: 14805, run: -1, turn: -1 },
  { npcId: 16676, idle: -1, walk: -1, run: -1, turn: -1 },
  { npcId: 16677, idle: 14840, walk: 14849, run: -1, turn: -1 },
];

/** The SDK pose index. A step that changed the tile plays walk (1). Standing still plays idle (0). */
export function movementPoseIndex(stepping: boolean): 0 | 1 {
  return stepping ? 1 : 0;
}

export type ShotMotion = Readonly<{
  graphic: number | null;
  startCycles: number;
  travelCycles: number;
  startHeight: number;
  endHeight: number;
  slope: number;
  hold: boolean;
}>;

export type ShotRecord = Readonly<{
  name: string;
  graphic: number | null;
  source: number | null;
  samples: number | null;
  flightTicks: number | null;
  hitTicks: number | null;
  hitSamples: number | null;
  launchDelayTicks: number | null;
  launchDelaySamples: number | null;
  anim: number | null;
  plane: 0 | 1;
  startCycles: number;
  travelCycles: number;
  startHeight: number;
  endHeight: number;
  slope: number;
  sync: SyncStatus;
  drawn: boolean;
  note: string;
}>;

const line = (start: number, end: number): Pick<ShotRecord, "startHeight" | "endHeight" | "slope"> => ({
  startHeight: start,
  endHeight: end,
  slope: 0,
});

const standInLine = line(STAND_IN_SHOT_HEIGHT, STAND_IN_SHOT_HEIGHT);

const shot = (
  fields: Omit<ShotRecord, "startHeight" | "endHeight" | "slope">,
): ShotRecord => ({ ...fields, ...standInLine });

/**
 * One row per captured projectile the rooms know about.
 * `startCycles` and `travelCycles` are what the graphic uses. Combat hit ticks are unchanged.
 * Where the graphic's arrival and the audited splat disagree, `sync` is disputed.
 */
export const SHOT_RECORDS: readonly ShotRecord[] = [
  shot({
    name: "Smorks bomb",
    graphic: 4440,
    source: 16641,
    samples: 535,
    flightTicks: 4.5,
    hitTicks: null,
    hitSamples: null,
    launchDelayTicks: 1,
    launchDelaySamples: 485,
    anim: 14555,
    plane: 0,
    startCycles: 30,
    travelCycles: 135,
    sync: "captured",
    drawn: true,
    note: "Launch delay 1 on 485, also 2 on 38 and 3 on 7. The hitsplat was unresolved, so no combat tick moves. Height and slope are the stand-in.",
  }),
  shot({
    name: "Bork projectile 4056",
    graphic: 4056,
    source: null,
    samples: null,
    flightTicks: 3,
    hitTicks: 3,
    hitSamples: null,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: null,
    plane: 0,
    startCycles: 0,
    travelCycles: 90,
    sync: "stand-in",
    drawn: false,
    note: "Source unresolved. Not drawn. The flight mode is 3 and is not applied.",
  }),
  shot({
    name: "Bork projectile 4057",
    graphic: 4057,
    source: null,
    samples: null,
    flightTicks: 3,
    hitTicks: 3,
    hitSamples: null,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: null,
    plane: 0,
    startCycles: 0,
    travelCycles: 90,
    sync: "stand-in",
    drawn: false,
    note: "Source unresolved. Not drawn.",
  }),
  shot({
    name: "Smorks napalm",
    graphic: 4045,
    source: 16641,
    samples: 688,
    flightTicks: 4,
    hitTicks: null,
    hitSamples: null,
    launchDelayTicks: 0,
    launchDelaySamples: 461,
    anim: 14554,
    plane: 0,
    startCycles: 0,
    travelCycles: 120,
    sync: "captured",
    drawn: true,
    note: "Flight is exactly 4.0 on 688. Launch delay 0 on 461, also 1 on 136. Animation 14554 also plays when this projectile does not, so that wider role stays low confidence. Height and slope are the stand-in.",
  }),
  shot({
    name: "Guardian ranged",
    graphic: 4201,
    source: 16659,
    samples: 6314,
    flightTicks: 2.27,
    hitTicks: 2,
    hitSamples: 5341,
    launchDelayTicks: 2,
    launchDelaySamples: 4122,
    anim: 14751,
    plane: 0,
    startCycles: 60,
    travelCycles: 60,
    sync: "captured",
    drawn: true,
    note: "Flight mode 2.27 is 68 cycles. The hit mode is 2 ticks after launch, 5,341 samples, so the graphic flies 60 cycles and meets the existing +4 splat. The 8-cycle gap stays noted.",
  }),
  shot({
    name: "Moia ranged",
    graphic: 4214,
    source: 16667,
    samples: 343,
    flightTicks: 0.67,
    hitTicks: 0,
    hitSamples: 329,
    launchDelayTicks: null,
    launchDelaySamples: 75,
    anim: 14785,
    plane: 0,
    startCycles: 0,
    travelCycles: 20,
    sync: "captured",
    drawn: true,
    note: "0.67 ticks is 20 client cycles. A delay of 1 was only 75 of 78 timed launches out of 343 shots, so it is not applied. The splat stays on the attack tick.",
  }),
  shot({
    name: "Moia relocate",
    graphic: 4213,
    source: 16667,
    samples: 70,
    flightTicks: 5.5,
    hitTicks: 4,
    hitSamples: 39,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: 14788,
    plane: 0,
    startCycles: 0,
    travelCycles: 120,
    sync: "disputed",
    drawn: true,
    note: "Flight mode 5.5. Hit mode 4 on 39, then 5 on 20. The graphic flies 4 ticks so it meets the audited splat. The 5.5-tick flight is the disagreement.",
  }),
  shot({
    name: "Xarth magic",
    graphic: 4034,
    source: 16684,
    samples: 1135,
    flightTicks: 2,
    hitTicks: 2,
    hitSamples: null,
    launchDelayTicks: 1,
    launchDelaySamples: 533,
    anim: 14984,
    plane: 0,
    startCycles: 30,
    travelCycles: 60,
    sync: "disputed",
    drawn: true,
    note: "Delay mode 1 on 533, then 2 on 395. The graphic ends one tick after the splat, which stays at +2. A second digest row counted 573.",
  }),
  shot({
    name: "Xarth ranged",
    graphic: 4374,
    source: 16684,
    samples: 1837,
    flightTicks: 2,
    hitTicks: 2,
    hitSamples: null,
    launchDelayTicks: 2,
    launchDelaySamples: 886,
    anim: 14985,
    plane: 0,
    startCycles: 60,
    travelCycles: 60,
    sync: "disputed",
    drawn: true,
    note: "The graphic ends two ticks after the splat. The splat stays at +2.",
  }),
  shot({
    name: "Xarth tell",
    graphic: 4378,
    source: 16684,
    samples: 520,
    flightTicks: 2,
    hitTicks: null,
    hitSamples: null,
    launchDelayTicks: 2,
    launchDelaySamples: 55,
    anim: 14992,
    plane: 0,
    startCycles: 60,
    travelCycles: 60,
    sync: "captured",
    drawn: true,
    note: "No hitsplat to sync. The delay sample is 55, so the 2-tick wait is the recorded mode and a thin one.",
  }),
  shot({
    name: "Dagon'hai ranged",
    graphic: 4071,
    source: 16643,
    samples: 6,
    flightTicks: 3,
    hitTicks: 3,
    hitSamples: 6,
    launchDelayTicks: 2,
    launchDelaySamples: 2,
    anim: 14593,
    plane: 0,
    startCycles: 60,
    travelCycles: 90,
    sync: "captured",
    drawn: true,
    note: "One fight. Wait 2 then fly 3, which is the room's existing +5 splat. The sample is six shots.",
  }),
  shot({
    name: "Dagon'hai magic",
    graphic: 1459,
    source: 16643,
    samples: 5,
    flightTicks: 1,
    hitTicks: 1,
    hitSamples: 5,
    launchDelayTicks: 2,
    launchDelaySamples: 2,
    anim: 14597,
    plane: 0,
    startCycles: 60,
    travelCycles: 30,
    sync: "disputed",
    drawn: true,
    note: "The graphic arrives 3 ticks after the anim. The room's splat stays at +5, which is the shared auto the one fight kept.",
  }),
  shot({
    name: "Ocellus phase 1 magic",
    graphic: 4229,
    source: 16674,
    samples: 1187,
    flightTicks: 2.17,
    hitTicks: 2,
    hitSamples: null,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: 14806,
    plane: 1,
    startCycles: 0,
    travelCycles: 60,
    sync: "captured",
    drawn: true,
    note: "Hit mode 2. The launch-delay rows are a minority of the 1,187, so the raid volley leaves on the attack tick. The phase 1 drill keeps its own log cycles.",
  }),
  shot({
    name: "Ocellus phase 1 ranged",
    graphic: 4232,
    source: 16674,
    samples: 1046,
    flightTicks: 2.17,
    hitTicks: 2,
    hitSamples: null,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: 14807,
    plane: 1,
    startCycles: 0,
    travelCycles: 60,
    sync: "captured",
    drawn: true,
    note: "Same flight and hit mode as 4229. The raid graphic flies 2 ticks from the attack.",
  }),
  shot({
    name: "Ocellus phase 2 bolt",
    graphic: 4269,
    source: null,
    samples: 314,
    flightTicks: 2.8,
    hitTicks: null,
    hitSamples: null,
    launchDelayTicks: null,
    launchDelaySamples: null,
    anim: null,
    plane: 1,
    startCycles: 0,
    travelCycles: 84,
    sync: "disputed",
    drawn: true,
    note: "The digest did not resolve a source. The logs name 4269 as the portal bolt. Flight mode 2.8 is 84 cycles. The splat stays at the room's 4-tick delay.",
  }),
  shot({
    name: "Ocellus phase 3 void",
    graphic: 4297,
    source: 16677,
    samples: 362,
    flightTicks: 0.5,
    hitTicks: 0,
    hitSamples: 297,
    launchDelayTicks: 2,
    launchDelaySamples: 94,
    anim: 14851,
    plane: 1,
    startCycles: 60,
    travelCycles: 15,
    sync: "disputed",
    drawn: true,
    note: "The graphic waits 2 ticks and flies 15 cycles. The splat is already on the attack tick, with the audited same-tick hit, so the graphic lands after it.",
  }),
];

export function shotMotion(record: ShotRecord): ShotMotion {
  return {
    graphic: record.graphic,
    startCycles: record.startCycles,
    travelCycles: record.travelCycles,
    startHeight: record.startHeight,
    endHeight: record.endHeight,
    slope: record.slope,
    hold: false,
  };
}

export function shotByGraphic(graphic: number): ShotRecord | null {
  return SHOT_RECORDS.find((record) => record.graphic === graphic && record.drawn) ?? null;
}

/** A travelling stand-in whose only known length is a whole number of ticks. Height and slope stay the stand-in. */
export function wholeTickStandIn(ticks: number, graphic: number | null): ShotMotion {
  return {
    graphic,
    startCycles: 0,
    travelCycles: ticks * CYCLES_PER_TICK,
    startHeight: STAND_IN_SHOT_HEIGHT,
    endHeight: STAND_IN_SHOT_HEIGHT,
    slope: 0,
    hold: false,
  };
}

/** A spotanim that stays on the attacker. The capture did not give it a travel. */
export function heldStandIn(ticks: number, graphic: number): ShotMotion {
  return { ...wholeTickStandIn(ticks, graphic), hold: true };
}

/** South-west anchor plus half the footprint. Y follows the SDK, which runs the footprint toward smaller y. */
export function footprintCentre(at: Tile, size: number): { x: number; y: number } {
  return { x: at.x + size / 2, y: at.y - size / 2 };
}

/**
 * Perceived location of a graphic whose mesh is drawn at perceived + (graphicSize / 2, −graphicSize / 2).
 * That mesh then sits on the actor's footprint centre.
 */
export function graphicAnchor(at: Tile, actorSize: number, graphicSize: number): { x: number; y: number } {
  const centre = footprintCentre(at, actorSize);
  return { x: centre.x - graphicSize / 2, y: centre.y + graphicSize / 2 };
}

/** Client height along a shot. Slope 0 is a straight line. The extra term is zero at both ends. */
export function clientProjectileHeight(start: number, end: number, slope: number, t: number): number {
  return start + (end - start) * t + slope * t * (1 - t);
}

/** Null before the launch cycle. 0 on that cycle, then the fraction of the travel, held at 1 after arrival. */
export function flightProgress(ageTicks: number, tickPercent: number, startCycles: number, travelCycles: number): number | null {
  const cycles = (ageTicks + tickPercent) * CYCLES_PER_TICK;
  if (cycles < startCycles) return null;
  if (travelCycles <= 0) return 1;
  const t = (cycles - startCycles) / travelCycles;
  return t > 1 ? 1 : t;
}

/** How many game ticks the entity has to stay up so the arrival cycle still has a frame. */
export function visualLifeTicks(startCycles: number, travelCycles: number): number {
  const ticks = Math.ceil((startCycles + travelCycles) / CYCLES_PER_TICK);
  return ticks < 1 ? 1 : ticks;
}

/**
 * The SDK starts a projectile at (size − 1) / 2, half a tile off the footprint centre, then draws the mesh half the graphic size further on.
 * This shifts both ends so the mesh travels from the attacker's centre to the target's centre.
 * Height is the SDK's own start and end, with slope 0, because the capture has no slope.
 */
export const centreCorrectedFlight = {
  interpolate(from: Location3, to: Location3, percent: number): Location3 {
    const t = percent < 0 ? 0 : percent > 1 ? 1 : percent;
    const shiftX = 0.5 - SDK_PROJECTILE_SIZE / 2;
    const shiftY = -0.5 + SDK_PROJECTILE_SIZE / 2;
    const fromX = from.x + shiftX;
    const fromY = from.y + shiftY;
    const toX = to.x - SDK_PROJECTILE_SIZE / 2;
    const toY = to.y + SDK_PROJECTILE_SIZE / 2;
    return {
      x: fromX + (toX - fromX) * t,
      y: fromY + (toY - fromY) * t,
      z: clientProjectileHeight(from.z, to.z, 0, t),
    };
  },
  interpolatePitch(from: Location3, to: Location3, percent: number): number {
    void percent;
    const shiftX = 0.5 - SDK_PROJECTILE_SIZE / 2;
    const shiftY = -0.5 + SDK_PROJECTILE_SIZE / 2;
    const dx = to.x - SDK_PROJECTILE_SIZE / 2 - (from.x + shiftX);
    const dy = to.y + SDK_PROJECTILE_SIZE / 2 - (from.y + shiftY);
    const distance = Math.hypot(dx, dy);
    return distance === 0 ? 0 : Math.atan2(to.z - from.z, distance);
  },
};
