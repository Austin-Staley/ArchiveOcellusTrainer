import { startDrill, UNDER_BOSS } from "./drill";
import type { At, DrillOptions } from "./drill";

const NORTH_EAST_RIFT: At = { x: 10, y: 2 };

function tilesAndAttacks(drill: ReturnType<typeof startDrill>, from: number, to: number) {
  const rows = drill.rows().filter((row) => row.tick >= from && row.tick <= to);
  return {
    tiles: rows.map((row) => row.playerAtPostTick.tile),
    attacks: rows.flatMap((row) =>
      row.events.flatMap((event) => {
        if (event.kind === "player-hit-judged") return [["boss", event.at]];
        if (event.kind === "rift-hit") return [[event.rift, event.at]];
        return [];
      }),
    ),
  };
}

describe("a later click in the same tick replaces an earlier one", () => {
  test.each<{ name: string; options: DrillOptions; after: number; first: At; last: At; tiles: readonly At[]; attacks: readonly (readonly [string, number])[] }>([
    {
      name: "a run to a second tile replaces the run to the first",
      options: { seed: 1, selection: { focus: "transition-attacks" } },
      after: 30,
      first: { x: 8, y: 3 },
      last: { x: 3, y: 2 },
      tiles: [{ x: 3, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 2 }],
      attacks: [],
    },
    {
      name: "an attack on the boss replaces a walk, so the player stands and the bow's first shot lands 3 ticks later",
      options: { seed: 4, selection: { focus: "rifts", drillStart: "cycle-start" } },
      after: 13,
      first: { x: 8, y: 2 },
      last: UNDER_BOSS,
      tiles: [{ x: 5, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 1 }],
      attacks: [["boss", 17]],
    },
    {
      name: "a walk replaces an attack on the boss, so the player runs and never shoots",
      options: { seed: 4, selection: { focus: "rifts", drillStart: "cycle-start" } },
      after: 13,
      first: UNDER_BOSS,
      last: { x: 8, y: 2 },
      tiles: [{ x: 7, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 2 }],
      attacks: [],
    },
    {
      name: "an attack on the boss replaces an attack on the north-east rift",
      options: { seed: 1, selection: { focus: "rifts" } },
      after: 68,
      first: NORTH_EAST_RIFT,
      last: UNDER_BOSS,
      tiles: [{ x: 5, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 1 }],
      attacks: [["boss", 72]],
    },
  ])("$name, when the last click comes in the frame before the tick", async ({ options, after, first, last, tiles, attacks }) => {
    const drill = startDrill(options);
    drill.tickTo(after);
    await drill.click(first);
    drill.clickRightBeforeTick(last);
    drill.tickTo(after + 4);
    const observed = tilesAndAttacks(drill, after + 1, after + 4);
    drill.dispose();

    expect(observed).toEqual({ tiles, attacks });
  });

  test("guard: a click after a tick has run changes nothing until the next tick, which runs it", async () => {
    const drill = startDrill({ seed: 1, selection: { focus: "transition-attacks" } });
    drill.tickTo(30);
    await drill.click({ x: 8, y: 3 });
    drill.tickTo(31);
    await drill.click({ x: 3, y: 2 });
    const orderBeforeTheTick = { ...drill.player().destinationLocation };
    drill.tickTo(33);
    const observed = tilesAndAttacks(drill, 31, 33);
    drill.dispose();

    expect({ orderBeforeTheTick, ...observed }).toEqual({
      orderBeforeTheTick: { x: 8, y: 3 },
      tiles: [{ x: 7, y: 2 }, { x: 5, y: 2 }, { x: 3, y: 2 }],
      attacks: [],
    });
  });
});
