import { describe, expect, it } from "vitest";
import { seed, tick, tile } from "../../../sim/brands";
import { defaultOptions } from "../catalog";
import { advance, initialMemory } from "../clock";
import type { RaidInput } from "../clock";
import { BINDER_STOPS, DAGON_TRAIL, MOIA_STATIONS, P1_CORNERS, ROOMS } from "../layout";
import { ADD_WALK, BOSS_WALK, acceptAddStep, acceptBossStep, addMobility, bossMayStand, bossMobility, cauldronMayStand, cauldronMobile, overlayTiles } from "../movement";
import { ARCHIVE } from "../timings";

const options = defaultOptions(seed(1));

function input(id: keyof typeof ROOMS): RaidInput {
  return {
    player: ROOMS[id].player,
    bossHp: options.moiaHp,
    realHp: ARCHIVE.guardian.hp,
    addsHp: [],
    addsAlive: 0,
    prayer: null,
    previous: ROOMS[id].player,
    running: true,
  };
}

describe("boss walkable tiles", () => {
  it("pins the captured sets and the boxes the digest did not list in full", () => {
    expect(BOSS_WALK.xarth.exact).toEqual([tile(7, 7)]);
    expect(BOSS_WALK["ocellus-p2"].exact).toEqual([tile(11, 13)]);
    expect(BOSS_WALK.moia.exact).toEqual([tile(0, 7), tile(7, 0), tile(14, 7), tile(7, 7), tile(7, 14)]);
    expect(BOSS_WALK.bork.exact).toBeNull();
    expect(BOSS_WALK.bork.bound).toEqual({ minX: 8, minY: 8, maxX: 19, maxY: 21 });
    expect(BOSS_WALK.ezekiel.bound).toEqual({ minX: 5, minY: 6, maxX: 11, maxY: 12 });
    expect(BOSS_WALK.guardian.bound).toEqual({ minX: 2, minY: -4, maxX: 22, maxY: 36 });
    expect(BOSS_WALK.dagonhai.bound).toEqual({ minX: -1, minY: 8, maxX: 4, maxY: 16 });
    expect(BOSS_WALK["ocellus-p1"].bound).toEqual({ minX: -1, minY: 11, maxX: 11, maxY: 23 });
    expect(BOSS_WALK["ocellus-p3"].bound).toEqual({ minX: -12, minY: 2, maxX: 9, maxY: 22 });
    expect(ADD_WALK.smorks.exact).toEqual([tile(14, 14)]);
    expect(ADD_WALK.hooded.exact).toEqual([tile(5, 20)]);
    expect(ADD_WALK.batteries.exact).toEqual([tile(25, 3), tile(25, 16), tile(0, 3), tile(0, 16)]);
    expect(ADD_WALK.binders.bound).toEqual({ minX: 4, minY: 2, maxX: 12, maxY: 10 });
  });

  it("tints the exact tile where the set is complete, and the box clipped to the room otherwise", () => {
    expect(overlayTiles("xarth")).toEqual([tile(7, 7)]);
    const bork = overlayTiles("bork");
    expect(bork).toHaveLength(81);
    expect(bork).toContainEqual(tile(10, 12));
    expect(bork).not.toContainEqual(tile(0, 0));
    expect(bork).not.toContainEqual(tile(19, 21));
    expect(bossMayStand("ocellus-p1", tile(5, 17))).toBe(true);
    expect(bossMayStand("ocellus-p1", tile(11, 23))).toBe(true);
    expect(bossMayStand("ocellus-p1", tile(17, 17))).toBe(false);
    expect(bossMayStand("ocellus-p1", P1_CORNERS[2] ?? tile(0, 0))).toBe(false);
    expect(bossMayStand("moia", tile(1, 1))).toBe(false);
    MOIA_STATIONS.forEach((at) => expect(bossMayStand("moia", at)).toBe(true));
  });
});

describe("stationary and mobile windows", () => {
  it("holds every boss except Moia, and moves Moia only on a relocate or her reappearance", () => {
    (["bork", "ezekiel", "guardian", "xarth", "dagonhai", "ocellus-p2", "ocellus-p3"] as const).forEach((id) => {
      expect(bossMobility(initialMemory(id), 0)).toBe("stationary");
      expect(bossMobility(initialMemory(id), 20)).toBe("stationary");
    });
    expect(bossMobility(initialMemory("ocellus-p1"), 0)).toBe("stationary");
    const moia = { id: "moia", phase: "p1", reappear: -1, nextChant: -1, chants: 0, station: 0, hopped: 0 } as const;
    expect(bossMobility(moia, 0)).toBe("stationary");
    expect(bossMobility(moia, ARCHIVE.moia.relocateFirst)).toBe("mobile");
    expect(bossMobility(moia, ARCHIVE.moia.relocateFirst + 1)).toBe("stationary");
    expect(bossMobility(moia, ARCHIVE.moia.relocateFirst + ARCHIVE.moia.relocateInterval)).toBe("mobile");
    expect(bossMobility({ ...moia, phase: "gone", reappear: 40 }, 40)).toBe("stationary");
    expect(bossMobility({ ...moia, phase: "p2", reappear: 40 }, 40)).toBe("mobile");
    expect(bossMobility({ ...moia, phase: "p2", reappear: 40 }, 41)).toBe("stationary");
  });

  it("refuses a step off the set and a step during a stationary tick", () => {
    const home = ROOMS["ocellus-p1"].boss;
    expect(acceptBossStep("ocellus-p1", home, tile(17, 17), "stationary")).toEqual(home);
    expect(acceptBossStep("ocellus-p1", home, tile(17, 17), "mobile")).toEqual(home);
    expect(acceptBossStep("moia", tile(0, 7), tile(7, 14), "mobile")).toEqual(tile(7, 14));
    expect(acceptBossStep("moia", tile(0, 7), tile(7, 14), "stationary")).toEqual(tile(0, 7));
    expect(acceptBossStep("moia", tile(0, 7), tile(1, 1), "mobile")).toEqual(tile(0, 7));
    expect(acceptBossStep("xarth", tile(7, 7), tile(8, 7), "mobile")).toEqual(tile(7, 7));
  });

  it("lets a binder hop inside the captured box and refuses a hop outside it", () => {
    expect(addMobility("moia", 0)).toBe("mobile");
    expect(addMobility("moia", ARCHIVE.moia.binderHop)).toBe("mobile");
    expect(addMobility("moia", 1)).toBe("stationary");
    expect(addMobility("bork", 0)).toBe("stationary");
    const outside = BINDER_STOPS.find((at) => at.y > ADD_WALK.binders.bound.maxY) ?? tile(4, 12);
    expect(acceptAddStep("moia", tile(4, 4), outside, "mobile")).toEqual(tile(4, 4));
    expect(acceptAddStep("moia", tile(4, 4), tile(8, 8), "mobile")).toEqual(tile(8, 8));
    expect(acceptAddStep("moia", tile(4, 4), tile(8, 8), "stationary")).toEqual(tile(4, 4));
    expect(acceptAddStep("bork", tile(14, 14), tile(15, 14), "mobile")).toEqual(tile(14, 14));
  });

  it("steps the cauldron only on its visit ticks, and only inside the one fight's box", () => {
    expect(cauldronMobile(ARCHIVE.dagonhai.cauldronFirst)).toBe(true);
    expect(cauldronMobile(ARCHIVE.dagonhai.cauldronFirst + 1)).toBe(false);
    DAGON_TRAIL.forEach((at) => expect(cauldronMayStand(at)).toBe(true));
    expect(cauldronMayStand(tile(0, 0))).toBe(false);
    expect(ADD_WALK.cauldron.trail).toEqual([...DAGON_TRAIL]);
  });

  it("sends Moia only to a captured tile, and only on a mobile tick", () => {
    let memory = initialMemory("moia");
    let moves = 0;
    for (let at = 0; at <= 80; at += 1) {
      const step = advance(memory, options, input("moia"), tick(at));
      step.events.forEach((stamp) => {
        if (stamp.event.kind !== "boss-at") return;
        moves += 1;
        expect(bossMobility(step.memory, at)).toBe("mobile");
        expect(bossMayStand("moia", stamp.event.tile)).toBe(true);
      });
      memory = step.memory;
    }
    expect(moves).toBeGreaterThan(0);
  });

  it("walks Ocellus along the logged path and keeps every step inside the captured box", () => {
    let memory = initialMemory("ocellus-p1");
    const stood = [ROOMS["ocellus-p1"].boss];
    let mobileSteps = 0;
    for (let at = 0; at <= 90; at += 1) {
      const step = advance(memory, options, input("ocellus-p1"), tick(at));
      step.events.forEach((stamp) => {
        if (stamp.event.kind !== "boss-at") return;
        mobileSteps += 1;
        expect(bossMobility(step.memory, at)).toBe("mobile");
        expect(bossMayStand("ocellus-p1", stamp.event.tile)).toBe(true);
        expect(stamp.event.tile).not.toEqual(tile(-1, 23));
        expect(stamp.event.tile).not.toEqual(tile(-1, 11));
        stood.push(stamp.event.tile);
      });
      memory = step.memory;
    }
    expect(mobileSteps).toBeGreaterThan(1);
    expect(new Set(stood.map((at) => `${at.x},${at.y}`)).size).toBeGreaterThan(1);
  });
});
