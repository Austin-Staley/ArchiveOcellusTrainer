import { BasicModel, CacheRenderModel, CacheRenderSceneModel, Settings, TileMarkerModel, Viewport, World } from "osrs-sdk";
import type { Mob, Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import type { RaidId } from "../catalog";
import { RAID_IDS, parseRaid } from "../catalog";
import { seed, tick } from "../../../sim/brands";
import { BATTERY_TILES, HOODED_TILE, ROOMS } from "../layout";
import { BLADE_SEAT, GRAPHICS } from "../poses";
import { ARCHIVE } from "../timings";
import { RaidRegion } from "../RaidRegion";

function open(id: RaidId, query: string): Readonly<{ region: RaidRegion; world: World; player: Player }> {
  Settings.readFromStorage();
  const region = new RaidRegion(parseRaid(new URL(`http://localhost/${query}`), id, () => 1));
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

function npcIdOf(mob: Mob): number {
  return "npcId" in mob && typeof mob.npcId === "number" ? mob.npcId : 0;
}

describe("raid rooms in 3D", () => {
  it("pins the captured boss tiles", () => {
    const bosses: readonly (readonly [RaidId, string, number, number, number])[] = [
      ["bork", "Bork", ROOMS.bork.boss.x, ROOMS.bork.boss.y, ARCHIVE.bork.npcId],
      ["ezekiel", "Ezekiel", ROOMS.ezekiel.boss.x, ROOMS.ezekiel.boss.y, ARCHIVE.ezekiel.npcId],
      ["guardian", "Archive Guardian", ROOMS.guardian.boss.x, ROOMS.guardian.boss.y, ARCHIVE.guardian.flyingNpcId],
      ["moia", "Moia", ROOMS.moia.boss.x, ROOMS.moia.boss.y, ARCHIVE.moia.npcId],
      ["xarth", "Xarth", ROOMS.xarth.boss.x, ROOMS.xarth.boss.y, ARCHIVE.xarth.npcId],
      ["dagonhai", "Dagon'hai trio", ROOMS.dagonhai.boss.x, ROOMS.dagonhai.boss.y, ARCHIVE.dagonhai.npcId],
      ["ocellus-p1", "Ocellus", ROOMS["ocellus-p1"].boss.x, ROOMS["ocellus-p1"].boss.y, ARCHIVE.p1.npcId],
      ["ocellus-p2", "The Blade", ROOMS["ocellus-p2"].boss.x, ROOMS["ocellus-p2"].boss.y, ARCHIVE.p2.npcId],
      ["ocellus-p3", "Ocellus", ROOMS["ocellus-p3"].boss.x, ROOMS["ocellus-p3"].boss.y, ARCHIVE.p3.npcId],
    ];
    bosses.forEach(([id, name, x, y, npcId]) => {
      const { region } = open(id, `?encounter=${id}&seed=1&invincible=on`);
      const boss = [...region.mobs, ...region.newMobs].find((mob) => mob.mobName() === name);
      if (!boss) throw new Error(`${name} was not in ${id}`);
      expect({ x: boss.location.x, y: boss.location.y, npcId: npcIdOf(boss) }).toEqual({ x, y, npcId });
    });
  });

  it("stands the Smorks on their captured tile and fires graphic 4440 from there", () => {
    const { region, world } = open("bork", "?encounter=bork&seed=1&invincible=on");
    expect(region.width).toBe(ROOMS.bork.width);
    const smorks = [...region.mobs, ...region.newMobs].find((mob) => mob.mobName() === "Smorks");
    if (!smorks) throw new Error("the Smorks were not in the room");
    expect({ x: smorks.location.x, y: smorks.location.y, size: smorks.size, npcId: npcIdOf(smorks) }).toEqual({
      x: ROOMS.bork.smork.x,
      y: ROOMS.bork.smork.y,
      size: ARCHIVE.bork.smorkSize,
      npcId: ARCHIVE.bork.smorkNpcId,
    });
    expect(region.chat().some((line) => line.includes(String(GRAPHICS.smorkBomb)) && line.includes("4056"))).toBe(true);
    fight(world, ARCHIVE.bork.bombInterval + 1);
    const bomb = region.entities.find((entity) => entity.entityName() === `Projectile ${GRAPHICS.smorkBomb}`);
    if (!bomb) throw new Error("the bomb graphic was not launched");
    expect(bomb.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect({ x: bomb.location.x, y: bomb.location.y }).toEqual({ x: ROOMS.bork.smork.x, y: ROOMS.bork.smork.y });
  });

  it("places the Hooded Figure and the four batteries off the combat-add list", () => {
    const phase1 = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    const figure = [...phase1.region.mobs, ...phase1.region.newMobs].find((mob) => mob.mobName() === "Hooded Figure");
    if (!figure) throw new Error("the Hooded Figure was not in phase 1");
    expect(figure.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect({ x: figure.location.x, y: figure.location.y, size: figure.size, npcId: npcIdOf(figure) }).toEqual({
      x: HOODED_TILE.x,
      y: HOODED_TILE.y,
      size: ARCHIVE.p1.hoodedSize,
      npcId: ARCHIVE.p1.hoodedNpcId,
    });

    const guardian = open("guardian", "?encounter=guardian&seed=1&invincible=on");
    const batteries = [...guardian.region.mobs, ...guardian.region.newMobs].filter((mob) => mob.mobName() === "Guardian battery");
    expect(batteries.map((mob) => ({ x: mob.location.x, y: mob.location.y, size: mob.size, npcId: npcIdOf(mob) }))).toEqual(
      BATTERY_TILES.map((at) => ({ x: at.x, y: at.y, size: ARCHIVE.guardian.batterySize, npcId: ARCHIVE.guardian.batteryNpcId })),
    );
    batteries.forEach((battery) => expect(battery.get3dModel()).toBeInstanceOf(CacheRenderModel));
  });

  it("draws the stand-in floor and Bork's ledger model", () => {
    const { region } = open("bork", "?encounter=bork&seed=1&invincible=on");
    expect(region.drawDefaultFloor()).toBe(true);
    const present = [...region.mobs, ...region.newMobs];
    const boss = present.find((mob) => mob.mobName() === "Bork");
    const smorks = present.find((mob) => mob.mobName() === "Smorks");
    if (!boss || !smorks) throw new Error("Bork and the Smorks were not in the room");
    expect(boss.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect(smorks.get3dModel()).toBeInstanceOf(CacheRenderModel);
    const arena = region.entities.find((entity) => entity.entityName() === "Region 16727");
    if (!arena) throw new Error("the captured map was not in the room");
    expect(arena.get3dModel()).toBeInstanceOf(CacheRenderSceneModel);
    expect(region.chat().some((line) => line.includes("16727"))).toBe(true);
  });

  it("draws a tile marker for Ezekiel's lightning and the Dagon'hai ranged graphic", () => {
    const ezekiel = open("ezekiel", "?encounter=ezekiel&seed=1&invincible=on");
    fight(ezekiel.world, 11);
    const lightning = ezekiel.region.entities.find((entity) => entity.entityName() === "lightning");
    if (!lightning) throw new Error("the lightning tile was not marked");
    expect(lightning.get3dModel()).toBeInstanceOf(TileMarkerModel);

    const dagon = open("dagonhai", "?encounter=dagonhai&seed=1&invincible=on");
    fight(dagon.world, 1);
    const shot = dagon.region.entities.find((entity) => entity.entityName() === `Projectile ${GRAPHICS.dagonRanged}`);
    if (!shot) throw new Error("the trio did not loose the ranged shot");
    expect(shot.get3dModel()).toBeInstanceOf(CacheRenderModel);
  });

  it("keeps the book throw and the phase 2 volley as coloured spheres", () => {
    const dagon = open("dagonhai", "?encounter=dagonhai&seed=1&invincible=on");
    fight(dagon.world, 32);
    const book = dagon.region.entities.find((entity) => entity.entityName() === "Stand-in projectile");
    if (!book) throw new Error("the book throw was not a stand-in");
    expect(book.get3dModel()).toBeInstanceOf(BasicModel);

    const phase2 = open("ocellus-p2", "?encounter=ocellus-p2&seed=1&invincible=on");
    expect(phase2.region.chat().some((line) => line.includes("4269"))).toBe(true);
    expect(phase2.region.chat().some((line) => line.includes("stands still"))).toBe(true);
    const blade = [...phase2.region.mobs, ...phase2.region.newMobs].find((mob) => mob.mobName() === "The Blade");
    if (!blade) throw new Error("the Blade was not in the room");
    expect(blade.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect({ x: blade.location.x, y: blade.location.y, npc: phase2.region.snapshot()?.boss.npcId }).toEqual({ x: 11, y: 13, npc: ARCHIVE.p2.npcId });
    expect(blade.getPerceivedLocation(0).z).toBe(-BLADE_SEAT);
    const phase1 = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    const ocellus = [...phase1.region.mobs, ...phase1.region.newMobs].find((mob) => mob.mobName() === "Ocellus");
    if (!ocellus) throw new Error("Ocellus was not in phase 1");
    expect(ocellus.getPerceivedLocation(0).z).toBe(0);
    fight(phase2.world, 12);
    const volley = phase2.region.entities.find((entity) => entity.entityName() === "Stand-in projectile");
    if (!volley) throw new Error("the volley was not a stand-in");
    expect(volley.get3dModel()).toBeInstanceOf(BasicModel);
  });

  it("lands a hitsplat on the hit and does not apply that hit again next tick", () => {
    const ezekiel = open("ezekiel", "?encounter=ezekiel&seed=1&invincible=on");
    const before = ezekiel.player.currentStats.hitpoint;
    fight(ezekiel.world, 1);
    const drop = before - ezekiel.player.currentStats.hitpoint;
    const splat = ezekiel.player.incomingProjectiles[0];
    if (!splat) throw new Error("the melee hit did not leave a hitsplat");
    expect(drop).toBeGreaterThan(0);
    expect(splat.damage).toBe(drop);
    expect(splat.remainingDelay).toBe(0);
    const held = ezekiel.player.currentStats.hitpoint;
    fight(ezekiel.world, 1);
    expect(ezekiel.player.currentStats.hitpoint).toBe(held);
  });

  it("shows a block splat for a zero hit and a heal splat for the sword", () => {
    const guardian = open("guardian", "?encounter=guardian&seed=1&invincible=on");
    fight(guardian.world, 29);
    expect(guardian.player.incomingProjectiles.some((splat) => splat.damage === 0)).toBe(true);

    const healed = open("ezekiel", "?encounter=ezekiel&seed=1&invincible=on&sword=heal");
    fight(healed.world, 27);
    const boss = [...healed.region.mobs, ...healed.region.newMobs].find((mob) => mob.mobName() === "Ezekiel");
    if (!boss) throw new Error("Ezekiel was not in the room");
    expect(boss.incomingProjectiles.some((splat) => splat.damage < 0)).toBe(true);
  });

  it("wears the ranged set in phase 1, the crush set in phase 2, and the crush set when gear asks for it", () => {
    const phase1 = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    expect(phase1.player.equipment.weapon?.cacheItemId).toBe(20997);
    expect(phase1.player.equipment.helmet?.cacheItemId).toBe(27235);

    const phase2 = open("ocellus-p2", "?encounter=ocellus-p2&seed=1&invincible=on");
    expect(phase2.player.equipment.weapon?.cacheItemId).toBe(22325);
    expect(phase2.player.equipment.helmet?.cacheItemId).toBe(24419);

    const crushed = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on&gear=melee");
    expect(crushed.player.equipment.weapon?.cacheItemId).toBe(22325);
    expect(parseRaid(new URL("http://localhost/?gear=bow"), "bork", () => 1).rejected).toContain("gear=bow");
  });

  it("draws the phase 3 censers as coloured boxes and the voids as ledger models", () => {
    const { region, world } = open("ocellus-p3", "?encounter=ocellus-p3&seed=1&invincible=on");
    const present = [...region.mobs, ...region.newMobs];
    const censer = present.find((mob) => mob.mobName() === "Bandosian censer");
    const rift = present.find((mob) => mob.mobName() === "Void rift");
    if (!censer || !rift) throw new Error("the censer or the rift was not in the room");
    expect(censer.get3dModel()).toBeInstanceOf(BasicModel);
    expect(rift.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect(region.chat().some((line) => line.includes("censers are coloured stand-ins"))).toBe(true);
    fight(world, 1);
    expect(region.snapshot()?.boss.npcId).toBe(ARCHIVE.p3.npcId);
  });

  it.each<[RaidId, number]>([
    ["xarth", 10],
    ["ocellus-p3", 10],
  ])("records a death in %s on tick %i and keeps the player in the room", (id, at) => {
    const { region, world, player } = open(id, `?encounter=${id}&seed=7`);
    fight(world, at + 1);
    expect(region.snapshot()?.run).toEqual({ kind: "ended", seed: seed(7), at: tick(at), reason: "death" });
    expect(region.snapshot()?.player.hp).toBe(player.stats.hitpoint);
    expect(player.dying).toBe(-1);
    expect(region.players).toContain(player);
    fight(world, 8);
    expect(region.players).toContain(player);
    expect(region.snapshot()?.run).toEqual({ kind: "ended", seed: seed(7), at: tick(at), reason: "death" });
  });

  it.each(RAID_IDS)("a lethal hit in %s restores the player instead of removing them", (id) => {
    const { region, world, player } = open(id, `?encounter=${id}&seed=1`);
    player.currentStats.hitpoint = 1;
    let died = false;
    for (let step = 0; step < 160 && !died; step += 1) {
      world.tickWorld();
      const run = region.snapshot()?.run;
      died = run?.kind === "ended" && run.reason === "death";
    }
    if (!died) throw new Error(`${id} never recorded a death`);
    expect(region.snapshot()?.player.hp).toBe(player.stats.hitpoint);
    expect(player.dying).toBe(-1);
    expect(region.players).toContain(player);
    fight(world, 6);
    expect(region.players).toContain(player);
  });

  it("an invincible lethal hit stays in the fight and says so", () => {
    const { region, world, player } = open("xarth", "?encounter=xarth&seed=7&invincible=on");
    player.currentStats.hitpoint = 1;
    fight(world, 3);
    expect(region.snapshot()?.run).toEqual({ kind: "running", seed: seed(7) });
    expect(region.snapshot()?.player.hp).toBe(player.stats.hitpoint);
    expect(player.dying).toBe(-1);
    expect(region.chat().some((line) => line.includes("Invincible"))).toBe(true);
  });
});
