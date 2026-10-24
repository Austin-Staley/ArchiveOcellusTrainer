export type Style = "melee" | "ranged" | "magic";
export type IncomingStyle = Style | "typeless";

export type HitReceipt = Readonly<{ requested: number; applied: number; beforeHp: number; afterHp: number; prayer: Style | null }>;
