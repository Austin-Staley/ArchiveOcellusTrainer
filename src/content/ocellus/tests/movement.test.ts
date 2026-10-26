import { describe, expect, it } from "vitest";
import { OCELLUS_P1, OCELLUS_P2, OCELLUS_P3, OCELLUS_P4 } from "../js/OcellusTimings";
import { startP1Drill } from "./p1drill";
import { startP3Drill } from "./p3drill";

const has = (tiles: readonly { x: number; y: number }[], x: number, y: number) => tiles.some((at) => at.x === x && at.y === y);

describe("phase 1 walk", () => {
  it("keeps the start, the middle, the four corners and the logged first steps, and blocks a tile off every path", async () => {
    const drill = await startP1Drill({ seed: 1 });
    const tiles = drill.region.walkableTiles();
    const { start, middle, corners } = OCELLUS_P1.room;
    drill.tickTo(12);
    const path = [4, 5, 6, 7, 8, 9, 10, 11, 12].map((at) => drill.row(at).bossAt);
    drill.dispose();
    expect(has(tiles, start.value.x, start.value.y)).toBe(true);
    expect(has(tiles, middle.value.x, middle.value.y)).toBe(true);
    expect(has(tiles, corners.value["north-east"].x, corners.value["north-east"].y)).toBe(true);
    expect(has(tiles, corners.value["south-east"].x, corners.value["south-east"].y)).toBe(true);
    expect(has(tiles, corners.value["south-west"].x, corners.value["south-west"].y)).toBe(true);
    expect(has(tiles, corners.value["north-west"].x, corners.value["north-west"].y)).toBe(true);
    path.forEach((at) => expect(has(tiles, at.x, at.y)).toBe(true));
    expect(has(tiles, 0, 0)).toBe(false);
    expect(has(tiles, 3, 3)).toBe(false);
    expect(path.map((at) => [at.x, at.y])).toEqual([
      [14, 16], [14, 15], [14, 14], [15, 13], [16, 12], [17, 11], [18, 10], [19, 9], [20, 8],
    ]);
  });

  it("is stationary on arrival and at a corner, and mobile while he walks and on the teleport into the middle", async () => {
    const walking = await startP1Drill({ seed: 1 });
    expect(walking.region.bossMovement()).toEqual({ mobility: "stationary", tick: 0, actor: "Ocellus" });
    walking.tickTo(4);
    const onTheWalk = walking.region.bossMovement();
    walking.tickTo(15);
    const atTheCorner = walking.region.bossMovement();
    walking.dispose();

    const middle = await startP1Drill({ seed: 1, bossHp: 1650 });
    middle.tickTo(4);
    const entering = middle.region.bossMovement();
    middle.tickTo(8);
    const landed = middle.region.bossMovement();
    middle.tickTo(9);
    const holding = middle.region.bossMovement();
    middle.dispose();

    expect(onTheWalk).toEqual({ mobility: "mobile", tick: 4, actor: "Ocellus" });
    expect(atTheCorner).toEqual({ mobility: "stationary", tick: 15, actor: "Ocellus" });
    expect(entering).toEqual({ mobility: "stationary", tick: 4, actor: "Ocellus" });
    expect(landed).toEqual({ mobility: "mobile", tick: 8, actor: "Ocellus" });
    expect(holding).toEqual({ mobility: "stationary", tick: 9, actor: "Ocellus" });
  });
});

describe("phases that stand still", () => {
  it("gives phase 2, phase 3 and phase 4 one anchor each", () => {
    expect([OCELLUS_P2.arena.bossAnchor.value.x, OCELLUS_P2.arena.bossAnchor.value.y]).toEqual([14, 14]);
    expect([OCELLUS_P3.arena.bossAnchor.value.x, OCELLUS_P3.arena.bossAnchor.value.y]).toEqual([21, 7]);
    expect([OCELLUS_P4.geometry.bossAnchor.value.x, OCELLUS_P4.geometry.bossAnchor.value.y]).toEqual([4, 6]);
  });

  it("steps phase 3 toward the player during the chain and holds his tile through the spin", async () => {
    const drill = await startP3Drill({ seed: 1 });
    const start = { x: drill.boss().location.x, y: drill.boss().location.y };
    drill.tickTo(12);
    const chased = { x: drill.boss().location.x, y: drill.boss().location.y };
    const whileChasing = drill.region.bossMovement();
    drill.tickTo(24);
    const spin = { x: drill.boss().location.x, y: drill.boss().location.y };
    drill.tickTo(28);
    const still = { x: drill.boss().location.x, y: drill.boss().location.y };
    const standing = drill.region.bossMovement();
    drill.dispose();
    expect(start).toEqual({ x: 21, y: 7 });
    expect(chased).not.toEqual(start);
    expect(whileChasing).toMatchObject({ mobility: "mobile", actor: "Ocellus" });
    expect(still).toEqual(spin);
    expect(standing).toMatchObject({ mobility: "stationary", actor: "Ocellus" });
  });
});
