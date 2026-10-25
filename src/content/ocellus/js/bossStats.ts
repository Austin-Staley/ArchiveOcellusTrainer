import type { UnitStats } from "osrs-sdk";

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
