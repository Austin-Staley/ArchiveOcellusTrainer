import type { At } from "./drill";
import { RING_NORTH, SPAWN_ON_FLOOD, UNDER_BOSS, startDrill } from "./drill";

type Drill = ReturnType<typeof startDrill>;

const INNER_MARKS = [17, 19, 21, 23, 25, 27] as const;
const OUTER_MARKS = [48, 50, 52, 54, 56, 58] as const;
const BESIDE_RING_NORTH: At = { x: 6, y: 3 };
const BESIDE_SPAWN: At = { x: 6, y: 1 };
const TWO_EAST_OF_SPAWN: At = { x: 7, y: 1 };
const RALOS = 28922;

async function attackFrom(setup: "melee" | "ranged", home: At, weapon: "worn" | "ralos" = "worn"): Promise<Drill> {
  const drill = startDrill({ selection: { focus: "explosions", setup } });
  await drill.click(home);
  drill.tickTo(12);
  if (weapon === "ralos") drill.clickInventory(RALOS);
  await drill.click(UNDER_BOSS);
  return drill;
}

async function stepOnEachMark(drill: Drill, marks: readonly number[], home: At, side: At): Promise<void> {
  for (const [i, mark] of marks.entries()) {
    drill.tickTo(mark - 1);
    await drill.click(i % 2 === 0 ? side : home);
    drill.tickTo(mark);
    await drill.click(UNDER_BOSS);
  }
}

const attackTicks = (drill: Drill) => drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick);
const outcomes = (drill: Drill) =>
  drill.events("explosion-resolved").map((e) => [e.at, e.outcome.kind === "dodged" ? [e.outcome.attackDelay.before, e.outcome.attackDelay.after] : e.outcome.kind]);

describe("U4 a one-tile dodge on the mark tick cuts the attack delay by 3", () => {
  test("guard: the Scythe swings every 2 ticks while each outer mark is dodged, and every 5 before and after the series", async () => {
    const drill = await attackFrom("melee", RING_NORTH);
    await stepOnEachMark(drill, INNER_MARKS, RING_NORTH, BESIDE_RING_NORTH);
    await stepOnEachMark(drill, OUTER_MARKS, RING_NORTH, BESIDE_RING_NORTH);
    drill.tickTo(66);
    expect(attackTicks(drill)).toEqual([30, 35, 40, 45, 49, 51, 53, 55, 57, 59, 64]);
    expect(outcomes(drill).slice(6)).toEqual([[49, [2, 0]], [51, [4, 1]], [53, [4, 1]], [55, [4, 1]], [57, [4, 1]], [59, [4, 1]]]);
    drill.dispose();
  });

  test("guard: the Twisted bow shoots every 2 ticks while each inner mark is dodged, and every 5 after the series", async () => {
    const drill = await attackFrom("ranged", SPAWN_ON_FLOOD);
    await stepOnEachMark(drill, INNER_MARKS, SPAWN_ON_FLOOD, BESIDE_SPAWN);
    drill.tickTo(40);
    expect(attackTicks(drill)).toEqual([13, 18, 20, 22, 24, 26, 28, 33, 38]);
    expect(outcomes(drill)).toEqual([[18, [1, 0]], [20, [4, 1]], [22, [4, 1]], [24, [4, 1]], [26, [4, 1]], [28, [4, 1]]]);
    drill.dispose();
  });

  test.each([
    { dodge: "standing on every mark", steps: [], attacks: [13, 18, 23, 28, 33, 38], outcome: "hit" },
    { dodge: "a two-tile run off each mark", steps: INNER_MARKS, attacks: [13, 18, 24, 29, 34, 39], outcome: "avoided" },
  ] as const)("guard: $dodge leaves the Twisted bow on 5-tick gaps or slower", async ({ steps, attacks, outcome }) => {
    const drill = await attackFrom("ranged", SPAWN_ON_FLOOD);
    await stepOnEachMark(drill, steps, SPAWN_ON_FLOOD, TWO_EAST_OF_SPAWN);
    drill.tickTo(40);
    expect([attackTicks(drill), outcomes(drill)]).toEqual([attacks, INNER_MARKS.map((mark) => [mark + 1, outcome])]);
    drill.dispose();
  });

  test("guard: a 6-tick Ralos on Rapid speeds up to 3- and 4-tick gaps but never 2", async () => {
    const drill = await attackFrom("ranged", SPAWN_ON_FLOOD, "ralos");
    await stepOnEachMark(drill, INNER_MARKS, SPAWN_ON_FLOOD, BESIDE_SPAWN);
    drill.tickTo(40);
    expect(attackTicks(drill)).toEqual([13, 18, 22, 26, 29, 35]);
    drill.dispose();
  });
});
