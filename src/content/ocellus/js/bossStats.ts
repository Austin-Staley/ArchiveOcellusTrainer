import type { UnitBonuses, UnitStats } from "osrs-sdk";
import { OCELLUS_P4 } from "./OcellusTimings";

function sdkRangedDefence(): number {
  const ranged = OCELLUS_P4.boss.rangedDefence.value;
  const [first, ...rest] = Object.values(OCELLUS_P4.gear.ammunition.value).map((ammunition) => ranged[ammunition]);
  if (rest.some((value) => value !== first)) throw new Error("the trainer's ammunition classes roll against different ranged defences, and the SDK holds one");
  return first;
}

const DEFENCE_BONUSES = { ...OCELLUS_P4.boss.defenceBonuses.value, range: sdkRangedDefence() };

export function bossBonuses(): UnitBonuses {
  return {
    attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
    defence: DEFENCE_BONUSES,
    other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
  };
}

export function withDefenceFloor(stats: UnitStats, lowest: number): UnitStats {
  let defence = stats.defence;
  return {
    ...stats,
    get defence() {
      return defence;
    },
    set defence(value: number) {
      defence = Math.max(lowest, value);
    },
  };
}
