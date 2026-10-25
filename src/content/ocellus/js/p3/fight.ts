import { OCELLUS_P3 } from "../OcellusTimings";
import type { Seed, Tick } from "../../../../sim/brands";
import type { BossHp } from "../../../../sim/schedule";
import type { HitRequest, Logged } from "../../../../sim/sdk/EncounterBinding";
import type { P3Beat, P3End, P3Event, P3Hit } from "../P3Types";
import type { PlayerObservation } from "../P4Types";
import { rollInt } from "../roll";
import type { P3Schedule } from "./schedule";
import { compileP3Schedule } from "./schedule";

export type P3Fight = Readonly<{ schedule: P3Schedule }>;
export type Reach = "in-reach" | "out-of-reach";

export type TurnFacts = Readonly<{ at: Tick; player: PlayerObservation; boss: BossHp & Readonly<{ reach: Reach }> }>;

export type TurnOutput = Logged<P3Event> | HitRequest<P3Hit>;
export type TurnStep = Readonly<{ fight: P3Fight; outputs: readonly TurnOutput[]; ending: P3End | null }>;
type Reaction = Readonly<{ outputs: readonly TurnOutput[]; ending: P3End | null }>;

const logged = (event: P3Event): Logged<P3Event> => ({ kind: "event", event });

export function startFight(): P3Fight {
  return { schedule: compileP3Schedule() };
}

function autoAttack(seed: Seed, at: Tick, reach: Reach): HitRequest<P3Hit> {
  switch (reach) {
    case "in-reach": {
      const { protectedDamage, unprotectedDamage } = OCELLUS_P3.swing;
      return {
        kind: "hit",
        damage: { kind: "by-prayer", style: "melee", protectedAmount: rollInt(seed, "swingDamage", at, protectedDamage.value, 0), unprotectedAmount: rollInt(seed, "swingDamage", at, unprotectedDamage.value, 0) },
        cause: { kind: "swing", at },
      };
    }
    case "out-of-reach":
      return { kind: "hit", damage: { kind: "fixed", amount: rollInt(seed, "swingDamage", at, OCELLUS_P3.voidShot.value, 0) }, cause: { kind: "void-shot", at } };
    default: {
      const unhandled: never = reach;
      return unhandled;
    }
  }
}

function react(seed: Seed, beat: P3Beat, facts: TurnFacts): Reaction {
  const { at } = facts;
  switch (beat.kind) {
    case "reach-attack":
      return { outputs: [autoAttack(seed, at, facts.boss.reach)], ending: null };
    case "wave-cast":
      return { outputs: [logged({ kind: "wave-cast", at, toward: facts.player.tile })], ending: null };
    case "quadrant-cleared": {
      const reason: P3End = { kind: "quadrant-cleared" };
      return { outputs: [logged({ kind: "run-ended", at, reason })], ending: reason };
    }
    default: {
      const unhandled: never = beat;
      return unhandled;
    }
  }
}

export function turn(seed: Seed, fight: P3Fight, facts: TurnFacts): TurnStep {
  const schedule = fight.schedule.advance(facts.at, facts.boss);
  const visit = schedule.visitAt(facts.at);
  const entered = visit.start === facts.at ? [logged({ kind: "stage-entered", at: facts.at, stage: visit.stage })] : [];
  const reactions = schedule.at(facts.at).beats.map((beat) => react(seed, beat, facts));
  return {
    fight: { schedule },
    outputs: [...entered, ...reactions.flatMap((reaction) => reaction.outputs)],
    ending: reactions.find((reaction) => reaction.ending !== null)?.ending ?? null,
  };
}
