import type { TickSpan } from "./brands";

export type Style = "melee" | "ranged" | "magic";
export type IncomingStyle = Style | "typeless";

export type HitReceipt = Readonly<{ requested: number; applied: number; beforeHp: number; afterHp: number; prayer: Style | null }>;

/** The amount a hit asks for, read against the target's HP and protection prayer as it lands. */
export type Damage =
  | Readonly<{ kind: "fixed"; amount: number }>
  | Readonly<{ kind: "fraction-current-hp"; divisor: number }>
  | Readonly<{ kind: "by-prayer"; style: Style; protectedAmount: number; unprotectedAmount: number }>;

export function cutAttackDelay(delay: number, by: TickSpan): number {
  return Math.max(Math.min(delay, 0), delay - by);
}
