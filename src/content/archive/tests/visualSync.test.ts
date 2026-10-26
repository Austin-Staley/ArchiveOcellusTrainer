import { Settings, Viewport, World } from "osrs-sdk";
import type { Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import { tile } from "../../../sim/brands";
import type { RaidId } from "../catalog";
import { parseRaid } from "../catalog";
import { ARCHIVE } from "../timings";
import { ROOMS } from "../layout";
import { arenaFor } from "../poses";
import { RaidRegion } from "../RaidRegion";
import {
  CYCLES_PER_TICK,
  FLOOR_SEATS,
  MOVEMENT_POSES,
  SDK_PROJECTILE_SIZE,
  SEQUENCE_SPANS,
  SHOT_RECORDS,
  STAND_IN_SHOT_HEIGHT,
  bridgeFlag,
  centreCorrectedFlight,
  clientProjectileHeight,
  flightProgress,
  footprintCentre,
  graphicAnchor,
  movementPoseIndex,
  sceneElevation,
  sequenceCycles,
  visualLifeTicks,
} from "../visualSync";

function open(id: RaidId): Readonly<{ region: RaidRegion; world: World; player: Player }> {
  Settings.readFromStorage();
  const region = new RaidRegion(parseRaid(new URL(`http://localhost/?encounter=${id}&seed=1&invincible=on`), id, () => 1));
  const world = new World();
  region.world = world;
  world.addRegion(region);
  Viewport.setupViewport(region, document.createElement("canvas"), document.createElement("div"), true);
  const started = region.reset(false);
  world.getReadyTimer = 0;
  return { region, world, player: started.player };
}

function fight(world: World, ticks: number): void {
  for (let step = 0; step < ticks; step += 1) world.tickWorld();
}

describe("visual event sync", () => {
  it("drops each room by the measured rise, and the bridge bit stays clear", () => {
    const seats = Object.values(FLOOR_SEATS);
    seats.forEach((seat) => {
      expect(bridgeFlag(seat.settings)).toBe(false);
      expect(seat.rise).toBe((seat.raw - seat.base) / 128);
    });
    expect(bridgeFlag(2)).toBe(true);
    expect(FLOOR_SEATS.ocellusP1.plane).toBe(1);
    expect(FLOOR_SEATS.ocellusHooded.rise).toBe(6);
    expect(FLOOR_SEATS.ocellusBlade.rise).toBe(6);
    expect(FLOOR_SEATS.ocellusP3.rise).toBe(6);
    expect(FLOOR_SEATS.bork.plane).toBe(0);
    const ids: readonly RaidId[] = ["bork", "ezekiel", "guardian", "moia", "xarth", "dagonhai", "ocellus-p1", "ocellus-p2", "ocellus-p3"];
    expect(ids.map((id) => arenaFor(id).elevation)).toEqual(ids.map((id) => sceneElevation(id)));
    expect(sceneElevation("ocellus-p1")).toBe(-6);
    expect(sceneElevation("ezekiel")).toBe(1.875);
    expect(sceneElevation("moia")).toBe(-0.9375);
    expect(sceneElevation("dagonhai")).toBe(-0.9375);
  });

  it("uses the cache sequence lengths, in client cycles", () => {
    const cycles = new Map(SEQUENCE_SPANS.map((span) => [span.id, sequenceCycles(span)]));
    expect(cycles.get(14542)).toBe(90);
    expect(cycles.get(14555)).toBe(90);
    expect(cycles.get(14751)).toBe(90);
    expect(cycles.get(14785)).toBe(60);
    expect(cycles.get(14788)).toBe(34);
    expect(cycles.get(14806)).toBe(90);
    expect(cycles.get(14807)).toBe(30);
    expect(cycles.get(14809)).toBe(120);
    expect(cycles.get(14811)).toBe(60);
    expect(cycles.get(14851)).toBe(90);
    expect(cycles.get(14869)).toBe(168);
    expect(cycles.get(15024)).toBe(39);
    expect(cycles.get(14593)).toBe(90);
    expect(cycles.get(14984)).toBe(60);
    expect(cycles.get(14985)).toBe(90);
    expect(cycles.get(4269)).toBe(111);
    expect(cycles.get(4440)).toBe(143);
    SEQUENCE_SPANS.forEach((span) => {
      const length = sequenceCycles(span);
      expect(length).toBeGreaterThan(0);
      if (span.kind === "maya") expect(span.start).toBe(0);
      if (span.kind === "classic") expect(span.frames.every((frame) => frame > 0)).toBe(true);
    });
  });

  it("plays walk only while a step changed the tile, and no audited NPC has a run animation", () => {
    expect(movementPoseIndex(false)).toBe(0);
    expect(movementPoseIndex(true)).toBe(1);
    MOVEMENT_POSES.forEach((pose) => expect(pose.run).toBe(-1));
    const xarth = MOVEMENT_POSES.find((pose) => pose.npcId === 16684);
    const blade = MOVEMENT_POSES.find((pose) => pose.npcId === 16676);
    expect(xarth).toEqual({ npcId: 16684, idle: 14979, walk: 14980, run: -1, turn: 14979 });
    expect(blade).toEqual({ npcId: 16676, idle: -1, walk: -1, run: -1, turn: -1 });

    const moia = open("moia");
    const boss = () => [...moia.region.mobs, ...moia.region.newMobs].find((mob) => mob.mobName() === "Moia");
    fight(moia.world, ARCHIVE.moia.relocateFirst);
    expect(boss()?.animationIndex).toBe(0);
    expect({ x: boss()?.location.x, y: boss()?.location.y }).toEqual({ x: ROOMS.moia.boss.x, y: ROOMS.moia.boss.y });
    fight(moia.world, 1);
    expect(boss()?.animationIndex).toBe(1);
    expect({ x: boss()?.location.x, y: boss()?.location.y }).toEqual({ x: 7, y: 14 });
  });

  it("pins each projectile's captured cycles, and keeps height and slope as the stand-in", () => {
    const drawn = [
      [4440, 30, 135, "captured"],
      [4201, 60, 60, "captured"],
      [4214, 0, 20, "captured"],
      [4213, 0, 120, "disputed"],
      [4034, 30, 60, "disputed"],
      [4374, 60, 60, "disputed"],
      [4378, 60, 60, "captured"],
      [4071, 60, 90, "captured"],
      [1459, 60, 30, "disputed"],
      [4229, 0, 60, "captured"],
      [4232, 0, 60, "captured"],
      [4269, 0, 84, "disputed"],
      [4297, 60, 15, "disputed"],
    ] as const;
    expect(SHOT_RECORDS.filter((record) => record.drawn).map((record) => [record.graphic, record.startCycles, record.travelCycles, record.sync])).toEqual(
      drawn.map((row) => [row[0], row[1], row[2], row[3]]),
    );
    SHOT_RECORDS.forEach((record) => {
      expect(record.startHeight).toBe(STAND_IN_SHOT_HEIGHT);
      expect(record.endHeight).toBe(STAND_IN_SHOT_HEIGHT);
      expect(record.slope).toBe(0);
      expect(record.plane === 0 || record.plane === 1).toBe(true);
    });
    expect(SHOT_RECORDS.filter((record) => record.graphic === 4056 || record.graphic === 4057 || record.graphic === 4045).every((record) => !record.drawn)).toBe(true);
    expect(visualLifeTicks(30, 135)).toBe(6);
    expect(visualLifeTicks(60, 60)).toBe(4);
    expect(visualLifeTicks(0, 20)).toBe(1);
    expect(visualLifeTicks(60, 15)).toBe(3);
    expect(visualLifeTicks(0, 84)).toBe(3);
  });

  it("arcs with the client formula and launches a 3x3 from its centre", () => {
    expect(clientProjectileHeight(1.2, 1.2, 0, 0.5)).toBe(1.2);
    expect(clientProjectileHeight(1, 3, 0, 0.5)).toBe(2);
    expect(clientProjectileHeight(1, 1, 4, 0)).toBe(1);
    expect(clientProjectileHeight(1, 1, 4, 1)).toBe(1);
    expect(clientProjectileHeight(1, 1, 4, 0.5)).toBe(2);
    expect(flightProgress(0, 0, 30, 135)).toBeNull();
    expect(flightProgress(0, 1, 30, 135)).toBe(0);
    expect(flightProgress(0, 0.5, 0, 20)).toBe((0.5 * CYCLES_PER_TICK) / 20);

    const sw = tile(10, 12);
    expect(footprintCentre(sw, 3)).toEqual({ x: 11.5, y: 10.5 });
    expect(graphicAnchor(sw, 3, 1)).toEqual({ x: 11, y: 11 });
    const sdkStart = { x: sw.x + (3 - 1) / 2, y: sw.y - (3 - 1) / 2, z: 2 };
    const target = { x: 5.5, y: 0.5, z: 0.4 };
    const launched = centreCorrectedFlight.interpolate(sdkStart, target, 0);
    const mesh = { x: launched.x + SDK_PROJECTILE_SIZE / 2, y: launched.y - SDK_PROJECTILE_SIZE / 2, z: launched.z };
    expect(mesh).toEqual({ x: 11.5, y: 10.5, z: 2 });
    const landed = centreCorrectedFlight.interpolate(sdkStart, target, 1);
    expect(landed.x + SDK_PROJECTILE_SIZE / 2).toBe(5.5);
    expect(landed.y - SDK_PROJECTILE_SIZE / 2).toBe(0.5);
    expect(landed.z).toBeCloseTo(0.4);
    expect(centreCorrectedFlight.interpolate(sdkStart, target, 0.5).z).toBe(1.2);
  });

  it("holds the Smorks bomb on their tile until its launch cycle, then shows it from their centre", () => {
    const { region, world } = open("bork");
    fight(world, ARCHIVE.bork.bombInterval + 1);
    const bomb = region.entities.find((entity) => entity.entityName() === "Projectile 4440");
    if (!bomb) throw new Error("the bomb graphic was not launched");
    expect({ x: bomb.location.x, y: bomb.location.y }).toEqual({ x: ROOMS.bork.smork.x, y: ROOMS.bork.smork.y });
    expect(bomb.visible(0)).toBe(false);
    expect(bomb.visible(1)).toBe(true);
    expect(bomb.getPerceivedLocation(1)).toEqual({ ...graphicAnchor(ROOMS.bork.smork, ARCHIVE.bork.smorkSize, bomb.size), z: STAND_IN_SHOT_HEIGHT });
    expect(bomb.getPerceivedPitch(1)).toBe(0);
  });
});
