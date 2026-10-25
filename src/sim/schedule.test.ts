import { hpFraction, tick } from "./brands";
import type { Breakpoint, Script, Slot, Stage } from "./schedule";
import { Schedule, slotTable } from "./schedule";

const named = (name: string): Slot<string, string> => ({ phase: (visit) => `${name} #${visit}`, beats: [(visit, start) => `${name} of visit ${visit} from ${start}`] });
const stage = <S extends string>(name: string, length: number, breakable: boolean, then: Stage<S, string, string>["then"]): Stage<S, string, string> => ({
  slots: slotTable(Array.from({ length }, (_, offset) => named(`${name}-${offset}`)), name),
  breakable,
  then,
});
const schedule = <S extends string>(script: Script<S, string, string>) => new Schedule(script, () => null, { kind: "full-fight" }, { kind: "cycle-start" }, tick(0));
const ticks = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => tick(from + offset));

describe("a schedule of named stages", () => {
  test("a two-stage script reads each table from the tick its stage is entered, across the table's end", () => {
    type LeadAndCycle = "lead-in" | "cycle";
    const leadAndCycle = schedule<LeadAndCycle>({
      first: "lead-in",
      stages: { "lead-in": stage<LeadAndCycle>("lead-in", 2, false, () => "cycle"), cycle: stage<LeadAndCycle>("cycle", 3, false, () => "cycle") },
      breakpoints: [],
    });

    expect(ticks(0, 7).map((t) => leadAndCycle.at(t))).toEqual([
      { tick: 0, phase: "lead-in-0 #1", beats: ["lead-in-0 of visit 1 from 0"] },
      { tick: 1, phase: "lead-in-1 #1", beats: ["lead-in-1 of visit 1 from 0"] },
      { tick: 2, phase: "cycle-0 #1", beats: ["cycle-0 of visit 1 from 2"] },
      { tick: 3, phase: "cycle-1 #1", beats: ["cycle-1 of visit 1 from 2"] },
      { tick: 4, phase: "cycle-2 #1", beats: ["cycle-2 of visit 1 from 2"] },
      { tick: 5, phase: "cycle-0 #2", beats: ["cycle-0 of visit 2 from 5"] },
      { tick: 6, phase: "cycle-1 #2", beats: ["cycle-1 of visit 2 from 5"] },
      { tick: 7, phase: "cycle-2 #2", beats: ["cycle-2 of visit 2 from 5"] },
    ]);
  });

  test("a stage's successor reads the visits before the one that ended", () => {
    type Rotation = "autos" | "smite" | "untether";
    const alternating = schedule<Rotation>({
      first: "autos",
      stages: {
        autos: stage<Rotation>("autos", 2, true, (_, before) => (before.some((visit) => visit.stage === "autos") ? "untether" : "smite")),
        smite: stage<Rotation>("smite", 1, true, () => "autos"),
        untether: stage<Rotation>("untether", 1, true, () => "autos"),
      },
      breakpoints: [],
    });

    expect(ticks(0, 8).map((t) => alternating.visitAt(t))).toEqual([
      { stage: "autos", start: 0, number: 1, entered: "first" },
      { stage: "autos", start: 0, number: 1, entered: "first" },
      { stage: "smite", start: 2, number: 1, entered: "table-ended" },
      { stage: "autos", start: 3, number: 2, entered: "table-ended" },
      { stage: "autos", start: 3, number: 2, entered: "table-ended" },
      { stage: "untether", start: 5, number: 1, entered: "table-ended" },
      { stage: "autos", start: 6, number: 3, entered: "table-ended" },
      { stage: "autos", start: 6, number: 3, entered: "table-ended" },
      { stage: "untether", start: 8, number: 2, entered: "table-ended" },
    ]);
  });
});

describe("HP breakpoints", () => {
  type Quadrant = "fight" | "destroy" | "q2" | "q3";
  const stages = (): Script<Quadrant, string, string>["stages"] => ({
    fight: stage<Quadrant>("fight", 4, true, () => "fight"),
    destroy: stage<Quadrant>("destroy", 2, false, () => "fight"),
    q2: stage<Quadrant>("q2", 4, true, () => "q2"),
    q3: stage<Quadrant>("q3", 4, true, () => "q3"),
  });
  const run = (breakpoints: readonly Breakpoint<Quadrant>[], first: Quadrant, hpByTick: readonly number[]) =>
    hpByTick.reduce((advanced, hp, t) => advanced.advance(tick(t), { hp, maxHp: 101 }), schedule({ first, stages: stages(), breakpoints }));

  test("a 0.5 breakpoint fires on the tick HP reaches ⌊101 × 0.5⌋ = 50, and not at 51", () => {
    const at51 = run([{ atOrBelow: hpFraction(0.5), enter: "destroy" }], "fight", [101, 51]);
    const at50 = at51.advance(tick(2), { hp: 50, maxHp: 101 });

    expect(at51.visitAt(tick(2))).toEqual({ stage: "fight", start: 0, number: 1, entered: "first" });
    expect(ticks(1, 4).map((t) => at50.visitAt(t))).toEqual([
      { stage: "fight", start: 0, number: 1, entered: "first" },
      { stage: "destroy", start: 2, number: 1, entered: "breakpoint" },
      { stage: "destroy", start: 2, number: 1, entered: "breakpoint" },
      { stage: "fight", start: 4, number: 2, entered: "table-ended" },
    ]);
    expect(at50.at(tick(2))).toEqual({ tick: 2, phase: "destroy-0 #1", beats: ["destroy-0 of visit 1 from 2"] });
    expect(ticks(1, 2).map((t) => at50.breakpointsFiredBy(t))).toEqual([0, 1]);
  });

  test("a breakpoint reached during an unbreakable stage fires on the first breakable tick", () => {
    const fired = run(
      [
        { atOrBelow: hpFraction(0.75), enter: "destroy" },
        { atOrBelow: hpFraction(0.5), enter: "destroy" },
      ],
      "fight",
      [101, 40, 40, 40, 40],
    );

    expect(ticks(1, 4).map((t) => fired.visitAt(t))).toEqual([
      { stage: "destroy", start: 1, number: 1, entered: "breakpoint" },
      { stage: "destroy", start: 1, number: 1, entered: "breakpoint" },
      { stage: "destroy", start: 3, number: 2, entered: "breakpoint" },
      { stage: "destroy", start: 3, number: 2, entered: "breakpoint" },
    ]);
    expect(ticks(1, 4).map((t) => fired.breakpointsFiredBy(t))).toEqual([1, 1, 2, 2]);
  });

  test("each breakpoint fires once, in order, one a tick", () => {
    const fired = run(
      [
        { atOrBelow: hpFraction(0.75), enter: "q2" },
        { atOrBelow: hpFraction(0.5), enter: "q3" },
      ],
      "fight",
      [101, 40, 40, 40, 40, 40],
    );

    expect(ticks(0, 5).map((t) => fired.visitAt(t).stage)).toEqual(["fight", "q2", "q3", "q3", "q3", "q3"]);
    expect(fired.visitAt(tick(5))).toEqual({ stage: "q3", start: 2, number: 1, entered: "breakpoint" });
    expect(ticks(0, 5).map((t) => fired.breakpointsFiredBy(t))).toEqual([0, 1, 2, 2, 2, 2]);
  });
});
