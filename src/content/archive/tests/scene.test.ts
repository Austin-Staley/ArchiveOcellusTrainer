import { BasicModel, CacheRenderModel, CacheRenderSceneModel, Settings, TileMarkerModel, Viewport, World } from "osrs-sdk";
import type { Mob, Player } from "osrs-sdk";
import { describe, expect, it } from "vitest";
import type { RaidId } from "../catalog";
import { RAID_IDS, parseRaid } from "../catalog";
import { seed, tick, tile } from "../../../sim/brands";
import { crackCues } from "../cracks";
import { BATTERY_TILES, ROOMS } from "../layout";
import { bossMayStand } from "../movement";
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

function bossNpc(id: RaidId): number {
  switch (id) {
    case "bork":
      return ARCHIVE.bork.npcId;
    case "ezekiel":
      return ARCHIVE.ezekiel.npcId;
    case "guardian":
      return ARCHIVE.guardian.flyingNpcId;
    case "moia":
      return ARCHIVE.moia.npcId;
    case "xarth":
      return ARCHIVE.xarth.npcId;
    case "dagonhai":
      return ARCHIVE.dagonhai.npcId;
    case "ocellus-p1":
      return ARCHIVE.p1.npcId;
    case "ocellus-p2":
      return ARCHIVE.p2.npcId;
    case "ocellus-p3":
      return ARCHIVE.p3.npcId;
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
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

  it.each(RAID_IDS)("places exactly one boss in %s", (id) => {
    const { region } = open(id, `?encounter=${id}&seed=1&invincible=on`);
    const present = [...region.mobs, ...region.newMobs];
    const bosses = present.filter((mob) => npcIdOf(mob) === bossNpc(id));
    expect(bosses).toHaveLength(1);
    expect(region.primaryBoss).toBe(bosses[0]);
  });

  it("shows the red blast outline for the five ticks before it detonates, and hides both helpers when Settings is off", () => {
    const { region, world } = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    let seen = false;
    for (let step = 0; step < 80 && !seen; step += 1) {
      fight(world, 1);
      seen = region.entities.some((entity) => entity.entityName() === "blast-outline");
    }
    expect(seen).toBe(true);
    const outline = region.fightLog().rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "blast-outline");
    const vine = region.fightLog().rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "vine");
    if (!outline || outline.event.kind !== "mark") throw new Error("the outline was not logged");
    expect(vine).toBeUndefined();
    const countdown = region.fightLog().rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "stand-4");
    expect(countdown).toBeDefined();
    fight(world, 4);
    expect(region.entities.some((entity) => entity.entityName() === "blast-outline")).toBe(false);
    fight(world, 1);
    const detonated = region.fightLog().rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "vine");
    if (!detonated || detonated.event.kind !== "mark") throw new Error("the blast did not detonate");
    expect(detonated.at).toBe(outline.at + ARCHIVE.p1.outlineLead);

    const quiet = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    quiet.region.standHelper = false;
    quiet.region.blastOutline = false;
    fight(quiet.world, 80);
    expect(quiet.region.entities.some((entity) => {
      const name = entity.entityName() ?? "";
      return name === "blast-outline" || name.startsWith("stand");
    })).toBe(false);
  });

  it("draws one Ocellus in phase 1, and a missed tendril's heal of 2 lands on that body", () => {
    const { region, world, player } = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    const present = [...region.mobs, ...region.newMobs];
    const bodies = present.filter((mob) => {
      const id = npcIdOf(mob);
      return id === ARCHIVE.p1.npcId || id === ARCHIVE.p1.hoodedNpcId || id === ARCHIVE.p2.npcId || id === ARCHIVE.p2.formNpcId;
    });
    expect(bodies.map((mob) => npcIdOf(mob))).toEqual([ARCHIVE.p1.npcId]);
    const blade = region.entities.find((entity) => entity.entityName() === "The Blade");
    if (!blade) throw new Error("the phase 1 sword was not in the room");
    expect(blade.get3dModel()).toBeInstanceOf(CacheRenderModel);
    expect({ x: blade.location.x, y: blade.location.y, z: blade.getPerceivedLocation(0).z }).toEqual({ x: 5, y: 17, z: -BLADE_SEAT });
    player.setLocation({ x: 1, y: 1 });
    let sawHeal = false;
    for (let step = 0; step < 80; step += 1) {
      fight(world, 1);
      const healed = [...region.mobs, ...region.newMobs].filter((mob) => mob.incomingProjectiles.some((splat) => splat.damage === -ARCHIVE.p1.tendrilBossHeal));
      if (healed.length === 0) continue;
      expect(healed.map((mob) => npcIdOf(mob))).toEqual([ARCHIVE.p1.npcId]);
      sawHeal = true;
    }
    expect(sawHeal).toBe(true);
    expect({ x: blade.location.x, y: blade.location.y }).toEqual({ x: 5, y: 17 });
    const boss = region.snapshot()?.boss;
    if (!boss) throw new Error("Ocellus was not in phase 1");
    expect(bossMayStand("ocellus-p1", tile(boss.x, boss.y))).toBe(true);
  });

  it("places the four batteries off the combat-add list", () => {
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

  it("keeps the book throw as a coloured sphere and draws the phase 2 volley graphic", () => {
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
    const volley = phase2.region.entities.find((entity) => entity.entityName() === `Projectile ${GRAPHICS.p2Volley}`);
    if (!volley) throw new Error("the volley graphic was not launched");
    expect(volley.get3dModel()).toBeInstanceOf(CacheRenderModel);
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
    fight(world, ARCHIVE.p3.spinAt);
    const spin = region.entities.find((entity) => entity.entityName() === `Projectile ${GRAPHICS.p3Spin}`);
    if (!spin) throw new Error("the spin graphic was not launched");
    expect(spin.get3dModel()).toBeInstanceOf(CacheRenderModel);
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

  it("draws the phase 1 cracks on the floor and the phase 2 portal grid", () => {
    const phase1 = open("ocellus-p1", "?encounter=ocellus-p1&seed=1&invincible=on");
    let cracks = phase1.region.entities.filter((entity) => {
      const name = entity.entityName();
      return name !== null && name.startsWith("Crack ");
    });
    for (let step = 0; step < 80 && cracks.length === 0; step += 1) {
      fight(phase1.world, 1);
      cracks = phase1.region.entities.filter((entity) => {
        const name = entity.entityName();
        return name !== null && name.startsWith("Crack ");
      });
    }
    const opened = phase1.region.fightLog().rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "tendril");
    if (!opened || opened.event.kind !== "mark") throw new Error("the first crack was not marked");
    const cues = crackCues(opened.event.tiles);
    expect(cracks.map((entity) => ({ x: entity.location.x, y: entity.location.y }))).toEqual(cues.map((cue) => ({ x: cue.at.x, y: cue.at.y })));
    const far = cues[cues.length - 1];
    if (far === undefined) throw new Error("the first crack had no far tile");
    expect(cracks.find((entity) => entity.location.x === far.at.x && entity.location.y === far.at.y)?.entityName()).toBe(`Crack ${far.open}`);

    const phase2 = open("ocellus-p2", "?encounter=ocellus-p2&seed=1&invincible=on");
    fight(phase2.world, 3);
    const risen = phase2.region.entities.filter((entity) => {
      const name = entity.entityName();
      return name !== null && name.startsWith("Portal ");
    });
    expect(risen).toHaveLength(24);
    expect(risen.every((entity) => entity.entityName()?.startsWith("Portal orange"))).toBe(true);
    fight(phase2.world, 9);
    const purple = phase2.region.entities.filter((entity) => entity.entityName() === "Portal purple north 0");
    const gap = phase2.region.entities.filter((entity) => entity.entityName() === "Portal orange north 1");
    expect(purple).toHaveLength(1);
    expect(gap).toHaveLength(1);
    expect(phase2.region.portalCall()).toEqual({ colour: "orange", quadrant: "NE" });
  });

  it("keeps speaking after the chat window is full, and seed 5 opens red in the north-east", () => {
    const seeded = open("ocellus-p2", "?encounter=ocellus-p2&seed=5&invincible=on");
    fight(seeded.world, 22);
    const lines = seeded.region.chat();
    expect(lines).toHaveLength(8);
    expect(seeded.region.chatMark()).toBeGreaterThan(8);
    expect(lines[lines.length - 1]).toContain("red");
    expect(lines[lines.length - 1]).toContain("NE");
    expect(seeded.region.portalCall()).toEqual({ colour: "red", quadrant: "NE" });
  });

  it("holds The Blade on its scenery tile while the player moves", () => {
    const { region, world, player } = open("ocellus-p2", "?encounter=ocellus-p2&seed=1&invincible=on");
    const blade = [...region.mobs, ...region.newMobs].find((mob) => mob.mobName() === "The Blade");
    if (!blade) throw new Error("the Blade was not in the room");
    blade.aggro = player;
    [tile(4, 4), tile(20, 20), tile(12, 4), tile(4, 20), tile(18, 8)].forEach((at) => {
      player.setLocation({ x: at.x, y: at.y });
      fight(world, 4);
      expect({ x: blade.location.x, y: blade.location.y }).toEqual({ x: 11, y: 13 });
      expect(region.snapshot()?.boss).toMatchObject({ x: 11, y: 13 });
    });
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
