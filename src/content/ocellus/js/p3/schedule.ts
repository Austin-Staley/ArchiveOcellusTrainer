import { OCELLUS_P3 } from "../OcellusTimings";
import { tick } from "../../../../sim/brands";
import type { Script, Slot } from "../../../../sim/schedule";
import { Schedule, slotTable } from "../../../../sim/schedule";
import type { P3Beat, P3Phase, P3Stage, Quadrant } from "../P3Types";

export type P3Schedule = Schedule<P3Stage, P3Phase, P3Beat, never>;

const QUADRANTS: readonly Quadrant[] = [1, 2, 3];

const slot = (stage: P3Stage, ...beats: readonly P3Beat[]): Slot<P3Phase, P3Beat> => {
  const phase: P3Phase = { stage };
  return { phase: () => phase, beats: beats.map((beat) => () => beat) };
};

function autosTable(): readonly Slot<P3Phase, P3Beat>[] {
  return OCELLUS_P3.autos.value.flatMap(({ attack, next }) => {
    if (next < 1) throw new RangeError(`an auto-attack needs at least 1 tick before the next, not ${next}`);
    const beat: P3Beat = attack === "melee" ? { kind: "reach-attack" } : { kind: "wave-cast" };
    return [slot("autos", beat), ...Array.from({ length: next - 1 }, () => slot("autos"))];
  });
}

export function compileP3Schedule(): P3Schedule {
  const { firstAttackAfterStart, thresholds } = OCELLUS_P3;
  const arrive = Array.from({ length: firstAttackAfterStart.value }, () => slot("arrive"));
  const script: Script<P3Stage, P3Phase, P3Beat> = {
    first: "arrive",
    stages: {
      arrive: { slots: slotTable(arrive, "arrive"), breakable: true, then: () => "autos" },
      autos: { slots: slotTable(autosTable(), "autos"), breakable: true, then: () => "autos" },
      destroy: { slots: [slot("destroy", { kind: "quadrant-cleared" })], breakable: false, then: () => "destroy" },
    },
    breakpoints: QUADRANTS.map((quadrant) => ({ atOrBelow: thresholds.value[quadrant], enter: "destroy" })),
  };
  return new Schedule<P3Stage, P3Phase, P3Beat, never>(script, () => null, { kind: "full-fight" }, { kind: "cycle-start" }, tick(0));
}
