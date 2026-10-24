import type { Cycle, Tick, TickSpan } from "./brands";
import { cycle, tick } from "./brands";

export type Moment<P, B> = Readonly<{ tick: Tick; phase: P; beats: readonly B[] }>;
export type BeatAt<B> = (cycleNumber: Cycle, cycleStart: Tick) => B | null;
export type Slot<P, B> = Readonly<{ phase: (cycleNumber: Cycle) => P; beats: readonly BeatAt<B>[] }>;

export type Focus<M extends string> = Readonly<{ kind: "full-fight" }> | Readonly<{ kind: "drill"; mechanics: readonly [M, ...M[]] }>;
export type DrillStart = Readonly<{ kind: "before-first-beat"; lead: TickSpan }> | Readonly<{ kind: "cycle-start" }>;

/**
 * A fixed lead-in, then one cycle of slots repeated forever. A beat whose mechanic is outside the
 * focus is dropped; a beat with no mechanic always plays.
 */
export class Schedule<P, B, M extends string> {
  readonly start: Tick;

  constructor(
    private readonly leadIn: readonly Moment<P, B>[],
    private readonly slots: readonly Slot<P, B>[],
    private readonly mechanicOf: (beat: B) => M | null,
    private readonly focus: Focus<M>,
    drillStart: DrillStart,
    horizon: Tick,
  ) {
    this.start = this.startTick(drillStart, horizon);
  }

  private startTick(drillStart: DrillStart, horizon: Tick): Tick {
    if (this.focus.kind === "full-fight") return tick(0);
    switch (drillStart.kind) {
      case "cycle-start":
        return tick(0);
      case "before-first-beat": {
        for (let t = 0; t < horizon; t++) {
          if (this.at(tick(t)).beats.some((beat) => this.mechanicOf(beat) !== null)) return tick(Math.max(0, t - drillStart.lead));
        }
        return tick(0);
      }
      default: {
        const unhandled: never = drillStart;
        return unhandled;
      }
    }
  }

  acts(mechanic: M): boolean {
    return this.focus.kind === "full-fight" || this.focus.mechanics.includes(mechanic);
  }

  at(t: Tick): Moment<P, B> {
    if (t < this.leadIn.length) return this.leadIn[t];
    const sinceLeadIn = t - this.leadIn.length;
    const offset = sinceLeadIn % this.slots.length;
    const cycleNumber = cycle(Math.floor(sinceLeadIn / this.slots.length) + 1);
    const cycleStart = tick(t - offset);
    const slot = this.slots[offset];
    const beats = slot.beats.flatMap((beat) => beat(cycleNumber, cycleStart) ?? []).filter((beat) => {
      const mechanic = this.mechanicOf(beat);
      return mechanic === null || this.acts(mechanic);
    });
    return { tick: t, phase: slot.phase(cycleNumber), beats };
  }
}
