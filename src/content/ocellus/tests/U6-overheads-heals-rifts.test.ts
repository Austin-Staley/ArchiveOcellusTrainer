import type { DrillSelection } from "../js/OcellusTimings";
import { startDrill } from "./drill";

const TRANSITIONS = { focus: "transition-attacks", specialSelection: "replay-v2" } as const;

describe("U6 boss overheads, heals and rifts", () => {
  test.each([
    ["slash", 10, "melee", "blocked", 0],
    ["range", 10, "ranged", "passed", 20],
    ["slash", 32, "melee", "blocked", 0],
    ["slash", 33, "melee", "passed", 20],
    ["range", 34, "ranged", "passed", 20],
    ["range", 40, "ranged", "blocked", 0],
    ["slash", 40, "melee", "passed", 20],
  ] as const)("Deflect follows the overhead track, not the floor: a %s hit landing at %i", (attackStyle, at, style, outcome, taken) => {
    const drill = startDrill({ selection: TRANSITIONS });
    drill.tickTo(at - 1);
    drill.hit(drill.player(), drill.boss(), 20, attackStyle);
    drill.tickTo(at);
    const { atBossStep, atPostTick } = drill.row(at).bossHp;
    expect([drill.events("player-hit-judged").map((e) => [e.at, e.style, e.outcome, e.requested]), atBossStep - atPostTick]).toEqual([[[at, style, outcome, 20]], taken]);
    drill.dispose();
  });

  test.each([
    [{}, "blocked"],
    [{ deflect: "block-at-launch" }, "passed"],
    [{ deflect: "none" }, "passed"],
  ] as const)("a ranged hit launched under Soul Split that lands in Deflect Range: %j", (selection: DrillSelection, outcome) => {
    const drill = startDrill({ selection: { ...TRANSITIONS, ...selection } });
    drill.tickTo(37);
    drill.hit(drill.player(), drill.boss(), 20, "range", 2);
    drill.tickTo(39);
    expect(drill.events("player-hit-judged").map((e) => [e.at, e.outcome])).toEqual([[39, outcome]]);
    drill.dispose();
  });
});
