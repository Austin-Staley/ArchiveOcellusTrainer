import type { Tick, Tile } from "../../sim/brands";
import { tick, tile } from "../../sim/brands";
import type { IncomingStyle, Style } from "../../sim/combat";
import { OCELLUS_P3 } from "../ocellus/js/OcellusTimings";
import type { RaidOptions } from "./catalog";
import type { RaidId } from "./catalog";
import {
  BINDER_STOPS,
  DAGON_PADS,
  DAGON_TRAIL,
  MOIA_STATIONS,
  P1_CENTRE,
  P1_CORNERS,
  PILLAR_SHADOWS,
  PORTAL_PAD,
  ROOMS,
  WAVE_SKIP,
  beamHits,
  centreTendril,
  cornerTendril,
  gapTo,
  quadrantOf,
  sameTile,
  vinesAround,
} from "./layout";
import type { Quadrant } from "./layout";
import { ARCHIVE } from "./timings";

export type { RaidOptions } from "./catalog";

export type RaidInput = Readonly<{
  player: Tile;
  bossHp: number;
  realHp: number;
  addsHp: readonly number[];
  addsAlive: number;
  prayer: Style | null;
  previous: Tile;
}>;

export type RaidEvent =
  | Readonly<{ kind: "attack"; name: string; text: string }>
  | Readonly<{ kind: "damage"; name: string; style: IncomingStyle; protectedAmount: number; unprotectedAmount: number }>
  | Readonly<{ kind: "mark"; tiles: readonly Tile[]; colour: string; text: string; ticks: number }>
  | Readonly<{ kind: "boss-at"; tile: Tile }>
  | Readonly<{ kind: "add-at"; index: number; tile: Tile }>
  | Readonly<{ kind: "phase"; name: string }>
  | Readonly<{ kind: "heal-boss"; amount: number }>
  | Readonly<{ kind: "heal-player"; amount: number }>
  | Readonly<{ kind: "bank-halve" }>
  | Readonly<{ kind: "respawn-adds"; count: number }>
  | Readonly<{ kind: "chat"; text: string }>
  | Readonly<{ kind: "pad"; tile: Tile; next: Tile }>;

export type Stamp = Readonly<{ at: Tick; event: RaidEvent }>;

type Scheduled = Readonly<{ at: number; event: RaidEvent }>;

type BorkMemory = Readonly<{ id: "bork"; nextDrum: number; suppressUntil: number; nextBomb: number; chainTell: number | null; pending: readonly Scheduled[]; wiped: boolean }>;
type EzekielMemory = Readonly<{ id: "ezekiel"; enraged: boolean; marked: Tile; wave: number }>;
type GuardianMemory = Readonly<{ id: "guardian"; form: "flying" | "landing" | "grounded" | "takeoff"; landAt: number; takeoffAt: number; nextAuto: number; nextMushroom: number; nextBeam: number; enraged: boolean; nextVine: number; vineStop: number; pending: readonly Scheduled[] }>;
type MoiaMemory = Readonly<{ id: "moia"; phase: "p1" | "gone" | "p2"; reappear: number; nextChant: number; chants: number; station: number; hopped: number }>;
type XarthMemory = Readonly<{ id: "xarth"; phase: "p1" | "p2" }>;
type DagonMemory = Readonly<{ id: "dagonhai"; stunned: boolean }>;
type P1Memory = Readonly<{ id: "ocellus-p1"; mode: "corner" | "walk" | "centre" | "blast"; since: number; corner: number; meter: number; centres: number; pair: number }>;
type P2Memory = Readonly<{ id: "ocellus-p2"; tiles: readonly Tile[] }>;
type P3Memory = Readonly<{ id: "ocellus-p3"; collapsed: number; shout: number; quietUntil: number; diseased: boolean; rootedUntil: number; voidUntil: number; voidKind: string }>;

export type RaidMemory = BorkMemory | EzekielMemory | GuardianMemory | MoiaMemory | XarthMemory | DagonMemory | P1Memory | P2Memory | P3Memory;

const attack = (name: string, text: string): RaidEvent => ({ kind: "attack", name, text });
const damage = (name: string, style: IncomingStyle, protectedAmount: number, unprotectedAmount: number): RaidEvent => ({ kind: "damage", name, style, protectedAmount, unprotectedAmount });
const chat = (text: string): RaidEvent => ({ kind: "chat", text });
const phase = (name: string): RaidEvent => ({ kind: "phase", name });
const bossAt = (at: Tile): RaidEvent => ({ kind: "boss-at", tile: at });

function keep(pending: readonly Scheduled[], at: number): readonly Scheduled[] {
  return pending.filter((item) => item.at > at);
}

function now(pending: readonly Scheduled[], at: number): RaidEvent[] {
  return pending.filter((item) => item.at === at).map((item) => item.event);
}

function later(pending: readonly Scheduled[], at: number, event: RaidEvent, when: number): readonly Scheduled[] {
  return [...keep(pending, at), { at: when, event }];
}

export function initialMemory(id: RaidId): RaidMemory {
  switch (id) {
    case "bork":
      return { id, nextDrum: 0, suppressUntil: 0, nextBomb: ARCHIVE.bork.bombInterval, chainTell: null, pending: [], wiped: false };
    case "ezekiel":
      return { id, enraged: false, marked: ROOMS.ezekiel.player, wave: 0 };
    case "guardian":
      return { id, form: "flying", landAt: -1, takeoffAt: -1, nextAuto: 0, nextMushroom: ARCHIVE.guardian.mushroomInterval, nextBeam: -1, enraged: false, nextVine: -1, vineStop: -1, pending: [] };
    case "moia":
      return { id, phase: "p1", reappear: -1, nextChant: -1, chants: 0, station: 0, hopped: 0 };
    case "xarth":
      return { id, phase: "p1" };
    case "dagonhai":
      return { id, stunned: false };
    case "ocellus-p1":
      return { id, mode: "corner", since: 0, corner: 0, meter: 0, centres: 0, pair: 0 };
    case "ocellus-p2":
      return { id, tiles: [] };
    case "ocellus-p3":
      return { id, collapsed: 0, shout: -1, quietUntil: -1, diseased: false, rootedUntil: -1, voidUntil: -1, voidKind: "rift" };
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

function smorkTempo(input: RaidInput): number {
  const hp = input.addsHp[0] ?? ARCHIVE.bork.smorkHp;
  const fraction = hp / ARCHIVE.bork.smorkHp;
  if (fraction > 0.75) return ARCHIVE.bork.tempo.full;
  if (fraction > 0.5) return ARCHIVE.bork.tempo.threeQuarter;
  if (fraction > 0.25) return ARCHIVE.bork.tempo.half;
  return ARCHIVE.bork.tempo.low;
}

function drumHit(input: RaidInput, ring: boolean, tempo: number): RaidEvent | null {
  const distance = gapTo(input.player, ROOMS.bork.smork, ARCHIVE.bork.smorkSize);
  const inRing = tempo === ARCHIVE.bork.tempo.low ? distance >= 2 && distance <= 3 : distance === 1;
  const struck = ring ? inRing : distance <= 1 || distance >= 2;
  if (!struck) return null;
  const hard = distance >= 2 && !ring;
  const amount = hard ? ARCHIVE.bork.unprayed : ARCHIVE.bork.prayed;
  return damage("drum", "melee", hard ? ARCHIVE.bork.unprayed : amount, ARCHIVE.bork.unprayed);
}

function stepBork(memory: BorkMemory, input: RaidInput, at: number): Readonly<{ memory: BorkMemory; events: RaidEvent[] }> {
  let next = memory;
  const events = now(memory.pending, at);
  if (next.chainTell !== null && at >= next.chainTell + ARCHIVE.bork.chain.resume) next = { ...next, chainTell: null };
  if (at === next.nextDrum) {
    const tempo = smorkTempo(input);
    if (at < next.suppressUntil) next = { ...next, nextDrum: at + tempo };
    else {
      events.push(attack("drum", "14542"));
      const hit = drumHit(input, false, tempo);
      if (hit) events.push(hit);
      const ring = drumHit(input, true, tempo);
      next = { ...next, nextDrum: at + tempo, pending: ring ? later(next.pending, at, ring, at + 2) : keep(next.pending, at) };
    }
  } else next = { ...next, pending: keep(next.pending, at) };
  if (at === next.nextBomb) {
    if (next.chainTell !== null) next = { ...next, nextBomb: next.suppressUntil };
    else {
      const tell = at;
      const chain = ARCHIVE.bork.chain;
      events.push(attack("bomb-tell", "Big bomb! Bork watch out!"));
      const shadow = input.player.x <= 4 && input.player.y >= 7 && input.player.y <= 9;
      const pending = [
        ...next.pending,
        { at: tell + chain.oof, event: attack("oof", "14545") },
        { at: tell + chain.veryAngry, event: attack("very-angry", "14549") },
        { at: tell + chain.stomp, event: attack("14550", "14550") },
        { at: tell + chain.hit, event: damage("angry", "typeless", shadow ? 0 : ARCHIVE.bork.angryHit, shadow ? 0 : ARCHIVE.bork.angryHit) },
        { at: tell + chain.after, event: attack("14551", "14551") },
        { at: tell + chain.resume, event: attack("drum-resume", "14542") },
      ];
      next = { ...next, chainTell: tell, suppressUntil: tell + chain.resume, nextBomb: tell + ARCHIVE.bork.bombInterval, pending };
    }
  }
  if (!next.wiped && input.addsAlive === 0 && input.bossHp > 0) {
    events.push(chat("The Smorks fall while Bork still stands."));
    events.push(damage("wipe", "typeless", 99, 99));
    next = { ...next, wiped: true };
  }
  return { memory: next, events };
}

const EZ_SHAPES: readonly (readonly Tile[])[] = [
  [tile(3, 6), tile(3, 7), tile(3, 8)],
  [tile(3, 6), tile(4, 6)],
  [tile(3, 8), tile(4, 8)],
];

function ezSpecials(at: number): number | null {
  const first = ARCHIVE.ezekiel.firstSpecial;
  if (at < first || (at - first) % ARCHIVE.ezekiel.specialInterval !== 0) return null;
  return at;
}

function ezShape(index: number): readonly Tile[] {
  return EZ_SHAPES[index % EZ_SHAPES.length] ?? EZ_SHAPES[0];
}

function stepEzekiel(memory: EzekielMemory, options: RaidOptions, input: RaidInput, at: number): Readonly<{ memory: EzekielMemory; events: RaidEvent[] }> {
  const events: RaidEvent[] = [];
  let next = memory;
  if (!memory.enraged && input.bossHp * 100 < ARCHIVE.ezekiel.hp * options.ezekielEnragePercent) {
    next = { ...memory, enraged: true, wave: at };
    events.push(phase("enrage"));
    events.push(chat("Ezekiel fills the pit."));
  }
  if (next.enraged) {
    const origin = next.wave;
    const index = Math.floor((at - origin) / ARCHIVE.ezekiel.waveInterval);
    if ((at - origin) % ARCHIVE.ezekiel.waveInterval === 0) {
      events.push(attack("wave", "4175"));
      events.push({ kind: "mark", tiles: ezShape(index), colour: "#d8e27a", text: "safe", ticks: 6 });
      events.push(attack("wave-arm", "4"), attack("wave-arm", "5"), attack("wave-arm", "6"));
    }
    for (const delay of [4, 5, 6]) {
      const told = at - delay;
      if (told < origin || (told - origin) % ARCHIVE.ezekiel.waveInterval !== 0) continue;
      const shape = ezShape(Math.floor((told - origin) / ARCHIVE.ezekiel.waveInterval));
      if (!shape.some((spot) => sameTile(spot, input.player))) events.push(damage("wave", "typeless", ARCHIVE.ezekiel.waveDamage, ARCHIVE.ezekiel.waveDamage));
    }
    return { memory: next, events };
  }
  const special = ezSpecials(at);
  if (at === 0 || at === ARCHIVE.ezekiel.meleeInterval || (special === null && ARCHIVE.ezekiel.meleeAfterSpecial.some((offset) => ezSpecials(at - offset) !== null))) {
    events.push(attack("melee", "14685"));
    events.push(damage("melee", "melee", ARCHIVE.ezekiel.prayed, ARCHIVE.ezekiel.unprayed));
  }
  if (special !== null) {
    events.push(attack("special", "14687"));
    events.push({ kind: "mark", tiles: [input.player], colour: "#7ec8ff", text: "lightning", ticks: 5 });
    next = { ...next, marked: input.player };
  }
  const told = ezSpecials(at - ARCHIVE.ezekiel.lightning.first) ?? ezSpecials(at - ARCHIVE.ezekiel.lightning.second);
  if (told !== null && sameTile(input.player, next.marked)) {
    events.push(damage("lightning", "typeless", ARCHIVE.ezekiel.lightning.damage, ARCHIVE.ezekiel.lightning.damage));
  }
  if (ezSpecials(at - ARCHIVE.ezekiel.stunAt) !== null && options.swordCrossesBoss) events.push(attack("stun", "8"));
  if (ezSpecials(at - ARCHIVE.ezekiel.healAt) !== null && !options.swordCrossesBoss) {
    events.push({ kind: "heal-boss", amount: ARCHIVE.ezekiel.healAmount });
    events.push(attack("heal", "14688"));
  }
  return { memory: next, events };
}

function onBattery(at: Tile): boolean {
  const pads = [tile(0, 5), tile(0, 18), tile(25, 5), tile(25, 18)];
  return pads.some((pad) => gapTo(at, pad, 2) === 0);
}

function stepGuardian(memory: GuardianMemory, options: RaidOptions, input: RaidInput, at: number): Readonly<{ memory: GuardianMemory; events: RaidEvent[] }> {
  let next = memory;
  const events = now(memory.pending, at);
  const rules = ARCHIVE.guardian;
  if (!next.enraged && input.realHp * 100 <= rules.hp * options.guardianEnragePercent) {
    next = { ...next, enraged: true, nextBeam: at };
    events.push(phase("enrage"));
  }
  if (next.form === "flying" && input.bossHp <= 0 && next.landAt < 0) {
    next = { ...next, form: "landing", landAt: at + rules.landDelay, nextAuto: -1 };
    events.push(phase("landing"));
  }
  if (next.form === "flying" && at === next.nextAuto) {
    events.push(attack("14751", "flying auto"));
    next = {
      ...next,
      nextAuto: at + rules.autoInterval,
      pending: later(next.pending, at, damage("auto", "ranged", rules.ranged.prayed, rules.ranged.unprayed), at + rules.autoFlight),
    };
  }
  if (next.form === "flying" && at === next.nextMushroom) {
    events.push(attack("mushroom", "14753"));
    const mark = tile(input.player.x + 3, input.player.y + 0);
    const distance = Math.max(Math.abs(mark.x - input.player.x), Math.abs(mark.y - input.player.y));
    const amount = distance <= 1 ? rules.mushroomClose : distance === 2 ? rules.mushroomEdge : 0;
    next = {
      ...next,
      nextMushroom: at + rules.mushroomInterval,
      nextAuto: next.nextAuto === at ? at + rules.autoInterval : next.nextAuto,
      pending: later(next.pending, at, damage("mushroom", "typeless", amount, amount), at + rules.mushroomArm),
    };
    events.push({ kind: "mark", tiles: [mark], colour: "#6b4a28", text: "mushroom", ticks: rules.mushroomArm });
  }
  if (at === next.landAt) {
    const reach = gapTo(input.player, ROOMS.guardian.boss, ROOMS.guardian.bossSize);
    events.push(phase("grounded"));
    events.push(attack("14747", "land"));
    if (reach <= rules.landingReach) events.push(damage("landing", "typeless", rules.landingDamage, rules.landingDamage));
    const takeoffAt = at + rules.grounded;
    events.push(...[0, 1, 2].map((step) => attack("swipe", `${rules.swipe.tell[step] ?? 0}`)));
    const swipeDamage = damage("swipe", "melee", rules.swipe.prayed, rules.swipe.unprayed);
    next = {
      ...next,
      form: "grounded",
      takeoffAt,
      nextVine: at + rules.vineFirst,
      vineStop: takeoffAt - rules.vineBeforeTakeoff,
      pending: rules.swipe.hit.reduce((items, delay) => later(items, at, swipeDamage, next.landAt + delay), next.pending),
    };
  }
  if (next.form === "grounded" && next.nextVine >= 0 && at === next.nextVine && at <= next.vineStop) {
    events.push(attack("vine", "14771"));
    next = { ...next, nextVine: at + rules.vineInterval };
  }
  if (at === next.takeoffAt) {
    events.push(phase("takeoff"));
    events.push(attack("14748", "takeoff"));
    next = { ...next, form: "takeoff" };
  }
  if (next.form === "takeoff" && at === next.takeoffAt + rules.takeoff) {
    events.push(phase("flying"));
    next = { ...next, form: "flying", nextAuto: next.takeoffAt + rules.autoAfterTakeoff, landAt: -1 };
  }
  if (next.enraged && at === next.nextBeam) {
    events.push(attack("beam", "14754"));
    const aligned = onBattery(input.player);
    const hit = aligned
      ? damage("beam", "typeless", rules.beamAligned, rules.beamAligned)
      : damage("beam", "magic", rules.beamPrayed, rules.beamUnprayed);
    next = { ...next, nextBeam: at + rules.beamInterval, pending: later(next.pending, at, hit, at + options.guardianBeamDelay) };
  } else if (events.length >= 0) {
    next = { ...next, pending: keep(next.pending, at) };
  }
  return { memory: next, events };
}

function stepMoia(memory: MoiaMemory, options: RaidOptions, input: RaidInput, at: number): Readonly<{ memory: MoiaMemory; events: RaidEvent[] }> {
  const rules = ARCHIVE.moia;
  let next = memory;
  const events: RaidEvent[] = [];
  if (next.phase === "p1" && input.bossHp * 100 <= options.moiaHp * rules.enragePercent) {
    events.push(phase("vanish"));
    events.push(chat("Cease this futile resistance!"));
    next = { ...next, phase: "gone", reappear: at + rules.vanish };
  }
  if (next.phase === "gone" && at === next.reappear) {
    events.push(phase("p2"));
    events.push(bossAt(tile(7, 7)));
    events.push({ kind: "heal-boss", amount: 0 });
    events.push(chat("She reappears. The heal is inside 0–5%; this room uses 0, an unsourced practice stand-in."));
    next = { ...next, phase: "p2", nextChant: at + rules.chantLead, chants: 0 };
  }
  const gone = next.phase === "gone";
  const relocate = !gone && at >= rules.relocateFirst && (at - rules.relocateFirst) % rules.relocateInterval === 0 && next.phase === "p1";
  if (relocate) {
    const station = MOIA_STATIONS[(next.station + 1) % MOIA_STATIONS.length] ?? MOIA_STATIONS[0];
    events.push(attack("relocate", "14788"));
    events.push(bossAt(station));
    next = { ...next, station: next.station + 1 };
  } else if (!gone && at % rules.autoInterval === 0) {
    events.push(attack("14785", "ranged"));
  }
  if (!relocate && !gone && at >= rules.rangedFlight && (at - rules.rangedFlight) % rules.autoInterval === 0 && !((at - rules.rangedFlight) >= rules.relocateFirst && (at - rules.rangedFlight - rules.relocateFirst) % rules.relocateInterval === 0 && next.phase === "p1")) {
    events.push(damage("ranged", "ranged", rules.ranged.prayed, rules.ranged.unprayed));
  }
  const launched = at - rules.magicFlight;
  if (!gone && launched >= rules.relocateFirst && (launched - rules.relocateFirst) % rules.relocateInterval === 0) {
    events.push(damage("magic", "magic", rules.magic.prayed, rules.magic.unprayed));
  }
  if (at === 0) {
    events.push({ kind: "respawn-adds", count: rules.bindersAtStart });
    BINDER_STOPS.forEach((stop, index) => events.push({ kind: "add-at", index, tile: stop }));
  } else if (at % rules.binderHop === 0) {
    next = { ...next, hopped: next.hopped + 1 };
    BINDER_STOPS.forEach((_, index) => {
      const stop = BINDER_STOPS[(index + next.hopped) % BINDER_STOPS.length] ?? BINDER_STOPS[0];
      events.push({ kind: "add-at", index, tile: stop });
    });
  }
  const nearBinder = BINDER_STOPS.some((stop, index) => {
    const place = BINDER_STOPS[(index + next.hopped) % BINDER_STOPS.length] ?? stop;
    return Math.max(Math.abs(place.x - input.player.x), Math.abs(place.y - input.player.y)) <= rules.binderReach;
  });
  if (nearBinder) events.push(damage("binder", "typeless", rules.binderDamage, rules.binderDamage));
  if (next.phase === "p2" && at === next.nextChant) {
    events.push(attack("chant", "14787"));
    if (next.chants > 0) {
      events.push(damage("detonation", "typeless", rules.detonationEach * input.addsAlive, rules.detonationEach * input.addsAlive));
    }
    events.push({ kind: "respawn-adds", count: rules.bindersPerChant });
    const gap = rules.chantGaps[Math.min(next.chants, rules.chantGaps.length - 1)] ?? 35;
    next = { ...next, chants: next.chants + 1, nextChant: at + gap };
  } else if (next.phase === "p2" && at === next.nextChant - rules.markLead && next.chants > 0) {
    events.push({ kind: "mark", tiles: [input.player], colour: "#c45bff", text: "detonation", ticks: rules.markLead });
  }
  return { memory: next, events };
}

function stepXarth(memory: XarthMemory, input: RaidInput, at: number): Readonly<{ memory: XarthMemory; events: RaidEvent[] }> {
  const rules = ARCHIVE.xarth;
  const events: RaidEvent[] = [];
  let next = memory;
  const blasts = rules.blastsBeforePhase;
  for (let k = 0; k < blasts; k += 1) {
    for (let i = 0; i < rules.autosBeforeBlast; i += 1) {
      if (at === k * rules.tellInterval + i * rules.autoInterval) events.push(attack("14984", "magic"));
      if (at === k * rules.tellInterval + i * rules.autoInterval + rules.autoFlight) {
        events.push(damage("magic", "magic", rules.magic.prayed, rules.magic.unprayed));
      }
    }
    const tell = rules.autosBeforeBlast * rules.autoInterval + k * rules.tellInterval;
    if (at === tell) events.push(attack("14992", "tell"));
    if (at === tell + rules.blastAfterTell) {
      events.push(attack("14989", "blast"));
      const shadow = PILLAR_SHADOWS[k] ?? PILLAR_SHADOWS[0];
      const safe = sameTile(input.player, shadow);
      events.push(damage("blast", "typeless", safe ? 0 : rules.exposed, safe ? 0 : rules.exposed));
      if (k === blasts - 1) {
        next = { ...next, phase: "p2" };
        events.push(phase("p2"));
      }
    }
  }
  if (next.phase === "p2") {
    const start = blasts * rules.tellInterval - rules.tellInterval + rules.autosBeforeBlast * rules.autoInterval + rules.blastAfterTell + rules.phaseTwoLead;
    if (at >= start && (at - start) % rules.autoInterval === 0) events.push(attack("14985", "ranged"));
    if (at >= start + rules.autoFlight && (at - start - rules.autoFlight) % rules.autoInterval === 0) {
      events.push(damage("ranged", "ranged", rules.ranged.prayed, rules.ranged.unprayed));
    }
  }
  return { memory: next, events };
}

const ELEMENTS = ["fire", "earth", "water", "air"] as const;

function stepDagon(memory: DagonMemory, input: RaidInput, at: number): Readonly<{ memory: DagonMemory; events: RaidEvent[] }> {
  const rules = ARCHIVE.dagonhai;
  const events: RaidEvent[] = [];
  let next = memory;
  if (at % rules.autoInterval === 0) {
    const magic = Math.floor(at / rules.autoInterval) % 2 === 1;
    events.push(attack(magic ? "14597" : "14593", magic ? "magic" : "ranged"));
  }
  if (at >= rules.autoFlight && (at - rules.autoFlight) % rules.autoInterval === 0) {
    const magic = Math.floor((at - rules.autoFlight) / rules.autoInterval) % 2 === 1;
    events.push(damage("auto", magic ? "magic" : "ranged", rules.chip.prayed, rules.chip.unprayed));
  }
  if (at >= rules.channelFirst && (at - rules.channelFirst) % rules.channelInterval === 0) {
    const element = ELEMENTS[Math.floor((at - rules.channelFirst) / rules.channelInterval) % ELEMENTS.length] ?? "fire";
    const line = element === "fire" ? "I'll feed the flames!" : element === "earth" ? "I'll strengthen the bond!" : element === "water" ? "I'll guide the flow!" : "I'll focus the winds!";
    events.push(attack("channel", line));
    events.push(phase(element));
  }
  for (let k = 0; k <= at; k += 1) {
    const channel = rules.channelFirst + k * rules.channelInterval;
    if (channel > at || at > channel + rules.interruptWindow) continue;
    const element = ELEMENTS[k % ELEMENTS.length] ?? "fire";
    const pad = element === "fire" ? DAGON_PADS.fire : element === "earth" ? DAGON_PADS.earth : element === "water" ? DAGON_PADS.water : DAGON_PADS.air;
    if (sameTile(input.player, pad) && !next.stunned) {
      events.push(attack("element-stun", `${rules.stun}`));
      next = { ...next, stunned: true };
    }
    if (at === channel + rules.interruptWindow) next = { ...next, stunned: false };
  }
  if (at >= rules.cauldronFirst && (at - rules.cauldronFirst) % rules.cycle < rules.cauldronSteps * rules.cauldronStep && (at - rules.cauldronFirst) % rules.cauldronStep === 0) {
    const step = Math.floor(((at - rules.cauldronFirst) % rules.cycle) / rules.cauldronStep);
    const spot = DAGON_TRAIL[step] ?? DAGON_TRAIL[0];
    events.push(attack("cauldron", "16649"));
    events.push({ kind: "mark", tiles: [spot], colour: "#e0a040", text: "cauldron", ticks: 2 });
  }
  if (at >= rules.bookFirst && (at - rules.bookFirst) % rules.bookInterval === 0) events.push(attack("throw", "What have we here?"));
  if (at >= rules.bookFirst - rules.bookTell && (at - (rules.bookFirst - rules.bookTell)) % rules.bookInterval === 0 && at < rules.bookFirst + 5000) {
    events.push(chat("What have we here?"));
  }
  const impact = at - rules.bookFlight;
  if (impact >= rules.bookFirst && (impact - rules.bookFirst) % rules.bookInterval === 0) {
    const blocked = DAGON_TRAIL.some((spot) => sameTile(spot, input.player));
    if (!blocked) events.push(damage("book", "typeless", rules.bookDamage, rules.bookDamage));
  }
  return { memory: next, events };
}

function p1CentreDue(hp: number, centres: number): boolean {
  const line = ARCHIVE.p1.shieldPercent[centres];
  if (line === undefined) return false;
  return hp * 100 <= ARCHIVE.p1.hp * line;
}

function stepP1(memory: P1Memory, input: RaidInput, at: number): Readonly<{ memory: P1Memory; events: RaidEvent[] }> {
  const rules = ARCHIVE.p1;
  let next = memory;
  const events: RaidEvent[] = [];
  if (next.mode === "corner" && at === next.since && p1CentreDue(input.bossHp, next.centres)) {
    next = { ...next, mode: "centre", since: at, pair: 0, centres: next.centres + 1 };
    events.push(phase("centre"));
    events.push(bossAt(P1_CENTRE));
    events.push(chat("Ocellus drops Protect from Melee and comes to the centre."));
  }
  if (next.mode === "corner") {
    const elapsed = at - next.since;
    if (elapsed === 0) {
      events.push(phase("corner"));
      events.push(bossAt(P1_CORNERS[next.corner] ?? P1_CORNERS[0]));
    }
    if (elapsed % rules.tendrilGap === 0 && elapsed / rules.tendrilGap < rules.tendrilCount) {
      const index = elapsed / rules.tendrilGap;
      events.push(attack("tendril", `${index + 1}`));
      events.push({ kind: "mark", tiles: [cornerTendril(next.corner, index)], colour: "#67d36a", text: "tendril", ticks: rules.tendrilGreen });
    }
    if (elapsed >= rules.tendrilGreen && (elapsed - rules.tendrilGreen) % rules.tendrilGap === 0) {
      const index = (elapsed - rules.tendrilGreen) / rules.tendrilGap;
      if (index < rules.tendrilCount) {
        const spot = cornerTendril(next.corner, index);
        events.push(attack("green", `${index + 1}`));
        if (sameTile(input.player, spot)) {
          events.push(damage("tendril-chip", "typeless", rules.tendrilChip, rules.tendrilChip));
          if (index === rules.tendrilCount - 1) events.push({ kind: "heal-player", amount: rules.tendrilHeal });
        } else {
          next = { ...next, meter: next.meter + rules.meterStep };
          events.push({ kind: "heal-boss", amount: rules.tendrilBossHeal });
        }
      }
    }
    if (elapsed === (rules.tendrilCount - 1) * rules.tendrilGap + rules.tendrilGreen) {
      const boss = P1_CORNERS[next.corner] ?? P1_CORNERS[0];
      events.push(attack("slam", "14811"));
      events.push({ kind: "mark", tiles: vinesAround(boss), colour: "#3d8f4a", text: "vine", ticks: 6 });
    }
    if (elapsed === (rules.tendrilCount - 1) * rules.tendrilGap + rules.tendrilGreen + rules.slamDelay) {
      const boss = P1_CORNERS[next.corner] ?? P1_CORNERS[0];
      if (gapTo(input.player, boss, 3) <= rules.slamReach) events.push(damage("slam", "typeless", rules.slamDamage, rules.slamDamage));
      next = { ...next, mode: "walk", since: at + 1, corner: (next.corner + 1) % P1_CORNERS.length };
    }
  } else if (next.mode === "walk") {
    const elapsed = at - next.since;
    if (elapsed === 0) {
      events.push(phase("protect-melee"));
      events.push(chat("Protect from Melee while he walks."));
    }
    if (elapsed % rules.volleyInterval === 0 && elapsed < rules.walk) {
      const magic = (next.corner + elapsed / rules.volleyInterval) % 2 === 0;
      events.push(attack(magic ? "4229" : "4232", magic ? "magic" : "ranged"));
    }
    if (elapsed >= rules.volleyFlight && (elapsed - rules.volleyFlight) % rules.volleyInterval === 0 && elapsed - rules.volleyFlight < rules.walk) {
      const magic = (next.corner + (elapsed - rules.volleyFlight) / rules.volleyInterval) % 2 === 0;
      events.push(damage("volley", magic ? "magic" : "ranged", rules.prayed, rules.unprayed));
    }
    if (elapsed === rules.walk) next = { ...next, mode: "corner", since: at };
  } else if (next.mode === "centre") {
    const elapsed = at - next.since;
    const local = elapsed % rules.pairLength;
    if (local === 0 || local === rules.tendrilGap) {
      const which: 0 | 1 = local === 0 ? 0 : 1;
      const spot = centreTendril(Math.floor(elapsed / rules.pairLength), which);
      events.push(attack("tendril", "centre"));
      events.push({ kind: "mark", tiles: [spot], colour: "#67d36a", text: "tendril", ticks: rules.tendrilGreen });
      if (sameTile(input.player, spot)) events.push(damage("tendril-chip", "typeless", rules.tendrilChip, rules.tendrilChip));
      else {
        next = { ...next, meter: next.meter + rules.meterStep };
        events.push({ kind: "heal-boss", amount: rules.tendrilBossHeal });
      }
    }
    if (local === rules.tendrilGap + rules.tendrilGreen) {
      events.push(attack("slam", "14811"));
      events.push({ kind: "mark", tiles: vinesAround(P1_CENTRE), colour: "#3d8f4a", text: "vine", ticks: 6 });
    }
    if (local === rules.tendrilGap + rules.tendrilGreen + rules.slamDelay) {
      if (gapTo(input.player, P1_CENTRE, 3) <= rules.slamReach) events.push(damage("slam", "typeless", rules.slamDamage, rules.slamDamage));
      if (Math.floor(elapsed / rules.pairLength) === rules.centrePairs - 1) next = { ...next, mode: "blast", since: at + 1 };
    }
  } else {
    const elapsed = at - next.since;
    if (elapsed === 0) {
      const high = next.meter >= rules.lowMeter;
      const text = high ? "Embrace... annihilation..." : "Death... awaits...";
      events.push(attack("14810", text));
      events.push(chat(text));
    }
    if (elapsed === rules.annihilationDelay) {
      const stacks = Math.max(1, Math.floor(next.meter / rules.lowMeter));
      for (let projectile = 0; projectile < stacks; projectile += 1) {
        events.push(damage("annihilation", "typeless", rules.annihilationLow, rules.annihilationLow));
      }
      next = { ...next, mode: "corner", since: at + 1, meter: 0 };
    }
  }
  return { memory: next, events };
}

const PATTERNS = {
  A: [[3, 3], [3, 4], [2, 5], [3, 3], [3, 5], [4, 4]],
  B: [[2, 2], [4, 2], [2, 4], [2, 2], [3, 3], [5, 2]],
  C: [[2, 1], [2, 4], [2, 6], [4, 4], [3, 3], [4, 1]],
} as const;

type PatternName = keyof typeof PATTERNS;

export function patternOrder(runSeed: number): readonly PatternName[] {
  const bucket = runSeed % 31;
  if (bucket < 20) return ["B", "A", "C"];
  if (bucket < 28) return ["A", "C", "B"];
  return ["C", "B", "A"];
}

const P2_QUADS: readonly Quadrant[] = ["NW", "NE", "SE", "SW"];

function stepP2(memory: P2Memory, options: RaidOptions, input: RaidInput, at: number): Readonly<{ memory: P2Memory; events: RaidEvent[] }> {
  const rules = ARCHIVE.p2;
  const tiles = [...memory.tiles, input.player].slice(-6);
  const events: RaidEvent[] = [];
  const order = patternOrder(options.seed);
  if (at === rules.bladeOpens) events.push(phase("blade-open"));
  if (at === rules.end - rules.enoughBeforeEnd) events.push(chat("This... is enough..."));
  if (at === rules.end) events.push(phase("complete"));
  for (const bank of rules.banks) if (at === bank) events.push({ kind: "bank-halve" });
  for (let q = 0; q < options.p2Floors; q += 1) {
    const quadrant = P2_QUADS[q] ?? "NW";
    const letter = order[q % order.length] ?? "B";
    const pairs = PATTERNS[letter];
    const first = rules.firstVolley + q * (rules.spacing * (rules.volleys - 1) + rules.padAfterSixth + rules.nextAfterPad + rules.hitDelay - rules.hitDelay);
    const span = rules.spacing * (rules.volleys - 1);
    const sixth = first + span;
    for (let i = 0; i < rules.volleys; i += 1) {
      const volley = first + i * rules.spacing;
      const pair = pairs[i] ?? pairs[0];
      if (at === volley) {
        events.push(attack("volley", `${letter} ${pair[0]},${pair[1]}`));
      }
      if (at === volley + rules.hitDelay) {
        const ago4 = tiles[tiles.length - 1 - 4];
        const ago3 = tiles[tiles.length - 1 - 3];
        const skip = WAVE_SKIP[quadrant];
        const skipped = ago4 !== undefined && ago3 !== undefined && sameTile(ago4, skip.outer) && sameTile(ago3, skip.inner);
        const hit = beamHits(quadrant, pair[0], pair[1], input.player);
        if (hit && !skipped) events.push(damage("beam", "typeless", options.p2BeamMax, options.p2BeamMax));
      }
    }
    if (at === sixth + rules.padAfterSixth) {
      const door = PORTAL_PAD[quadrant];
      events.push(attack("pad", "4271"));
      events.push({ kind: "pad", tile: door.at, next: door.next });
    }
    if (at === sixth + rules.voidAfterSixth) events.push(attack("void", "4270"));
    if (at === sixth + rules.padAfterSixth + 6) {
      const door = PORTAL_PAD[quadrant];
      if (quadrantOf(input.player) === quadrant && !sameTile(input.player, door.at)) {
        events.push(damage("quadrant", "typeless", rules.padMiss, rules.padMiss));
      }
    }
  }
  return { memory: { id: "ocellus-p2", tiles }, events };
}

function p3Attacks(): Readonly<{ offset: number; kind: "melee" | "wave" }[]> {
  const steps = OCELLUS_P3.autos.value;
  const rows: { offset: number; kind: "melee" | "wave" }[] = [];
  let cursor = 0;
  for (const step of steps) {
    switch (step.attack) {
      case "melee":
        rows.push({ offset: cursor, kind: "melee" });
        break;
      case "wave":
        rows.push({ offset: cursor, kind: "wave" });
        break;
      default: {
        const unhandled: never = step.attack;
        return unhandled;
      }
    }
    cursor += step.next;
  }
  return rows;
}

function stepP3(memory: P3Memory, input: RaidInput, at: number): Readonly<{ memory: P3Memory; events: RaidEvent[] }> {
  const rules = ARCHIVE.p3;
  let next = memory;
  const events: RaidEvent[] = [];
  const doomed = rules.order[next.collapsed];
  if (next.shout < 0 && doomed !== undefined && input.bossHp * 100 <= rules.hp * (rules.thresholds[next.collapsed] ?? 75)) {
    const line = next.collapsed === rules.order.length - 1 ? "Obliteration..." : "Run... It matters not...";
    events.push(attack("collapse", line));
    events.push(chat(line));
    next = { ...next, shout: at };
  }
  if (next.shout >= 0 && at === next.shout + rules.collapseDelay) {
    if (doomed !== undefined && quadrantOf(input.player) === doomed) events.push(damage("collapse", "typeless", rules.collapseDamage, rules.collapseDamage));
  }
  if (next.shout >= 0 && at === next.shout + rules.stoneFall) {
    const hops = [...HOP_TILES];
    if (hops.some((spot) => sameTile(spot, input.player))) events.push(damage("stones", "typeless", rules.collapseDamage, rules.collapseDamage));
    const kind = next.collapsed === 0 ? "siphon" : next.collapsed === 1 ? "augmenter" : "rift";
    next = { ...next, collapsed: next.collapsed + 1, shout: -1, voidUntil: at + rules.voidCharge, voidKind: kind };
    events.push(phase(`quadrant-${next.collapsed}`));
    events.push(phase(`void-${kind}`));
  }
  if (at === rules.spinAt) next = { ...next, quietUntil: at + 12 };
  if (at === rules.insolenceAt) next = { ...next, quietUntil: at + rules.insolenceWaves * rules.insolenceGap };
  if (at === rules.untetherAt) next = { ...next, quietUntil: at + rules.eruption + 1 };
  if (at === rules.vineAt) next = { ...next, quietUntil: at + rules.vineDelay };
  if (at >= next.quietUntil) {
    const row = p3Attacks().find((item) => item.offset === at % 20);
    if (row && at % 20 === row.offset) {
      if (row.kind === "melee") {
        const reach = gapTo(input.player, ROOMS["ocellus-p3"].boss, ROOMS["ocellus-p3"].bossSize);
        if (reach <= 2) {
          events.push(attack("melee", "14842"));
          events.push(damage("swing", "melee", OCELLUS_P3.swing.protectedDamage.value.max, OCELLUS_P3.swing.unprotectedDamage.value.max));
        } else {
          events.push(attack("void-shot", "14851"));
          events.push(damage("void-shot", "typeless", OCELLUS_P3.voidShot.value.max, OCELLUS_P3.voidShot.value.max));
        }
      } else {
        events.push(attack("wave", "14846"));
        if (sameTile(input.player, input.previous)) events.push(damage("wave", "typeless", 45, 45));
      }
    }
  }
  if (at === rules.spinAt) {
    events.push(attack("spin", "14869"));
    events.push(chat("Turn Protect from Melee off, then back on for each saw."));
  }
  const waves = next.collapsed === 0 ? 1 : next.collapsed === 1 ? 2 : 3;
  for (let i = 0; i < waves; i += 1) {
    const when = rules.spinAt + (rules.spinWave[i] ?? 4);
    if (at === when) {
      const unprotected = next.diseased || input.prayer !== "melee";
      events.push(attack("spin-wave", `${i + 1}`));
      events.push(damage("spin-wave", "melee", unprotected ? rules.spinUnprayed : rules.spinPrayed, rules.spinUnprayed));
    }
    const punish = rules.spinAt + (i === 0 ? 1 : (rules.spinWave[i - 1] ?? 4) + 1);
    if (at === punish && input.prayer === "melee") {
      events.push(chat("You've been injured and can't use protection prayers."));
      next = { ...next, diseased: true };
    }
  }
  if (at === rules.insolenceAt) {
    events.push(attack("insolence", "Insolence..."));
    events.push(chat("Insolence..."));
  }
  for (let i = 0; i < rules.insolenceWaves; i += 1) {
    if (at === rules.insolenceAt + i * rules.insolenceGap && sameTile(input.player, input.previous)) {
      events.push(damage("insolence", "typeless", rules.insolenceDamage, rules.insolenceDamage));
      events.push({ kind: "mark", tiles: [input.player], colour: "#8a5a3a", text: "field", ticks: 8 });
    }
  }
  if (at === rules.untetherAt) {
    events.push(attack("untether", "Untether..."));
    events.push(chat("Untether... Step under him, and leave on the final glow."));
    events.push(phase("airborne"));
  }
  for (const delay of rules.untetherWaves) {
    if (at === rules.untetherAt + delay) events.push(damage("untether-wave", "magic", rules.magicPrayed, rules.magicUnprayed));
  }
  if (at === rules.untetherAt + rules.glowFirst) events.push(attack("glow", "1"));
  if (at === rules.untetherAt + rules.glowFirst + rules.glows - 1) events.push(attack("glow", `${rules.glows}`));
  if (at === rules.untetherAt + rules.eruption) {
    const inside = gapTo(input.player, ROOMS["ocellus-p3"].boss, 3) === 0;
    const beside = gapTo(input.player, ROOMS["ocellus-p3"].boss, 3) === 1;
    if (!beside) events.push(damage(inside ? "inner-slam" : "eruption", "typeless", rules.eruptionDamage, rules.eruptionDamage));
    events.push(phase("grounded"));
  }
  if (at === rules.vineAt) {
    events.push(attack("vine", "The void... will take you..."));
    events.push(chat("The void... will take you... A solo cannot cut their own vine."));
    events.push(phase("rooted"));
    next = { ...next, rootedUntil: at + rules.vineDelay };
  }
  if (at === next.rootedUntil) {
    events.push(damage("vine", "typeless", rules.vineDamage, rules.vineDamage));
    events.push(phase("free"));
  }
  if (at === 0) {
    events.push(phase("void-rift"));
    next = { ...next, voidUntil: rules.voidCharge, voidKind: "rift" };
  }
  if (at === next.voidUntil && input.addsAlive > 0) events.push(damage("void-burst", "typeless", rules.voidBurst, rules.voidBurst));
  return { memory: next, events };
}

const HOP_TILES: readonly Tile[] = [
  tile(2, 12), tile(5, 12), tile(8, 12), tile(16, 12), tile(19, 12), tile(22, 12),
  tile(12, 2), tile(12, 5), tile(12, 8), tile(12, 16), tile(12, 19), tile(12, 22),
];

export function advance(memory: RaidMemory, options: RaidOptions, input: RaidInput, at: Tick): Readonly<{ memory: RaidMemory; events: readonly Stamp[] }> {
  const step = (() => {
    switch (memory.id) {
      case "bork":
        return stepBork(memory, input, at);
      case "ezekiel":
        return stepEzekiel(memory, options, input, at);
      case "guardian":
        return stepGuardian(memory, options, input, at);
      case "moia":
        return stepMoia(memory, options, input, at);
      case "xarth":
        return stepXarth(memory, input, at);
      case "dagonhai":
        return stepDagon(memory, input, at);
      case "ocellus-p1":
        return stepP1(memory, input, at);
      case "ocellus-p2":
        return stepP2(memory, options, input, at);
      case "ocellus-p3":
        return stepP3(memory, input, at);
      default: {
        const unhandled: never = memory;
        return unhandled;
      }
    }
  })();
  return { memory: step.memory, events: step.events.map((event) => ({ at, event })) };
}

export function project(id: RaidId, options: RaidOptions, until: number, input: (at: Tick, memory: RaidMemory) => RaidInput): readonly Stamp[] {
  let memory = initialMemory(id);
  const stamps: Stamp[] = [];
  for (let cursor = 0; cursor <= until; cursor += 1) {
    const at = tick(cursor);
    const step = advance(memory, options, input(at, memory), at);
    memory = step.memory;
    stamps.push(...step.events);
  }
  return stamps;
}
