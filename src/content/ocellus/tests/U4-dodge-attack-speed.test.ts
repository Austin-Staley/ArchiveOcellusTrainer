import type { At } from "./drill";
import { RING_NORTH, SPAWN_ON_FLOOD, startDrill } from "./drill";

type Drill = ReturnType<typeof startDrill>;

const INNER_MARKS = [17, 19, 21, 23, 25, 27] as const;
const OUTER_MARKS = [48, 50, 52, 54, 56, 58] as const;
const BESIDE_RING_NORTH: At = { x: 6, y: 3 };
const BESIDE_SPAWN: At = { x: 6, y: 1 };
const TWO_EAST_OF_SPAWN: At = { x: 7, y: 1 };
const RALOS = 28922;

function attackFrom(setup: "melee" | "ranged", home: At, weapon: "worn" | "ralos" = "worn"): Drill {
  const drill = startDrill({ selection: { focus: "explosions", setup } });
  drill.walkTo(home);
  drill.tickTo(12);
  if (weapon === "ralos") drill.clickInventory(RALOS);
  drill.player().setAggro(drill.boss());
  return drill;
}

function stepOnEachMark(drill: Drill, marks: readonly number[], home: At, side: At): void {
  marks.forEach((mark, i) => {
    drill.tickTo(mark - 1);
    drill.walkTo(i % 2 === 0 ? side : home);
    drill.tickTo(mark);
    drill.player().setAggro(drill.boss());
  });
}

const attackTicks = (drill: Drill) => drill.rows().filter((row) => row.combatDraws > 0).map((row) => row.tick);
const outcomes = (drill: Drill) =>
  drill.events("explosion-resolved").map((e) => [e.at, e.outcome.kind === "dodged" ? [e.outcome.attackDelay.before, e.outcome.attackDelay.after] : e.outcome.kind]);

describe("U4 a one-tile dodge on the mark tick cuts the attack delay by 3", () => {
  test("the Scythe swings every 2 ticks while each outer mark is dodged, and every 5 before and after the series", () => {
    const drill = attackFrom("melee", RING_NORTH);
    stepOnEachMark(drill, INNER_MARKS, RING_NORTH, BESIDE_RING_NORTH);
    stepOnEachMark(drill, OUTER_MARKS, RING_NORTH, BESIDE_RING_NORTH);
    drill.tickTo(66);
    expect(attackTicks(drill)).toEqual([30, 35, 40, 45, 49, 51, 53, 55, 57, 59, 64]);
    expect(outcomes(drill).slice(6)).toEqual([[49, [2, 0]], [51, [4, 1]], [53, [4, 1]], [55, [4, 1]], [57, [4, 1]], [59, [4, 1]]]);
    drill.dispose();
  });

  test("the Twisted bow shoots every 2 ticks while each inner mark is dodged, and every 5 after the series", () => {
    const drill = attackFrom("ranged", SPAWN_ON_FLOOD);
    stepOnEachMark(drill, INNER_MARKS, SPAWN_ON_FLOOD, BESIDE_SPAWN);
    drill.tickTo(40);
    expect(attackTicks(drill)).toEqual([13, 18, 20, 22, 24, 26, 28, 33, 38]);
    expect(outcomes(drill)).toEqual([[18, [1, 0]], [20, [4, 1]], [22, [4, 1]], [24, [4, 1]], [26, [4, 1]], [28, [4, 1]]]);
    drill.dispose();
  });

  test.each([
    { dodge: "standing on every mark", steps: [], attacks: [13, 18, 23, 28, 33, 38], outcome: "hit" },
    { dodge: "a two-tile run off each mark", steps: INNER_MARKS, attacks: [13, 18, 24, 29, 34, 39], outcome: "avoided" },
  ] as const)("guard: $dodge leaves the Twisted bow on 5-tick gaps or slower", ({ steps, attacks, outcome }) => {
    const drill = attackFrom("ranged", SPAWN_ON_FLOOD);
    stepOnEachMark(drill, steps, SPAWN_ON_FLOOD, TWO_EAST_OF_SPAWN);
    drill.tickTo(40);
    expect([attackTicks(drill), outcomes(drill)]).toEqual([attacks, INNER_MARKS.map((mark) => [mark + 1, outcome])]);
    drill.dispose();
  });

  test("a 6-tick Ralos on Rapid speeds up to 3- and 4-tick gaps but never 2", () => {
    const drill = attackFrom("ranged", SPAWN_ON_FLOOD, "ralos");
    stepOnEachMark(drill, INNER_MARKS, SPAWN_ON_FLOOD, BESIDE_SPAWN);
    drill.tickTo(40);
    expect(attackTicks(drill)).toEqual([13, 18, 22, 26, 29, 35]);
    drill.dispose();
  });
});
