import { CacheRenderModel, CacheRenderReferences, CollisionType, InvisibleMovementBlocker, Mob } from "osrs-sdk";
import type { Model, Projectile, Region, UnitBonuses, UnitStats } from "osrs-sdk";
import type { DamageRange, DrillConfig } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { OcellusPlayer } from "../OcellusPlayer";
import type { Cycle, Tick, Tile } from "../../../../sim/brands";
import { after, span, tick, tile } from "../../../../sim/brands";
import type { HitReceipt, IncomingStyle, Style } from "../../../../sim/combat";
import type { FrameOf, HitRequest, Hooks, IncomingHit, Judgement, Landed, Logged } from "../../../../sim/sdk/EncounterBinding";
import { EncounterBinding, incomingStyle } from "../../../../sim/sdk/EncounterBinding";
import type {
  Beat,
  BossState,
  ExplosionOutcome,
  FightEvent,
  HealCause,
  InputObservation,
  Mechanic,
  Ordinal,
  Phase,
  PlayerHit,
  PlayerObservation,
  RiftId,
  RunEnd,
  RunState,
  Special,
  SpecialAttack,
  TickRow,
  VoidKind,
} from "../P4Types";
import { riftId } from "../P4Types";
import { drawHealSplats, drawOverheadIcon } from "../entities/P4Views";
import type { Schedule } from "../../../../sim/schedule";
import { reach, TileSet } from "../../../../sim/tiles";
import { floorRule, FOOTPRINT, VOID_MASKS } from "../p4/floor";
import { enteredSquare, orbTile } from "../p4/orb";
import { rollInt } from "../p4/roll";
import { compileSchedule } from "../p4/schedule";
import { VoidRift } from "./VoidRift";

type BossStep = Readonly<{ player: PlayerObservation; bossHp: number; rifts: readonly Rift[] }>;

type P4Run = Readonly<{ input: InputObservation; event: FightEvent; cause: PlayerHit; snapshot: BossStep; row: TickRow; end: RunEnd }>;

export type OcellusBinding = EncounterBinding<P4Run>;

type Output = Logged<FightEvent> | HitRequest<PlayerHit>;

/** An unclaimed outer orb heals the boss by `credit`; a claim returns `owed`, which a prevented death clears. */
type Orb =
  | Readonly<{ kind: "dormant"; void: VoidKind; credit: number; owed: number; tile: Tile }>
  | Readonly<{ kind: "available"; void: VoidKind; credit: number; owed: number; tile: Tile }>
  | Readonly<{ kind: "claimed"; void: VoidKind; credit: number; owed: number; tile: Tile; returnsAt: Tick }>
  | Readonly<{ kind: "expired"; void: VoidKind; credit: number; tile: Tile }>;

type Mark = Readonly<{ void: VoidKind; pulse: number; tile: Tile }>;

type Verdict =
  | Readonly<{ outcome: "passed" }>
  | Readonly<{ outcome: "invulnerable" }>
  | Readonly<{ outcome: "blocked"; style: Style; reflectPercent: number }>
  | Readonly<{ outcome: "reduced"; percentLess: number }>;

type Rift = Readonly<{ id: RiftId; tile: Tile; forCycle: Cycle; mob: VoidRift; hpAtPostTick: number; spawnedAt: Tick }>;

/** The SDK keeps a delay-1 hitsplat drawn for the tick it lands and the next. */
const HEAL_SPLAT_TICKS = span(1);

function sdkRangedDefence(): number {
  const ranged = OCELLUS_P4.boss.rangedDefence.value;
  const [first, ...rest] = Object.values(OCELLUS_P4.gear.ammunition.value).map((ammunition) => ranged[ammunition]);
  if (rest.some((value) => value !== first)) throw new Error("the trainer's ammunition classes roll against different ranged defences, and the SDK holds one");
  return first;
}

const DEFENCE_BONUSES = { ...OCELLUS_P4.boss.defenceBonuses.value, range: sdkRangedDefence() };

function withDefenceFloor(stats: UnitStats, lowest: number): UnitStats {
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

function logs(...events: readonly (FightEvent | null)[]): readonly Logged<FightEvent>[] {
  return events.flatMap((event) => (event === null ? [] : [{ kind: "event", event }]));
}

function fixedHit(amount: number, cause: PlayerHit): HitRequest<PlayerHit> {
  return { kind: "hit", damage: { kind: "fixed", amount }, cause };
}

function phaseEvents(last: Phase | null, now: Phase, at: Tick): FightEvent[] {
  const events: FightEvent[] = [];
  if (last?.stage !== now.stage) events.push({ kind: "stage-entered", at, stage: now.stage });
  if ((last?.overhead ?? null) !== now.overhead) events.push({ kind: "overhead-switched", at, overhead: now.overhead });
  if (last?.boss !== now.boss) events.push({ kind: "boss-state-changed", at, state: now.boss });
  return events;
}

function landedDamage(verdict: Verdict, hit: IncomingHit): number {
  switch (verdict.outcome) {
    case "passed":
      return hit.requested;
    case "invulnerable":
    case "blocked":
      return 0;
    case "reduced":
      return Math.min(hit.requested, Math.floor((hit.rolled * (100 - verdict.percentLess)) / 100));
    default: {
      const unhandled: never = verdict;
      return unhandled;
    }
  }
}

function damageable(state: BossState): boolean {
  switch (state) {
    case "hidden":
    case "present-invulnerable":
      return false;
    case "present-out-of-melee-reach":
    case "present-damageable":
      return true;
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }
}

function specialAttack<V extends Special>(at: Tick, ordinal: Ordinal, variant: V): SpecialAttack<V> {
  return { at, ordinal, variant, style: OCELLUS_P4.special.styles[variant].value };
}

export class Ocellus extends Mob {
  private readonly schedule: Schedule<Phase, Beat, Mechanic>;
  readonly holes: TileSet;
  readonly binding: OcellusBinding;
  private orbs: readonly Orb[] = [];
  private entered: Tile | null = null;
  private marks: readonly Mark[] = [];
  private stolen: readonly Readonly<{ ordinal: Ordinal; credit: number }>[] = [];
  private rifts: readonly Rift[] = [];
  private healSplats: readonly Readonly<{ amount: number; lastShown: Tick }>[] = [];

  private readonly hooks: Hooks<P4Run> = {
    "tick-opened": ({ time }) => {
      this.healSplats = this.healSplats.filter((splat) => splat.lastShown >= time.encounter);
    },
    "before-npc-hits": ({ time, incoming }) => ({
      snapshot: { player: this.target.observe(), bossHp: this.currentStats.hitpoint, rifts: this.rifts },
      outputs: incoming.flatMap((landing) => this.judgeIncoming(landing, time.encounter)),
    }),
    "npc-turn": ({ time, snapshot }) => this.turn(time.encounter, snapshot.player),
    "hit-applied": ({ hit }) => this.landed(hit),
    "player-hits-settled": ({ time, landed }) => this.settlePlayerHits(time.encounter, landed),
    "player-moved": ({ steps }) => {
      this.entered = steps.reduce(enteredSquare, this.entered);
    },
    "tick-ended": (frame) => this.closeRow(frame),
  };

  constructor(region: Region, private readonly config: DrillConfig, private readonly target: OcellusPlayer, private readonly invincible: () => boolean) {
    super(region, OCELLUS_P4.geometry.bossAnchor.value);
    this.schedule = compileSchedule(config.seed, config.choices);
    this.holes = TileSet.at(this.schedule.acts("floor-holes") ? config.choices.floorHoleLayout.option.value.tiles : []);
    this.binding = new EncounterBinding(config.seed, this.schedule.start, target, this.hooks);
  }

  enterP4(): void {
    const maxHp = this.config.choices.bossMaxHp.option.value;
    this.stats = { ...OCELLUS_P4.boss.stats.value, hitpoint: maxHp };
    const lowestDefence = Math.ceil((this.stats.defence * OCELLUS_P4.boss.lowestDefencePercent.value) / 100);
    const entryHp = this.config.bossEntryHp ?? Math.floor(maxHp * this.config.choices.entryHpFraction.option.value);
    this.currentStats = withDefenceFloor({ ...this.stats, hitpoint: entryHp }, lowestDefence);
  }

  override mobName(): string {
    return "Ocellus";
  }

  override get combatLevel(): number {
    return OCELLUS_P4.boss.combatLevel.value;
  }

  override get size(): number {
    return OCELLUS_P4.boss.size.value;
  }

  override get bonuses(): UnitBonuses {
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: DEFENCE_BONUSES,
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
    };
  }

  override create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(OCELLUS_P4.boss.npcId.value));
  }

  override visible(): boolean {
    return super.visible() && this.phase().boss !== "hidden";
  }

  override canBeAttacked(): boolean {
    return this.phase().boss !== "hidden";
  }

  outOfMeleeReach(): boolean {
    return this.phase().boss === "present-out-of-melee-reach";
  }

  /** Blocking a player already under him would block every tile around that player, and the SDK finds no path out. */
  blocksMovement(): boolean {
    return OCELLUS_P4.boss.footprint.value[this.phase().stage] === "blocks-movement" && !FOOTPRINT.contains(this.target.observe().tile);
  }

  override get idlePoseId(): number {
    const { deflectLoop, idle } = OCELLUS_P4.presentation.bossPoses;
    return this.phase().stage === "inner-void" ? deflectLoop.value : idle.value;
  }

  override drawOverheadPrayers(context: OffscreenCanvasRenderingContext2D, scale: number): void {
    const { overhead } = this.phase();
    if (overhead !== null) drawOverheadIcon(context, scale, overhead);
  }

  override drawHitsplats(context: OffscreenCanvasRenderingContext2D, scale: number, verticalOffset = 0): void {
    super.drawHitsplats(context, scale, verticalOffset);
    drawHealSplats(context, this.healHitsplatImage, this.healSplats.map((splat) => splat.amount), verticalOffset);
  }

  override movementStep(): void {}

  override attackIfPossible(): void {}

  override addProjectile(projectile: Projectile): void {
    super.addProjectile(projectile);
    this.binding.received(projectile);
  }

  override queueStep(): void {
    this.binding.npcTurn(this, () => super.queueStep());
  }

  runState(): RunState {
    const run = this.binding.view();
    switch (run.kind) {
      case "waiting":
        return { kind: "waiting" };
      case "running":
        return { kind: "running", tick: run.at, phase: this.schedule.at(run.at).phase };
      case "ended":
        return { kind: "ended", at: run.at, reason: run.reason };
      default: {
        const unhandled: never = run;
        return unhandled;
      }
    }
  }

  private phase(): Phase {
    return this.schedule.at(this.binding.view().at).phase;
  }

  private turn(at: Tick, player: PlayerObservation): Readonly<{ outputs: readonly Output[]; ending: RunEnd | null }> {
    const moment = this.schedule.at(at);
    const phased = logs(...phaseEvents(at > 0 ? this.schedule.at(tick(at - 1)).phase : null, moment.phase, at));
    if (this.currentStats.hitpoint <= 0) return { outputs: [...phased, ...logs({ kind: "run-ended", at, reason: "kill" })], ending: "kill" };
    const destroyed = logs(...this.destroyFallenRifts(at));
    this.rifts.forEach((rift) => rift.mob.charge(span(at - rift.spawnedAt)));
    const reactions = moment.beats.flatMap((beat) => this.react(beat, at, player));
    return { outputs: [...phased, ...destroyed, ...reactions, ...this.strikeHole(at, player)], ending: null };
  }

  private judgeIncoming(landing: IncomingHit, at: Tick): readonly (Output | Judgement)[] {
    const verdict = this.judge(at, landing.style, landing.launchedAt);
    const judged: Judgement = { kind: "judge-incoming", hit: landing, damage: landedDamage(verdict, landing) };
    const reflected = verdict.outcome === "blocked" ? this.reflect(verdict, landing.requested, at) : [];
    return [judged, ...reflected, ...logs({ kind: "player-hit-judged", at, style: landing.style, outcome: verdict.outcome, requested: landing.requested })];
  }

  private judge(at: Tick, style: IncomingStyle, launchedAt: Tick): Verdict {
    if (!damageable(this.schedule.at(at).phase.boss)) return { outcome: "invulnerable" };
    const rule = this.config.choices.deflect.option.value;
    switch (rule.kind) {
      case "none":
        return this.unblocked(at);
      case "block": {
        const { overhead } = this.schedule.at(launchedAt).phase;
        const deflected = overhead === null ? null : OCELLUS_P4.deflects[overhead].value;
        return deflected !== null && deflected === style ? { outcome: "blocked", style: deflected, reflectPercent: rule.reflectPercent } : this.unblocked(at);
      }
      default: {
        const unhandled: never = rule;
        return unhandled;
      }
    }
  }

  private unblocked(at: Tick): Verdict {
    if (!this.schedule.at(at).beats.some((beat) => beat.kind === "explosions-occurring")) return { outcome: "passed" };
    return { outcome: "reduced", percentLess: this.config.choices.explosionDamageReduction.option.value };
  }

  private reflect({ style, reflectPercent }: Extract<Verdict, { outcome: "blocked" }>, blocked: number, at: Tick): readonly Output[] {
    const requested = Math.floor((blocked * reflectPercent) / 100);
    return requested === 0 ? [] : [fixedHit(requested, { kind: "deflect-reflected", at, style })];
  }

  private react(beat: Beat, at: Tick, player: PlayerObservation): readonly Output[] {
    switch (beat.kind) {
      case "boss-shouts":
        this.setOverheadText(beat.text);
        this.overheadTextTimer = beat.lasts;
        return logs({ kind: "boss-shouted", at, text: beat.text });
      case "boss-landing-starts":
        return logs({ kind: "boss-landing-started", at });
      case "floor-damage":
        return this.strikeFloor(beat.void, at, player);
      case "lifeforce-tell":
        return logs({ kind: "lifeforce-told", at, void: beat.void });
      case "lifeforce-hit":
        return [this.drain(beat.void, at, player.tile)];
      case "orb-matures":
        return logs(this.matureOrb(beat.void, at));
      case "orb-expires":
        return logs(this.expireOrb(beat.void, at));
      case "unclaimed-orb-heals":
        return logs(this.healFromUnclaimedOuterOrb(at));
      case "explosion-series-starts":
        return logs({ kind: "explosion-series-started", at, void: beat.void });
      case "explosion-mark":
        return logs(this.markExplosion(beat.void, beat.pulse, at, player.tile));
      case "explosion-impact":
        return this.detonate(beat.void, beat.pulse, at, player.tile);
      case "explosions-occurring":
        return [];
      case "special-tell":
        return logs({ kind: "special-told", ...specialAttack(at, beat.ordinal, beat.variant) });
      case "special-hit":
        return [this.strikeSpecial(beat.ordinal, beat.variant, at)];
      case "special-sound":
        return logs({ kind: "special-sounded", at, ordinal: beat.ordinal, cue: beat.cue });
      case "soul-split-heal":
        return logs(this.soulSplit(beat.ordinal, at));
      case "rifts-spawn":
        return logs(...this.spawnRifts(beat.forCycle, at));
      case "rift-charge-ends":
        return this.burstRifts(beat.forCycle, at);
      default: {
        const unhandled: never = beat;
        return unhandled;
      }
    }
  }

  private strikeFloor(kind: VoidKind, at: Tick, player: PlayerObservation): readonly Output[] {
    const rule = floorRule(kind, this.config.choices);
    if (rule.kind === "harmless" || !VOID_MASKS[kind].contains(player.tile)) return [];
    return [fixedHit(rollInt(this.config.seed, "floorDamage", at, rule.perTick, 0), { kind: "floor-hit", at, void: kind, tile: player.tile })];
  }

  private strikeHole(at: Tick, player: PlayerObservation): readonly Output[] {
    const rule = this.config.choices.floorHoleDamage.option.value;
    if (rule.kind === "harmless" || !this.holes.contains(player.tile)) return [];
    return [fixedHit(rollInt(this.config.seed, "holeDamage", at, rule.perTick, 0), { kind: "hole-hit", at, tile: player.tile })];
  }

  private strikeSpecial(ordinal: Ordinal, variant: Special, at: Tick): HitRequest<PlayerHit> {
    const { protectedDamage, unprotectedDamage } = OCELLUS_P4.special;
    const special = specialAttack(at, ordinal, variant);
    const roll = (range: DamageRange) => rollInt(this.config.seed, "specialDamage", at, range, 0);
    return {
      kind: "hit",
      damage: { kind: "by-prayer", style: special.style, protectedAmount: roll(protectedDamage.value), unprotectedAmount: roll(unprotectedDamage.value) },
      cause: { kind: "special-hit", ...special },
    };
  }

  private soulSplit(ordinal: Ordinal, at: Tick): FightEvent | null {
    const stolen = this.stolen.find((theft) => theft.ordinal === ordinal);
    if (!stolen) return null;
    this.stolen = this.stolen.filter((theft) => theft !== stolen);
    return this.healBoss({ kind: "soul-split", ordinal }, stolen.credit, at);
  }

  private spawnRifts(forCycle: Cycle, at: Tick): FightEvent[] {
    const anchor = OCELLUS_P4.geometry.bossAnchor.value;
    return OCELLUS_P4.rifts.offsetsFromBoss.value.map(({ dx, dy }, slot): FightEvent => {
      const place = tile(anchor.x + dx, anchor.y + dy);
      const mob = new VoidRift(this.region, place);
      this.region.addMob(mob);
      const id = riftId(at, slot);
      this.rifts = [...this.rifts, { id, tile: place, forCycle, mob, hpAtPostTick: mob.currentStats.hitpoint, spawnedAt: at }];
      return { kind: "rift-spawned", at, rift: id, tile: place };
    });
  }

  private destroyFallenRifts(at: Tick): FightEvent[] {
    const fallen = this.rifts.filter((rift) => rift.hpAtPostTick <= 0);
    this.rifts = this.rifts.filter((rift) => rift.hpAtPostTick > 0);
    return fallen.map((rift) => ({ kind: "rift-destroyed", at, rift: rift.id, tile: rift.tile }));
  }

  private burstRifts(forCycle: Cycle, at: Tick): readonly Output[] {
    const isDue = (rift: Rift) => rift.forCycle === forCycle;
    const due = this.rifts.filter(isDue);
    this.rifts = this.rifts.filter((rift) => !isDue(rift));
    return due.map((rift, draw) => {
      rift.mob.detonate();
      return fixedHit(rollInt(this.config.seed, "riftBurst", at, OCELLUS_P4.rifts.burstDamage.value, draw), { kind: "rift-burst", at, rift: rift.id, tile: rift.tile });
    });
  }

  private healBoss(cause: HealCause, requested: number, at: Tick): FightEvent {
    const beforeHp = this.currentStats.hitpoint;
    const afterHp = Math.min(this.stats.hitpoint, beforeHp + requested);
    this.currentStats.hitpoint = afterHp;
    this.healSplats = [...this.healSplats, { amount: afterHp - beforeHp, lastShown: after(at, HEAL_SPLAT_TICKS) }];
    return { kind: "boss-healed", at, cause, receipt: { requested, applied: afterHp - beforeHp, beforeHp, afterHp } };
  }

  private markExplosion(kind: VoidKind, pulse: number, at: Tick, player: Tile): FightEvent {
    this.marks = [...this.marks, { void: kind, pulse, tile: player }];
    return { kind: "explosion-marked", at, void: kind, pulse, tile: player };
  }

  private detonate(kind: VoidKind, pulse: number, at: Tick, player: Tile): readonly Output[] {
    const mark = this.marks.find((pending) => pending.void === kind && pending.pulse === pulse);
    if (!mark) return [];
    this.marks = this.marks.filter((pending) => pending !== mark);
    const impact: Extract<PlayerHit, { kind: "explosion-resolved" }> = { kind: "explosion-resolved", at, void: kind, pulse, tile: mark.tile, underBoss: FOOTPRINT.contains(mark.tile) };
    const resolved = (outcome: ExplosionOutcome) => logs({ ...impact, outcome });
    const distance = reach(mark.tile, player);
    const { radius, attackDelayCut } = OCELLUS_P4.explosion.dodge.value;
    if (distance > radius) return resolved({ kind: "avoided" });
    if (distance > 0) {
      const before = this.target.attackDelay;
      const after = Math.max(Math.min(before, 0), before - attackDelayCut);
      this.target.attackDelay = after;
      return resolved({ kind: "dodged", attackDelay: { before, after } });
    }
    return [fixedHit(rollInt(this.config.seed, "explosionDamage", at, this.config.choices.explosions.option.value.damage, 0), impact)];
  }

  private drain(kind: VoidKind, at: Tick, player: Tile): HitRequest<PlayerHit> {
    const orb = orbTile(this.config.seed, at, player, this.entered ?? player, kind, this.config.choices, this.holes);
    return { kind: "hit", damage: { kind: "fraction-current-hp", divisor: OCELLUS_P4.lifeforceOrb.drainDivisor.value }, cause: { kind: "lifeforce-drained", at, void: kind, orb } };
  }

  private landed({ cause, receipt }: Landed<PlayerHit>): readonly FightEvent[] {
    switch (cause.kind) {
      case "deflect-reflected":
      case "floor-hit":
      case "hole-hit":
      case "rift-burst":
        return [{ ...cause, receipt }];
      case "special-hit":
        if (receipt.prayer !== cause.style) this.stolen = [...this.stolen, { ordinal: cause.ordinal, credit: receipt.applied }];
        return [{ ...cause, receipt }];
      case "explosion-resolved":
        return [{ ...cause, outcome: { kind: "hit", receipt } }];
      case "lifeforce-drained": {
        const credit = receipt.applied;
        this.orbs = [...this.orbs.filter((orb) => orb.void !== cause.void), { kind: "dormant", void: cause.void, credit, owed: credit, tile: cause.orb }];
        return [
          { kind: "lifeforce-drained", at: cause.at, void: cause.void, receipt },
          { kind: "orb-spawned", at: cause.at, void: cause.void, tile: cause.orb, credit },
        ];
      }
      default: {
        const unhandled: never = cause;
        return unhandled;
      }
    }
  }

  private orb(kind: VoidKind): Orb | null {
    return this.orbs.find((orb) => orb.void === kind) ?? null;
  }

  private replaceOrb(kind: VoidKind, next: Orb | null): void {
    this.orbs = this.orbs.flatMap((orb) => (orb.void !== kind ? [orb] : next === null ? [] : [next]));
  }

  private matureOrb(kind: VoidKind, at: Tick): FightEvent | null {
    const orb = this.orb(kind);
    if (orb?.kind !== "dormant") return null;
    this.replaceOrb(kind, { ...orb, kind: "available" });
    return { kind: "orb-matured", at, void: kind, tile: orb.tile };
  }

  private expireOrb(kind: VoidKind, at: Tick): FightEvent | null {
    const orb = this.orb(kind);
    if (orb?.kind !== "dormant" && orb?.kind !== "available") return null;
    this.replaceOrb(kind, { kind: "expired", void: kind, credit: orb.credit, tile: orb.tile });
    return { kind: "orb-expired", at, void: kind, tile: orb.tile, credit: orb.credit };
  }

  private healFromUnclaimedOuterOrb(at: Tick): FightEvent | null {
    const orb = this.orb("outer-void");
    if (orb?.kind !== "expired") return null;
    this.replaceOrb("outer-void", null);
    return this.healBoss({ kind: "unclaimed-orb" }, orb.credit, at);
  }

  private claimOrbs(at: Tick, player: Tile): void {
    const radius = this.config.choices.orbPickupRadius.option.value;
    const returnsAt = after(at, OCELLUS_P4.lifeforceOrb.returnAfterStep.value);
    this.orbs = this.orbs.map((orb) => (orb.kind === "available" && reach(orb.tile, player) <= radius ? { ...orb, kind: "claimed", returnsAt } : orb));
  }

  /** Runs after the player's hits land and before the SDK latches death, so a return must not reach a player at 0 HP. */
  private settlePlayerHits(at: Tick, landed: readonly Landed<PlayerHit>[]): readonly FightEvent[] {
    const isDue = (orb: Orb): orb is Extract<Orb, { kind: "claimed" }> => orb.kind === "claimed" && orb.returnsAt === at;
    const due = this.orbs.filter(isDue);
    this.orbs = this.orbs.filter((orb) => !isDue(orb));
    const events: FightEvent[] = [];
    for (const orb of due) {
      const beforeHp = this.target.currentStats.hitpoint;
      if (beforeHp <= 0) continue;
      const afterHp = beforeHp + orb.owed;
      this.target.currentStats.hitpoint = afterHp;
      events.push({ kind: "orb-returned", at, void: orb.void, tile: orb.tile, receipt: { requested: orb.owed, applied: orb.owed, beforeHp, afterHp } });
    }
    if (!this.invincible()) return events;
    const lethal = landed.find(({ receipt }) => receipt.beforeHp > 0 && receipt.afterHp === 0);
    if (!lethal) return events;
    const clearedOrbCredit = this.orbs.reduce((sum, orb) => sum + (orb.kind === "expired" ? 0 : orb.owed), 0);
    this.orbs = this.orbs.map((orb) => (orb.kind === "expired" ? orb : { ...orb, owed: 0 }));
    this.target.currentStats.hitpoint = this.target.stats.hitpoint;
    return [...events, { kind: "death-prevented", at, source: lethal.cause.kind, clearedOrbCredit }];
  }

  private closeRow({ time, inputs, snapshot, events, combatDraws, ending }: FrameOf<P4Run, "tick-ended">): Readonly<{ row: TickRow; ending: RunEnd | null }> {
    const playerAtPostTick = this.target.observe();
    const died = ending === null && playerAtPostTick.hp <= 0;
    const riftHits = snapshot.rifts.flatMap((rift) =>
      rift.mob.hitsThisTick.map((hit): FightEvent => ({ kind: "rift-hit", at: time.encounter, rift: rift.id, style: incomingStyle(hit.attackStyle), damage: hit.damage })),
    );
    const landed = [...events, ...riftHits];
    const { phase, beats } = this.schedule.at(time.encounter);
    const row: TickRow = {
      tick: time.encounter,
      worldTick: time.world,
      phase,
      playerAtBossStep: snapshot.player,
      inputs,
      beats: ending === null ? beats : [],
      events: died ? [...landed, { kind: "run-ended", at: time.encounter, reason: "death" }] : landed,
      playerAtPostTick,
      bossHp: { atBossStep: snapshot.bossHp, atPostTick: this.currentStats.hitpoint },
      combatDraws,
    };
    const end = ending ?? (died ? "death" : null);
    if (end === null) {
      this.claimOrbs(row.tick, playerAtPostTick.tile);
      this.rifts = this.rifts.map((rift) => ({ ...rift, hpAtPostTick: rift.mob.currentStats.hitpoint }));
    }
    return { row, ending: end };
  }
}

/** The SDK paths players through mobs and around blocking entities, so the boss's body is an entity over his tiles. */
export class BossFootprint extends InvisibleMovementBlocker {
  constructor(region: Region, private readonly boss: Ocellus) {
    super(region, { ...boss.location });
  }

  override get size(): number {
    return this.boss.size;
  }

  override get collisionType(): CollisionType {
    return this.boss.blocksMovement() ? CollisionType.BLOCK_MOVEMENT : CollisionType.NONE;
  }
}
