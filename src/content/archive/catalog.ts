import type { Seed } from "../../sim/brands";
import { seed } from "../../sim/brands";

export type RaidOptions = Readonly<{
  seed: Seed;
  guardianEnragePercent: 33 | 30;
  guardianBeamDelay: 10 | 12;
  ezekielEnragePercent: 33 | 23;
  swordCrossesBoss: boolean;
  smorkDefence: 220 | 150;
  moiaHp: 1900 | 785;
  p2BeamMax: 27 | 50;
  p2Floors: 3 | 2;
  bladeHp: 1000 | 2500;
}>;

export const RAID_IDS = ["bork", "ezekiel", "guardian", "moia", "xarth", "dagonhai", "ocellus-p1", "ocellus-p2", "ocellus-p3"] as const;
export type RaidId = (typeof RAID_IDS)[number];

export type GearPlan = "ranged" | "melee";

/** P1 is ranged and P2 is crush, as requested. The other rooms follow the captured top weapon, and phase 3 follows the crush tank note. */
export function defaultGear(id: RaidId): GearPlan {
  switch (id) {
    case "ezekiel":
    case "ocellus-p2":
    case "ocellus-p3":
      return "melee";
    case "bork":
    case "guardian":
    case "moia":
    case "xarth":
    case "dagonhai":
    case "ocellus-p1":
      return "ranged";
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

export function isRaidId(value: string): value is RaidId {
  switch (value) {
    case "bork":
    case "ezekiel":
    case "guardian":
    case "moia":
    case "xarth":
    case "dagonhai":
    case "ocellus-p1":
    case "ocellus-p2":
    case "ocellus-p3":
      return true;
    default:
      return false;
  }
}

export function encounterName(id: RaidId | "ocellus-p4"): string {
  switch (id) {
    case "ocellus-p4":
      return "Ocellus phase 4";
    case "ocellus-p1":
      return "Ocellus phase 1";
    case "ocellus-p2":
      return "Ocellus phase 2";
    case "ocellus-p3":
      return "Ocellus phase 3";
    case "bork":
      return "Bork";
    case "ezekiel":
      return "Ezekiel";
    case "guardian":
      return "Archive Guardian";
    case "moia":
      return "Moia";
    case "xarth":
      return "Xarth";
    case "dagonhai":
      return "Dagon'hai trio";
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

export const ENCOUNTERS: readonly Readonly<{ id: RaidId | "ocellus-p4"; label: string }>[] = [
  { id: "ocellus-p4", label: encounterName("ocellus-p4") },
  { id: "ocellus-p1", label: encounterName("ocellus-p1") },
  { id: "ocellus-p2", label: encounterName("ocellus-p2") },
  { id: "ocellus-p3", label: encounterName("ocellus-p3") },
  { id: "bork", label: encounterName("bork") },
  { id: "ezekiel", label: encounterName("ezekiel") },
  { id: "guardian", label: encounterName("guardian") },
  { id: "moia", label: encounterName("moia") },
  { id: "xarth", label: encounterName("xarth") },
  { id: "dagonhai", label: encounterName("dagonhai") },
];

/** Upstream fight-log drills. They open with `?phase=`, beside the fork's own rooms. */
export const DRILL_ROOMS = [
  { id: "drill-p1", phase: "p1", label: "Ocellus P1 drill (upstream logs)" },
  { id: "drill-p2", phase: "p2", label: "Ocellus P2 drill (upstream logs)" },
  { id: "drill-p3", phase: "p3", label: "Ocellus P3 Q1 drill (upstream logs)" },
] as const;

export type DrillRoomId = (typeof DRILL_ROOMS)[number]["id"];
export type DrillRoomPhase = (typeof DRILL_ROOMS)[number]["phase"];

export function isDrillRoomId(value: string): value is DrillRoomId {
  switch (value) {
    case "drill-p1":
    case "drill-p2":
    case "drill-p3":
      return true;
    default:
      return false;
  }
}

export function drillRoomPhase(id: DrillRoomId): DrillRoomPhase {
  switch (id) {
    case "drill-p1":
      return "p1";
    case "drill-p2":
      return "p2";
    case "drill-p3":
      return "p3";
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

const KNOWN = ["encounter", "seed", "invincible", "bosshp", "enrage", "beam", "ezenrage", "sword", "smorkdef", "moiahp", "p2beam", "p2floors", "bladehp", "gear"];

export type RaidLaunch = Readonly<{
  id: RaidId;
  options: RaidOptions;
  gear: GearPlan;
  invincible: boolean;
  bossHp: number | null;
  rejected: readonly string[];
}>;

function readSeed(url: URL, freshSeed: () => number, rejected: string[]): Seed {
  const raw = url.searchParams.get("seed");
  const parsed = raw !== null && /^\d{1,10}$/.test(raw) && Number(raw) <= 0xffffffff ? Number(raw) : null;
  if (raw !== null && parsed === null) rejected.push(`seed=${raw}`);
  return seed(parsed ?? freshSeed());
}

export function defaultOptions(runSeed: Seed): RaidOptions {
  return {
    seed: runSeed,
    guardianEnragePercent: 33,
    guardianBeamDelay: 10,
    ezekielEnragePercent: 33,
    swordCrossesBoss: true,
    smorkDefence: 220,
    moiaHp: 1900,
    p2BeamMax: 27,
    p2Floors: 3,
    bladeHp: 1000,
  };
}

export function parseRaid(url: URL, id: RaidId, freshSeed: () => number): RaidLaunch {
  const rejected: string[] = [];
  for (const [key, value] of url.searchParams) {
    if (!KNOWN.includes(key)) rejected.push(`${key}=${value}`);
  }
  const base = defaultOptions(readSeed(url, freshSeed, rejected));
  const enrage = url.searchParams.get("enrage");
  const beam = url.searchParams.get("beam");
  const ezenrage = url.searchParams.get("ezenrage");
  const sword = url.searchParams.get("sword");
  const smorkdef = url.searchParams.get("smorkdef");
  const moiahp = url.searchParams.get("moiahp");
  const p2beam = url.searchParams.get("p2beam");
  const p2floors = url.searchParams.get("p2floors");
  const bladehp = url.searchParams.get("bladehp");
  const options: RaidOptions = {
    ...base,
    guardianEnragePercent: enrage === "30" ? 30 : 33,
    guardianBeamDelay: beam === "12" ? 12 : 10,
    ezekielEnragePercent: ezenrage === "23" ? 23 : 33,
    swordCrossesBoss: sword !== "heal",
    smorkDefence: smorkdef === "150" ? 150 : 220,
    moiaHp: moiahp === "785" ? 785 : 1900,
    p2BeamMax: p2beam === "50" ? 50 : 27,
    p2Floors: p2floors === "2" ? 2 : 3,
    bladeHp: bladehp === "2500" ? 2500 : 1000,
  };
  if (enrage !== null && enrage !== "30" && enrage !== "33") rejected.push(`enrage=${enrage}`);
  if (beam !== null && beam !== "12" && beam !== "10") rejected.push(`beam=${beam}`);
  if (ezenrage !== null && ezenrage !== "23" && ezenrage !== "33") rejected.push(`ezenrage=${ezenrage}`);
  if (sword !== null && sword !== "heal" && sword !== "cross") rejected.push(`sword=${sword}`);
  if (smorkdef !== null && smorkdef !== "150" && smorkdef !== "220") rejected.push(`smorkdef=${smorkdef}`);
  if (moiahp !== null && moiahp !== "785" && moiahp !== "1900") rejected.push(`moiahp=${moiahp}`);
  if (p2beam !== null && p2beam !== "50" && p2beam !== "27") rejected.push(`p2beam=${p2beam}`);
  if (p2floors !== null && p2floors !== "2" && p2floors !== "3") rejected.push(`p2floors=${p2floors}`);
  if (bladehp !== null && bladehp !== "2500" && bladehp !== "1000") rejected.push(`bladehp=${bladehp}`);
  const gearRaw = url.searchParams.get("gear");
  const gear = gearRaw === "ranged" || gearRaw === "melee" ? gearRaw : defaultGear(id);
  if (gearRaw !== null && gearRaw !== "ranged" && gearRaw !== "melee") rejected.push(`gear=${gearRaw}`);
  const rawHp = url.searchParams.get("bosshp");
  const bossHp = rawHp !== null && /^\d{1,6}$/.test(rawHp) ? Number(rawHp) : null;
  if (rawHp !== null && bossHp === null) rejected.push(`bosshp=${rawHp}`);
  const invincible = url.searchParams.get("invincible");
  if (invincible !== null && invincible !== "on") rejected.push(`invincible=${invincible}`);
  return { id, options, gear, invincible: invincible === "on", bossHp, rejected };
}
