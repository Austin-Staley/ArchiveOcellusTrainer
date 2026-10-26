import type { Seed } from "../../sim/brands";
import { tile } from "../../sim/brands";
import type { IncomingStyle } from "../../sim/combat";
import { OCELLUS_P3 } from "../ocellus/js/OcellusTimings";
import type { RaidOptions } from "./catalog";
import type { P3Memory, P3Other, P3Rift, P3RiftKind, RaidEvent, RaidInput } from "./clock";
import { ROOMS, gapTo, quadrantOf, sameTile } from "./layout";
import type { Tile } from "../../sim/brands";
import { ARCHIVE } from "./timings";

/**
 * The encounter room's phase 3 clock.
 * The chain, the saws, the slash and Insolence bands, Untether's slam and the siphon line follow the fight logs
 * (upstream #88) and ocellus-sim 75bd193 `data.ts` / `phase3.ts`. Where those two disagree, the comment on the
 * ARCHIVE field says which number the room deals.
 * Quadrant 1 spawns no rift. The room does not invent Untether pool tiles.
 */

const ROOM = ROOMS["ocellus-p3"];

const HOP_TILES: readonly Tile[] = [
  tile(2, 12), tile(5, 12), tile(8, 12), tile(16, 12), tile(19, 12), tile(22, 12),
  tile(12, 2), tile(12, 5), tile(12, 8), tile(12, 16), tile(12, 19), tile(12, 22),
];

const attack = (name: string, text: string): RaidEvent => ({ kind: "attack", name, text });
const hit = (name: string, style: IncomingStyle, protectedAmount: number, unprotectedAmount: number): RaidEvent => ({
  kind: "damage",
  name,
  style,
  protectedAmount,
  unprotectedAmount,
});
const chat = (text: string): RaidEvent => ({ kind: "chat", text });
const phase = (name: string): RaidEvent => ({ kind: "phase", name });

function pickTwo(seed: Seed, at: number, low: number, high: number): number {
  let mixed = (seed ^ Math.imul(at + 1, 0x9e3779b9) ^ Math.imul(11, 0x85ebca6b)) >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x21f0aaad);
  mixed ^= mixed >>> 15;
  return mixed % 2 === 0 ? low : high;
}

function riftKind(start: number, serial: number): P3RiftKind {
  const index = (start + serial) % 3;
  if (index === 0) return "buff";
  if (index === 1) return "basic";
  return "heal";
}

function riftPhase(kind: P3RiftKind): "void-rift" | "void-siphon" | "void-augmenter" {
  switch (kind) {
    case "buff":
      return "void-augmenter";
    case "basic":
      return "void-rift";
    case "heal":
      return "void-siphon";
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
}

function inReach(at: Tile): boolean {
  return gapTo(at, ROOM.boss, ROOM.bossSize) <= 2;
}

function underBoss(at: Tile): boolean {
  return gapTo(at, ROOM.boss, ROOM.bossSize) === 0;
}

/** Eight directions from the middle of his 3×3, three tiles wide, out to the room edge. */
function shadowBand(target: Tile): readonly Tile[] {
  const midX = ROOM.boss.x + Math.floor(ROOM.bossSize / 2);
  const midY = ROOM.boss.y + Math.floor(ROOM.bossSize / 2);
  const dx = target.x - midX;
  const dy = target.y - midY;
  const octant = dx === 0 && dy === 0 ? -2 : Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const ux = Math.round(Math.cos((octant * Math.PI) / 4));
  const uy = Math.round(Math.sin((octant * Math.PI) / 4));
  const half = (ARCHIVE.p3.slashWidth - 1) / 2;
  const reachOut = Math.floor(ROOM.bossSize / 2) + 1;
  const tiles: Tile[] = [];
  for (let y = 0; y < ROOM.height; y += 1) {
    for (let x = 0; x < ROOM.width; x += 1) {
      const ox = x - midX;
      const oy = y - midY;
      const inside = x >= ROOM.boss.x && x < ROOM.boss.x + ROOM.bossSize && y >= ROOM.boss.y && y < ROOM.boss.y + ROOM.bossSize;
      const straightX = ux === 0 && Math.abs(ox) <= half && oy * uy >= reachOut;
      const straightY = uy === 0 && Math.abs(oy) <= half && ox * ux >= reachOut;
      const diagonal = ux !== 0 && uy !== 0 && ox * ux >= 1 && oy * uy >= 1 && Math.abs(ox * ux - oy * uy) <= half && !inside;
      if (straightX || straightY || diagonal) tiles.push(tile(x, y));
    }
  }
  return tiles;
}

/** Insolence: three wide at any angle, from just outside his body to the room edge. */
function superiorBand(target: Tile): readonly Tile[] {
  const midX = ROOM.boss.x + Math.floor(ROOM.bossSize / 2);
  const midY = ROOM.boss.y + Math.floor(ROOM.bossSize / 2);
  const dx = target.x - midX;
  const dy = target.y - midY;
  const length = Math.hypot(dx, dy);
  const ux = length === 0 ? 0 : dx / length;
  const uy = length === 0 ? -1 : dy / length;
  const clear = ROOM.bossSize / 2;
  const tiles: Tile[] = [];
  for (let y = 0; y < ROOM.height; y += 1) {
    for (let x = 0; x < ROOM.width; x += 1) {
      const ox = x - midX;
      const oy = y - midY;
      if (ox * ux + oy * uy >= clear && Math.abs(oy * ux - ox * uy) <= ARCHIVE.p3.slashWidth / 2) tiles.push(tile(x, y));
    }
  }
  return tiles;
}

/** The tiles between the rift beside the player and the middle of his 3×3. Standing on one blocks the heal. */
function siphonLine(): readonly Tile[] {
  const fromX = ROOM.player.x + 2;
  const fromY = ROOM.player.y + 0;
  const toX = ROOM.boss.x + 1;
  const toY = ROOM.boss.y + 1;
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  const tiles: Tile[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = steps === 0 ? fromX : fromX + Math.round(((toX - fromX) * step) / steps);
    const y = steps === 0 ? fromY : fromY + Math.round(((toY - fromY) * step) / steps);
    tiles.push(tile(x, y));
  }
  return tiles;
}

function beginSpecial(memory: P3Memory, at: number, events: RaidEvent[]): P3Memory {
  const rules = ARCHIVE.p3;
  if (memory.spinTurn) {
    const saws = Math.min(rules.sawCuts.length, memory.collapsed + 1);
    const last = rules.sawCuts[saws - 1] ?? rules.sawCuts[0] ?? rules.spinOpen;
    const spins = memory.spinsThisQuadrant + 1;
    events.push(attack("spin", "14869"));
    events.push(chat("Turn Protect from Melee off the tick before each saw."));
    return {
      ...memory,
      specialDue: false,
      spinTurn: false,
      spinStart: at,
      saws,
      setsLeft: rules.setsPerSpecial,
      chain: "swing",
      swingsLeft: 2,
      nextMove: at + last + rules.afterSpin,
      spinsThisQuadrant: spins,
      vineOnNextMove: memory.vineOnNextMove || spins === 1 || spins === 3,
    };
  }
  const other = memory.other;
  const following: P3Other = other === "untether" ? "insolence" : "untether";
  const shared = {
    ...memory,
    specialDue: false,
    spinTurn: true,
    other: following,
    setsLeft: rules.setsPerSpecial,
    chain: "swing" as const,
    swingsLeft: 2,
  };
  switch (other) {
    case "untether":
      events.push(attack("untether", "Untether..."));
      events.push(chat("Untether... Stand under him for the slam, then step out."));
      events.push(phase("airborne"));
      return { ...shared, untetherStart: at, nextMove: at + rules.untetherResume };
    case "insolence":
      events.push(attack("insolence", "Insolence..."));
      events.push(chat("Insolence..."));
      return { ...shared, insolenceStart: at, nextMove: at + rules.insolenceResume };
    default: {
      const unhandled: never = other;
      return unhandled;
    }
  }
}

function takeMove(memory: P3Memory, input: RaidInput, at: number, events: RaidEvent[]): P3Memory {
  const rules = ARCHIVE.p3;
  let next = memory;
  if (next.vineOnNextMove) {
    events.push(attack("vine", "The void... will take you..."));
    events.push(chat(`The void... will take you... It roots you where you stand. It has ${rules.vineHp} hitpoints, and a solo cannot cut their own vine.`));
    next = { ...next, vineOnNextMove: false, vineRootAt: at + rules.vineRootsAfter };
  }
  if (next.specialDue) return beginSpecial(next, at, events);
  if (next.chain === "swing") {
    if (inReach(input.player)) {
      events.push(attack("melee", "14842"));
      events.push(hit("swing", "melee", OCELLUS_P3.swing.protectedDamage.value.max, OCELLUS_P3.swing.unprotectedDamage.value.max));
      const swingsLeft = next.swingsLeft - 1;
      const slashNext = swingsLeft === 0;
      return {
        ...next,
        swingsLeft: slashNext ? 2 : swingsLeft,
        chain: slashNext ? "slash" : "swing",
        nextMove: at + rules.swingGap,
      };
    }
    events.push(attack("void-shot", "14851"));
    events.push(chat("Your panic... is futile..."));
    const swingsLeft = next.swingsLeft - 1;
    const slashNext = swingsLeft === 0;
    return {
      ...next,
      swingsLeft: slashNext ? 2 : swingsLeft,
      chain: slashNext ? "slash" : "swing",
      nextMove: at + rules.afterPanic,
      panicLand: at + rules.panicLands,
      patchFrom: at + rules.panicLands + 1,
      patchUntil: at + rules.panicLands + rules.patchLastMax,
    };
  }
  if (next.chain === "slash") {
    events.push(attack("wave", "14846"));
    const setsLeft = next.setsLeft - 1;
    return {
      ...next,
      slashLand: at + rules.slashLands,
      setsLeft: setsLeft === 0 ? rules.setsPerSpecial : setsLeft,
      specialDue: setsLeft === 0,
      chain: "swing",
      swingsLeft: 2,
      nextMove: at + rules.afterSlash,
    };
  }
  const unhandled: never = next.chain;
  return unhandled;
}

export function stepP3(memory: P3Memory, options: RaidOptions, input: RaidInput, at: number): Readonly<{ memory: P3Memory; events: RaidEvent[] }> {
  const rules = ARCHIVE.p3;
  let next = at === 0 ? { ...memory, riftStart: options.seed % 3 } : memory;
  const events: RaidEvent[] = [];
  const doomed = rules.order[next.collapsed];
  const holdFall = next.untetherStart >= 0 && at < next.untetherStart + rules.untetherFall;
  if (!holdFall && next.shout < 0 && doomed !== undefined && input.bossHp * 100 <= rules.hp * (rules.thresholds[next.collapsed] ?? 75)) {
    const line = next.collapsed === rules.order.length - 1 ? "Obliteration..." : "Run... It matters not...";
    events.push(attack("collapse", line));
    events.push(chat(line));
    next = { ...next, shout: at };
  }
  if (next.shout >= 0 && at === next.shout + rules.collapseDelay) {
    if (doomed !== undefined && quadrantOf(input.player) === doomed) events.push(hit("collapse", "typeless", rules.collapseDamage, rules.collapseDamage));
  }
  if (next.shout >= 0 && at === next.shout + rules.stoneFall) {
    if (HOP_TILES.some((spot) => sameTile(spot, input.player))) events.push(hit("stones", "typeless", rules.collapseDamage, rules.collapseDamage));
    const fresh: P3Rift[] = rules.riftAt.map((offset, index) => ({
      born: at + offset,
      kind: riftKind(next.riftStart, next.riftSerial + index),
    }));
    next = {
      ...next,
      collapsed: next.collapsed + 1,
      shout: -1,
      other: "insolence",
      spinsThisQuadrant: 0,
      rifts: [...next.rifts, ...fresh],
      riftSerial: next.riftSerial + fresh.length,
    };
    events.push(phase(`quadrant-${next.collapsed}`));
  }
  if (at === next.vineRootAt) {
    events.push(phase("rooted"));
    next = { ...next, vineRootAt: -1 };
  }
  if (next.spinStart >= 0 && at === next.spinStart + rules.spinOpen) {
    const open = input.prayer !== "melee";
    events.push(hit("spin-open", "melee", open ? rules.spinOpenMax : 0, rules.spinOpenMax));
  }
  for (let i = 0; i < next.saws; i += 1) {
    const cut = rules.sawCuts[i];
    if (cut === undefined || next.spinStart < 0) continue;
    if (at === next.spinStart + cut - 1 && input.prayer === "melee") {
      events.push(chat("You've been injured and can't use protection prayers."));
      next = { ...next, severUntil: at + rules.severTicks };
    }
    if (at === next.spinStart + cut) {
      const forced = next.severUntil > at;
      const open = forced || input.prayer !== "melee";
      events.push(attack("spin-wave", `${i + 1}`));
      events.push(hit("spin-wave", "melee", open ? rules.sawMax : 0, rules.sawMax));
    }
  }
  if (at === next.panicLand) {
    const prayed = input.prayer === "magic";
    events.push(hit("void-shot", "magic", prayed ? 0 : rules.panicMax, rules.panicMax));
    next = { ...next, panicLand: -1 };
  }
  if (at === next.slashLand) {
    const band = shadowBand(input.player);
    events.push({ kind: "mark", tiles: band, colour: "#6a2a2a", text: "slash", ticks: 2 });
    if (band.some((spot) => sameTile(spot, input.player))) events.push(hit("wave", "typeless", rules.slashMax, rules.slashMax));
    next = { ...next, slashLand: -1 };
  }
  if (next.insolenceStart >= 0) {
    for (const slash of rules.insolenceSlashes) {
      if (at === next.insolenceStart + slash) events.push(attack("wave", "14848"));
      if (at === next.insolenceStart + slash + rules.insolenceLands) {
        const band = superiorBand(input.player);
        events.push({ kind: "mark", tiles: band, colour: "#8a5a3a", text: "field", ticks: 3 });
        if (band.some((spot) => sameTile(spot, input.player))) events.push(hit("insolence", "typeless", rules.insolenceMax, rules.insolenceMax));
      }
    }
  }
  if (next.untetherStart >= 0) {
    const into = at - next.untetherStart;
    if (rules.untetherMagic.some((delay) => delay === into)) {
      const prayed = input.prayer === "magic";
      events.push(hit("untether-wave", "magic", prayed ? 0 : rules.untetherMagicMax, rules.untetherMagicMax));
    }
    if (into === rules.slamAt) {
      events.push(phase("grounded"));
      if (!underBoss(input.player)) events.push(hit("slam", "typeless", rules.slamMax, rules.slamMax));
    }
    if (into === rules.aftershockAt && underBoss(input.player)) events.push(hit("aftershock", "typeless", rules.aftershockMax, rules.aftershockMax));
  }
  if (next.patchFrom >= 0 && at >= next.patchFrom && at <= next.patchUntil) {
    events.push(hit("void-patch", "typeless", rules.patchMax, rules.patchMax));
  }
  const still: P3Rift[] = [];
  for (const rift of next.rifts) {
    if (at === rift.born) {
      events.push(phase(riftPhase(rift.kind)));
      if (rift.kind === "heal") next = { ...next, siphonUntil: rift.born + rules.riftDetonate, nextSiphon: rift.born + rules.siphonEvery };
    }
    if (at === rift.born + rules.riftDetonate) {
      if (input.addsAlive > 0) events.push(hit("void-burst", "typeless", rules.riftMax, rules.riftMax));
      continue;
    }
    if (at < rift.born + rules.riftDetonate) still.push(rift);
  }
  next = { ...next, rifts: still };
  if (next.siphonUntil >= 0 && at === next.nextSiphon && at < next.siphonUntil && input.addsAlive > 0) {
    const blocked = siphonLine().some((spot) => sameTile(spot, input.player));
    if (!blocked) events.push({ kind: "heal-boss", amount: pickTwo(options.seed, at, rules.siphonHealLow, rules.siphonHealHigh) });
    next = { ...next, nextSiphon: at + rules.siphonEvery };
  }
  if (at === next.nextMove) {
    next = takeMove({ ...next, spinStart: -1, saws: 0, insolenceStart: -1, untetherStart: -1 }, input, at, events);
  }
  return { memory: next, events };
}
