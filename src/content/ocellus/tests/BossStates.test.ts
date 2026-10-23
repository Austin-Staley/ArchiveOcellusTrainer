import { stateContractBreaks } from "../../../../review-ratchet/checks/observable-states.mjs";
import type { BossState } from "../js/P4Types";
import { startDrill } from "./drill";

type Presence = Readonly<{ visible: boolean; targetable: boolean }>;

const PRESENCE = {
  hidden: { visible: false, targetable: false },
  "present-invulnerable": { visible: true, targetable: true },
  "present-out-of-melee-reach": { visible: true, targetable: true },
  "present-damageable": { visible: true, targetable: true },
} satisfies Record<BossState, Presence>;

describe("boss states", () => {
  test("guard: every boss state the fight logs shows its contracted presence: hidden is neither drawn nor targetable, and every present state is both", () => {
    const drill = startDrill();
    const observations = [];
    for (let t = 0; t <= 70; t++) {
      drill.playCorrectlyTo(t);
      const changes = drill.events("boss-state-changed");
      const latest = changes[changes.length - 1];
      if (!latest) continue;
      observations.push({ tick: t, state: latest.state, observed: { visible: drill.region.snapshot()?.boss.visible ?? false, targetable: drill.boss().canBeAttacked() } });
    }
    drill.dispose();
    expect({ reached: [...new Set(observations.map(({ state }) => state))], ...stateContractBreaks(PRESENCE, observations) }).toEqual({
      reached: ["hidden", "present-invulnerable", "present-out-of-melee-reach", "present-damageable"],
      mismatches: [],
      unreached: [],
    });
  });
});
