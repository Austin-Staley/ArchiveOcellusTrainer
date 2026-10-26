import { BasicModel, CacheRenderModel, CacheRenderSceneModel, Settings, TileMarkerModel, Viewport, World } from "osrs-sdk";
import type { Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import type { RaidId } from "../catalog";
import { parseRaid } from "../catalog";
import { GRAPHICS } from "../poses";
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

describe("raid rooms in 3D", () => {
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
});
