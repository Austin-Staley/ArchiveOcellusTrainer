import type { Cycle, HpFraction, Tick, TickSpan } from "./brands";
import { cycle, tick } from "./brands";

export type Moment<P, B> = Readonly<{ tick: Tick; phase: P; beats: readonly B[] }>;
export type BeatAt<B> = (visitNumber: Cycle, visitStart: Tick) => B | null;
export type Slot<P, B> = Readonly<{ phase: (visitNumber: Cycle) => P; beats: readonly BeatAt<B>[] }>;

export type Focus<M extends string> = Readonly<{ kind: "full-fight" }> | Readonly<{ kind: "drill"; mechanics: readonly [M, ...M[]] }>;
export type DrillStart = Readonly<{ kind: "before-first-beat"; lead: TickSpan }> | Readonly<{ kind: "cycle-start" }>;

export type Visit<S extends string> = Readonly<{ stage: S; start: Tick; number: Cycle; entered: "first" | "table-ended" | "breakpoint" }>;

export type Stage<S extends string, P, B> = Readonly<{
  slots: readonly [Slot<P, B>, ...Slot<P, B>[]];
  breakable: boolean;
  then: (ended: Visit<S>, before: readonly Visit<S>[]) => S;
}>;

export type Breakpoint<S extends string> = Readonly<{ atOrBelow: HpFraction; enter: S }>;

export type Script<S extends string, P, B> = Readonly<{
  first: S;
  stages: Readonly<Record<S, Stage<S, P, B>>>;
  breakpoints: readonly Breakpoint<S>[];
}>;

export type BossHp = Readonly<{ hp: number; maxHp: number }>;

export function slotTable<P, B>(slots: readonly Slot<P, B>[], stage: string): readonly [Slot<P, B>, ...Slot<P, B>[]] {
  if (slots.length === 0) throw new RangeError(`the ${stage} stage has an empty table`);
  return [slots[0], ...slots.slice(1)];
}

class Visits<S extends string, P, B> {
  private readonly listed: Visit<S>[];

  constructor(private readonly script: Script<S, P, B>, decided: readonly Visit<S>[] = [{ stage: script.first, start: tick(0), number: cycle(1), entered: "first" }]) {
    this.listed = [...decided];
  }

  at(t: Tick): Visit<S> {
    this.extendThrough(t);
    for (let index = this.listed.length - 1; ; index--) {
      if (this.listed[index].start <= t) return this.listed[index];
    }
  }

  firedBefore(t: Tick): number {
    return this.listed.filter((visit) => visit.entered === "breakpoint" && visit.start < t).length;
  }

  cutAt(t: Tick, stage: S): Visits<S, P, B> {
    this.extendThrough(t);
    const kept = this.listed.filter((visit) => visit.start < t);
    return new Visits(this.script, [...kept, this.visit(stage, t, "breakpoint", kept)]);
  }

  private extendThrough(t: Tick): void {
    for (let last = this.listed[this.listed.length - 1]; ; ) {
      const { slots, then } = this.script.stages[last.stage];
      const end = tick(last.start + slots.length);
      if (t < end) return;
      last = this.visit(then(last, this.listed.slice(0, -1)), end, "table-ended");
      this.listed.push(last);
    }
  }

  private visit(stage: S, start: Tick, entered: Visit<S>["entered"], before: readonly Visit<S>[] = this.listed): Visit<S> {
    return { stage, start, number: cycle(before.filter((visit) => visit.stage === stage).length + 1), entered };
  }
}

export class Schedule<S extends string, P, B, M extends string> {
  readonly start: Tick;

  constructor(
    private readonly script: Script<S, P, B>,
    private readonly mechanicOf: (beat: B) => M | null,
    private readonly focus: Focus<M>,
    private readonly drillStart: DrillStart,
    private readonly horizon: Tick,
    private readonly visits: Visits<S, P, B> = new Visits(script),
  ) {
    this.start = this.startTick(new Visits(script));
  }

  private startTick(unadvanced: Visits<S, P, B>): Tick {
    if (this.focus.kind === "full-fight") return tick(0);
    switch (this.drillStart.kind) {
      case "cycle-start":
        return tick(0);
      case "before-first-beat": {
        for (let t = 0; t < this.horizon; t++) {
          if (this.momentIn(unadvanced, tick(t)).beats.some((beat) => this.mechanicOf(beat) !== null)) return tick(Math.max(0, t - this.drillStart.lead));
        }
        return tick(0);
      }
      default: {
        const unhandled: never = this.drillStart;
        return unhandled;
      }
    }
  }

  acts(mechanic: M): boolean {
    return this.focus.kind === "full-fight" || this.focus.mechanics.includes(mechanic);
  }

  at(t: Tick): Moment<P, B> {
    return this.momentIn(this.visits, t);
  }

  visitAt(t: Tick): Visit<S> {
    return this.visits.at(t);
  }

  breakpointsFiredBy(t: Tick): number {
    return this.visits.firedBefore(tick(t + 1));
  }

  advance(t: Tick, boss: BossHp): Schedule<S, P, B, M> {
    const next = this.script.breakpoints[this.visits.firedBefore(t)];
    if (next === undefined || !this.script.stages[this.visitAt(t).stage].breakable || boss.hp > Math.floor(boss.maxHp * next.atOrBelow)) return this;
    return new Schedule(this.script, this.mechanicOf, this.focus, this.drillStart, this.horizon, this.visits.cutAt(t, next.enter));
  }

  private momentIn(visits: Visits<S, P, B>, t: Tick): Moment<P, B> {
    const visit = visits.at(t);
    const slot = this.script.stages[visit.stage].slots[t - visit.start];
    const beats = slot.beats.flatMap((beat) => beat(visit.number, visit.start) ?? []).filter((beat) => {
      const mechanic = this.mechanicOf(beat);
      return mechanic === null || this.acts(mechanic);
    });
    return { tick: t, phase: slot.phase(visit.number), beats };
  }
}
