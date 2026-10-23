import { paintedTiles } from "../../../../test/paintedTiles";
import { startDrill } from "./drill";
import type { At } from "./drill";

const NON_LETHAL = { focus: "lifeforce-orb" } as const;

describe("Ocellus arena", () => {
  test("the player spawns two tiles north of the 5x5, the boss's 3x3 stands on x 4-6, y 4-6, and a walk runs two tiles a tick", () => {
    const drill = startDrill({ selection: NON_LETHAL });
    const boss = drill.boss();
    expect([drill.player().location, boss.location, boss.size]).toEqual([{ x: 5, y: 1 }, { x: 4, y: 6 }, 3]);

    drill.walkTo({ x: 9, y: 1 });
    drill.region.world.tickWorld();
    const afterOne = { ...drill.player().location };
    drill.region.world.tickWorld();
    expect([afterOne, drill.player().location]).toEqual([{ x: 7, y: 1 }, { x: 9, y: 1 }]);
    drill.dispose();
  });

  test("the arena paints the floor and the brazier walkway 1 tile clear of the 5x5's corner, and the player can stand on the floor and nowhere else", () => {
    const drill = startDrill({ selection: NON_LETHAL });
    const painted = paintedTiles((context, scale) => drill.region.drawWorldBackground(context, scale));
    const standsOn = (to: At) => {
      drill.walkTo(to);
      for (let moved = true; moved; ) {
        const { x, y } = drill.player().location;
        drill.region.world.tickWorld();
        moved = drill.player().location.x !== x || drill.player().location.y !== y;
      }
      return drill.player().location.x === to.x && drill.player().location.y === to.y;
    };
    const rows: string[] = [];
    for (let y = -1; y <= 14; y++) {
      let row = "";
      for (let x = -1; x <= 15; x++) {
        const [stands, drawn] = [standsOn({ x, y }), painted.has(`${x},${y}`)];
        row += stands ? (drawn ? "#" : "!") : drawn ? "w" : ".";
      }
      rows.push(row);
    }
    expect(rows).toEqual([
      ".................",
      "..............ww.",
      "...###########ww.",
      "..############ww.",
      "..###########ww..",
      "..##########ww...",
      "..#########ww....",
      "..########ww.....",
      "..########ww.....",
      "..#######ww......",
      "..######ww.......",
      "..#####ww........",
      "..####ww.........",
      "..###ww..........",
      ".wwwww...........",
      ".................",
    ]);
    drill.dispose();
  });

  test("a walk past the edge, or onto the tile beside it, stops on the floor tile nearest the order", () => {
    const stopsAt = (to: At) => {
      const drill = startDrill({ selection: NON_LETHAL });
      drill.walkTo(to);
      drill.region.world.tickWorld(6);
      const at = { ...drill.player().location };
      drill.dispose();
      return at;
    };
    expect([stopsAt({ x: 16, y: 1 }), stopsAt({ x: 13, y: 1 }), stopsAt({ x: 5, y: -3 })]).toEqual([
      { x: 12, y: 1 },
      { x: 12, y: 1 },
      { x: 5, y: 1 },
    ]);
  });

  test("a walk along the diagonal edge keeps to the floor instead of cutting across the blocked tiles beside it", () => {
    const drill = startDrill({ selection: NON_LETHAL });
    drill.walkTo({ x: 12, y: 1 });
    drill.region.world.tickWorld(6);
    drill.walkTo({ x: 3, y: 12 });
    const trail: At[] = [];
    for (let tick = 0; tick < 6; tick++) {
      drill.region.world.tickWorld();
      trail.push({ ...drill.player().location });
    }
    expect(trail).toEqual([{ x: 10, y: 3 }, { x: 8, y: 5 }, { x: 7, y: 7 }, { x: 5, y: 9 }, { x: 3, y: 11 }, { x: 3, y: 12 }]);
    drill.dispose();
  });
});
