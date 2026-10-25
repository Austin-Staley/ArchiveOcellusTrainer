import { BasicModel, CacheRenderModel, Settings, TileMarkerModel, Viewport, World } from "osrs-sdk";
import type { Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import type { RaidId } from "../catalog";
import { parseRaid } from "../catalog";
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
    expect(region.chat().some((line) => line.includes("No map id"))).toBe(true);
  });

  it("draws a tile marker for Ezekiel's lightning and a sphere for a Dagon'hai shot", () => {
    const ezekiel = open("ezekiel", "?encounter=ezekiel&seed=1&invincible=on");
    fight(ezekiel.world, 11);
    const lightning = ezekiel.region.entities.find((entity) => entity.entityName() === "lightning");
    if (!lightning) throw new Error("the lightning tile was not marked");
    expect(lightning.get3dModel()).toBeInstanceOf(TileMarkerModel);

    const dagon = open("dagonhai", "?encounter=dagonhai&seed=1&invincible=on");
    fight(dagon.world, 1);
    const shot = dagon.region.entities.find((entity) => entity.entityName() === "Stand-in projectile");
    if (!shot) throw new Error("the trio did not loose a stand-in shot");
    expect(shot.get3dModel()).toBeInstanceOf(BasicModel);
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
