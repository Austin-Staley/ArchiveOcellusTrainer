import { Settings, Viewport, World } from "osrs-sdk";
import type { Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import type { RaidId } from "../catalog";
import { parseRaid } from "../catalog";
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

describe("void augmenter", () => {
  it("sets a level 99's combat stats and has 44 hitpoints", () => {
    const { region, world, player } = open("ocellus-p3", "?encounter=ocellus-p3&seed=1&invincible=on&bosshp=3937");
    fight(world, 18);
    const boss = region.mobs.find((mob) => mob.mobName() === "Ocellus");
    if (!boss) throw new Error(`Ocellus was not in the room; mobs: ${region.mobs.map((mob) => mob.mobName()).join(", ")}`);
    boss.currentStats.hitpoint = 2000;
    fight(world, 18);
    const add = region.mobs.find((mob) => mob.mobName() === "Void augmenter");
    if (!add) throw new Error(`the augmenter was not summoned; mobs: ${region.mobs.map((mob) => mob.mobName()).join(", ")}; chat: ${region.chat().join(" | ")}`);
    expect(add.stats.hitpoint).toBe(44);
    add.currentStats.hitpoint = 0;
    world.tickWorld();
    expect({
      attack: player.currentStats.attack,
      strength: player.currentStats.strength,
      range: player.currentStats.range,
      magic: player.currentStats.magic,
    }).toEqual({ attack: 116, strength: 116, range: 112, magic: 112 });
    expect(region.chat().some((line) => line.includes("Attack and Strength to 116") && line.includes("Magic and Ranged to 112"))).toBe(true);
  });

  it("names Bork's bomb interval as an unsourced practice stand-in", () => {
    const { region } = open("bork", "?encounter=bork&seed=1&invincible=on");
    expect(region.chat().some((line) => line.includes("33") && line.includes("unsourced practice stand-in"))).toBe(true);
  });
});
