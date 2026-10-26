import { BasicModel, CacheRenderModel, CacheRenderReferences, CacheRenderSceneModel, CollisionType, Entity, InvisibleMovementBlocker, LineOfSightMask, Mob, Player, Projectile, Region, Settings, TileMarkerModel, TwistedBow } from "osrs-sdk";
import type { Model, RenderableListener, Unit, UnitBonuses } from "osrs-sdk";
import type { Seed, Tick, Tile } from "../../sim/brands";
import { tick, tile } from "../../sim/brands";
import { protectionOf } from "../../sim/sdk/EncounterBinding";
import type { RaidLaunch } from "./catalog";
import { advance, initialMemory } from "./clock";
import type { RaidEvent, RaidInput, RaidMemory, Stamp } from "./clock";
import { CENSERS, ROOMS } from "./layout";
import { dress } from "./loadout";
import { GRAPHICS, PLAYER_BLOCK, arenaFor, attackSequence, deathSequence, spawnSequence } from "./poses";
import type { ActorRole } from "./poses";
import { ARCHIVE, DEMONBANE_RESISTANCE, standInNotice } from "./timings";

type Bar = Readonly<{ npcId: number; hp: number; defence: number; name: string; size: number }>;

class PracticeMob extends Mob {
  blocks = false;
  immune = false;
  label = "Boss";
  tiles = 1;
  npcId = 0;
  kind: "boss" | "add" | "censer" = "boss";
  /** The first cache model is the one on screen. Later builds must not replace its animation listener. */
  private hearListener = true;

  override get collisionType(): CollisionType {
    return this.blocks ? CollisionType.BLOCK_MOVEMENT : CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return this.blocks ? LineOfSightMask.FULL_MASK : LineOfSightMask.NONE;
  }

  override get size(): number {
    return this.tiles;
  }

  override mobName(): string {
    return this.label;
  }

  override get combatLevel(): number {
    return 1;
  }

  override get deathAnimationId(): number | null {
    return deathSequence(this.npcId);
  }

  override attack(): boolean {
    return false;
  }

  override attackIfPossible(): void {}

  override setStats(): void {
    const blank = { attack: 1, strength: 1, defence: 1, range: 1, magic: 1, hitpoint: 1 };
    this.stats = blank;
    this.currentStats = { ...blank };
  }

  override get color(): string {
    switch (this.label) {
      case "Bandosian censer":
        return "#8a6a32";
      case "Armadylean censer":
        return "#d8d2c4";
      case "Zarosian censer":
        return "#7a4ea3";
      case "Saradomin censer":
        return "#3d6fbf";
      default:
        return "#c43c3c";
    }
  }

  override setAnimationListener(listener: RenderableListener): void {
    if (!this.hearListener) return;
    super.setAnimationListener(listener);
    this.hearListener = false;
  }

  override create3dModel(): Model {
    if (modelledNpc(this.npcId)) return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(this.npcId));
    return BasicModel.forRenderable(this);
  }

  override get bonuses(): UnitBonuses {
    const melee = this.immune ? 10000 : 0;
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: melee, slash: melee, crush: melee, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
    };
  }

  /** True when a live actor must be rebuilt. The first id, from 0, is not a swap. */
  fill(bar: Bar): boolean {
    const previous = this.npcId;
    this.npcId = bar.npcId;
    const stats = { attack: 1, strength: 1, defence: bar.defence, range: 1, magic: 1, hitpoint: bar.hp };
    this.stats = stats;
    this.currentStats = { ...stats };
    this.tiles = bar.size;
    this.label = bar.name;
    return previous !== 0 && previous !== bar.npcId;
  }
}

class Mark extends Entity {
  life = 1;
  paint = "#ffffff";
  label = "";

  override get size(): number {
    return 1;
  }

  override entityName(): string {
    return this.label;
  }

  override get color(): string {
    return this.paint;
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    void tickPercent;
    const scale = Settings.tileSize;
    context.fillStyle = this.paint;
    context.globalAlpha = 0.55;
    context.fillRect(this.location.x * scale, this.location.y * scale, scale, scale);
    context.globalAlpha = 1;
  }

  override create3dModel(): Model {
    return TileMarkerModel.forRenderable(this);
  }
}

/** A travelling graphic. A null graphic id is a coloured sphere, used where the capture did not resolve a source. */
class Shot extends Entity {
  life = 1;
  paint = "#e0a040";
  graphicId: number | null = null;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private span = 1;
  private age = 0;
  private held = false;

  override get size(): number {
    return 1;
  }

  override entityName(): string {
    return this.graphicId === null ? "Stand-in projectile" : `Projectile ${this.graphicId}`;
  }

  override get color(): string {
    return this.paint;
  }

  override create3dModel(): Model {
    if (this.graphicId !== null) return CacheRenderModel.forRenderable(this, CacheRenderReferences.spotAnim([{ id: this.graphicId }]));
    return BasicModel.sphereForRenderable(this);
  }

  fly(from: Tile, to: Tile, ticks: number, paint: string, graphic: number | null, hold: boolean): void {
    this.fromX = from.x + 0;
    this.fromY = from.y + 0;
    this.toX = to.x + 0;
    this.toY = to.y + 0;
    this.span = Math.max(1, ticks);
    this.life = this.span;
    this.paint = paint;
    this.graphicId = graphic;
    this.held = hold;
    this.age = 0;
    this.location = { x: this.fromX, y: this.fromY };
  }

  advance(): void {
    this.age += 1;
    this.life -= 1;
    if (!this.held) {
      const along = Math.min(1, this.age / this.span);
      this.location = {
        x: Math.round(this.fromX + (this.toX - this.fromX) * along),
        y: Math.round(this.fromY + (this.toY - this.fromY) * along),
      };
    }
    if (this.life <= 0) this.dying = 0;
  }

  override getPerceivedLocation(tickPercent: number): { x: number; y: number; z: number } {
    if (this.held) return { x: this.fromX, y: this.fromY, z: 1.2 };
    const along = Math.min(1, (this.age + tickPercent) / this.span);
    return {
      x: this.fromX + (this.toX - this.fromX) * along,
      y: this.fromY + (this.toY - this.fromY) * along,
      z: 1.2,
    };
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    const at = this.getPerceivedLocation(tickPercent);
    const scale = Settings.tileSize;
    context.fillStyle = this.paint;
    context.beginPath();
    context.arc((at.x + 0.5) * scale, (at.y + 0.5) * scale, scale * 0.28, 0, Math.PI * 2);
    context.fill();
  }
}

/** The captured map, slid so the boss tile of the template sits on this room's boss tile. */
class Arena extends Entity {
  constructor(
    region: Region,
    location: { x: number; y: number },
    private readonly launchId: RaidLaunch["id"],
  ) {
    super(region, location);
  }

  override get size(): number {
    return 1;
  }

  override entityName(): string {
    return `Region ${arenaFor(this.launchId).region}`;
  }

  override get color(): string {
    return "#3c4638";
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    void tickPercent;
    void context;
  }

  override create3dModel(): Model {
    const place = arenaFor(this.launchId);
    return new CacheRenderSceneModel(`region:${place.region}`, {
      originOffset: { x: place.offsetX, y: place.offsetY },
      elevation: place.elevation,
    });
  }
}

type RaidFinish = "death" | "complete";

type RaidRunState = Readonly<{ kind: "running" }> | Readonly<{ kind: "ended"; at: Tick; reason: RaidFinish }>;

type RaidRunView = Readonly<{ kind: "running"; seed: Seed }> | Readonly<{ kind: "ended"; seed: Seed; at: Tick; reason: RaidFinish }>;

type Mounted = Readonly<{ player: Player; boss: PracticeMob; adds: readonly PracticeMob[]; censers: readonly PracticeMob[] }>;

function barFor(launch: RaidLaunch): Bar {
  const { id, options } = launch;
  switch (id) {
    case "bork":
      return { npcId: ARCHIVE.bork.npcId, hp: ARCHIVE.bork.hp, defence: ARCHIVE.bork.defence, name: "Bork", size: ROOMS.bork.bossSize };
    case "ezekiel":
      return { npcId: ARCHIVE.ezekiel.npcId, hp: ARCHIVE.ezekiel.hp, defence: ARCHIVE.ezekiel.defence, name: "Ezekiel", size: ROOMS.ezekiel.bossSize };
    case "guardian":
      return { npcId: ARCHIVE.guardian.flyingNpcId, hp: ARCHIVE.guardian.shield, defence: ARCHIVE.guardian.defence, name: "Archive Guardian", size: ROOMS.guardian.bossSize };
    case "moia":
      return { npcId: ARCHIVE.moia.npcId, hp: options.moiaHp, defence: ARCHIVE.moia.defence, name: "Moia", size: ROOMS.moia.bossSize };
    case "xarth":
      return { npcId: ARCHIVE.xarth.npcId, hp: ARCHIVE.xarth.hp, defence: ARCHIVE.xarth.defence, name: "Xarth", size: ROOMS.xarth.bossSize };
    case "dagonhai":
      return { npcId: ARCHIVE.dagonhai.npcId, hp: ARCHIVE.dagonhai.shield, defence: ARCHIVE.dagonhai.defence, name: "Dagon'hai trio", size: ROOMS.dagonhai.bossSize };
    case "ocellus-p1":
      return { npcId: ARCHIVE.p1.npcId, hp: ARCHIVE.p1.hp, defence: ARCHIVE.p1.defence, name: "Ocellus", size: ROOMS["ocellus-p1"].bossSize };
    case "ocellus-p2":
      return { npcId: ARCHIVE.p2.npcId, hp: options.bladeHp, defence: ARCHIVE.p2.defence, name: "The Blade", size: ROOMS["ocellus-p2"].bossSize };
    case "ocellus-p3":
      return { npcId: ARCHIVE.p3.npcId, hp: ARCHIVE.p3.hp, defence: ARCHIVE.p3.defence, name: "Ocellus", size: ROOMS["ocellus-p3"].bossSize };
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}

function floorFor(launch: RaidLaunch): number {
  switch (launch.id) {
    case "bork":
      return ARCHIVE.bork.defenceFloor;
    case "ezekiel":
      return ARCHIVE.ezekiel.defenceFloor;
    case "guardian":
      return ARCHIVE.guardian.defenceFloor;
    case "moia":
      return ARCHIVE.moia.defenceFloor;
    case "xarth":
      return ARCHIVE.xarth.defenceFloor;
    case "dagonhai":
      return ARCHIVE.dagonhai.defenceFloor;
    case "ocellus-p1":
      return ARCHIVE.p1.defenceFloor;
    case "ocellus-p2":
      return ARCHIVE.p2.defenceFloor;
    case "ocellus-p3":
      return ARCHIVE.p3.defenceFloor;
    default: {
      const unhandled: never = launch.id;
      return unhandled;
    }
  }
}

const CENSOR_NAMES = ["Bandosian censer", "Armadylean censer", "Zarosian censer", "Saradomin censer"] as const;

export class RaidRegion extends Region {
  invincible = false;
  private mounted: Mounted | null = null;
  private memory: RaidMemory = initialMemory(this.launch.id);
  private clockTick: number | null = null;
  private rows: Stamp[] = [];
  private lines: string[] = [];
  private previous: Tile = ROOMS[this.launch.id].player;
  private realHp = 0;
  private form: "flying" | "grounded" = this.launch.id === "guardian" ? "flying" : "grounded";
  private rooted: Tile | null = null;
  private spent = new Set<PracticeMob>();
  private marks: Mark[] = [];
  private shots: Shot[] = [];
  private run: RaidRunState = { kind: "running" };
  private banked = 0;
  private escape: Readonly<{ tile: Tile; next: Tile; until: number }> | null = null;

  constructor(private readonly launch: RaidLaunch) {
    super();
    this.invincible = launch.invincible;
  }

  override getName(): string {
    return barFor(this.launch).name;
  }

  override get width(): number {
    return ROOMS[this.launch.id].width;
  }

  override get height(): number {
    return ROOMS[this.launch.id].height;
  }

  /** The clickable walk plane stays. The texture is clear so the captured map shows through it. */
  override drawDefaultFloor(): boolean {
    return true;
  }

  override drawWorldBackground(context: OffscreenCanvasRenderingContext2D, scale: number): void {
    context.clearRect(0, 0, this.width * scale, this.height * scale);
  }

  initialiseRegion(): { player: Player } {
    const room = ROOMS[this.launch.id];
    const player = new Player(this, { x: room.player.x, y: room.player.y });
    const boss = new PracticeMob(this, { x: room.boss.x, y: room.boss.y });
    boss.kind = "boss";
    const adds = this.spawnAdds();
    const censers = this.launch.id === "ocellus-p3" ? this.spawnCensers() : [];
    this.addPlayer(player);
    this.addEntity(new Arena(this, { x: 0, y: 0 }, this.launch.id));
    this.addMob(boss);
    this.setBoss(boss);
    adds.forEach((add) => this.addMob(add));
    censers.forEach((censer) => this.addMob(censer));
    this.wallIn();
    this.mounted = { player, boss, adds, censers };
    return { player };
  }

  override reset(startWorld = true): { player: Player } {
    const result = super.reset(false);
    this.boot();
    if (startWorld) this.world.startTicking();
    return result;
  }

  override postTick(): void {
    if (this.world.getReadyTimer > 0 || this.run.kind === "ended" || !this.mounted) return;
    const { player, boss } = this.mounted;
    const at = tile(player.location.x, player.location.y);
    const shieldBroken = this.form === "flying" && boss.currentStats.hitpoint <= 0;
    if (shieldBroken) boss.currentStats.hitpoint = 1;
    const input: RaidInput = {
      player: at,
      bossHp: shieldBroken ? 0 : boss.currentStats.hitpoint,
      realHp: this.realHp,
      addsHp: this.mounted.adds.map((add) => add.currentStats.hitpoint),
      addsAlive: this.mounted.adds.filter((add) => add.currentStats.hitpoint > 0).length,
      prayer: protectionOf(player),
      previous: this.previous,
    };
    const step = advance(this.memory, this.launch.options, input, tick(this.clockTick ?? 0));
    this.memory = step.memory;
    this.rows.push(...step.events);
    step.events.forEach((stamp) => this.present(stamp.event));
    this.crossPad();
    this.rewardVoids();
    this.clockTick = (this.clockTick ?? 0) + 1;
    this.previous = tile(player.location.x, player.location.y);
    if (this.rooted) player.setLocation({ x: this.rooted.x, y: this.rooted.y });
    this.clampDefence();
    this.collectCensers();
    this.expireMarks();
    this.launchShots(step.events);
    if (player.currentStats.hitpoint <= 0) this.finish(this.invincible);
  }

  snapshot(): Readonly<{ run: RaidRunView; boss: { npcId: number; hp: number; maxHp: number; visible: boolean; defence: number }; player: { hp: number } }> | null {
    if (!this.mounted) return null;
    const { boss, player } = this.mounted;
    return {
      run: this.runView(),
      boss: { npcId: barFor(this.launch).npcId, hp: boss.currentStats.hitpoint, maxHp: boss.stats.hitpoint, visible: true, defence: boss.currentStats.defence },
      player: { hp: player.currentStats.hitpoint },
    };
  }

  private runView(): RaidRunView {
    const seed = this.launch.options.seed;
    switch (this.run.kind) {
      case "running":
        return { kind: "running", seed };
      case "ended":
        return { kind: "ended", seed, at: this.run.at, reason: this.run.reason };
      default: {
        const unhandled: never = this.run;
        return unhandled;
      }
    }
  }

  chat(): readonly string[] {
    return [...this.lines];
  }

  fightLog(): Readonly<{ header: { seed: Seed }; rows: readonly Stamp[] }> {
    return { header: { seed: this.launch.options.seed }, rows: this.rows };
  }

  private boot(): void {
    if (!this.mounted) return;
    const bar = barFor(this.launch);
    this.applyBar(this.mounted.boss, bar);
    this.realHp = this.launch.id === "guardian" ? ARCHIVE.guardian.hp : bar.hp;
    if (this.launch.bossHp !== null) {
      this.mounted.boss.currentStats.hitpoint = this.launch.bossHp;
      if (this.form === "grounded") this.realHp = this.launch.bossHp;
    }
    this.mounted.adds.forEach((add) => this.applyBar(add, addBar(this.launch, add.label)));
    this.mounted.censers.forEach((censer, index) => this.applyBar(censer, { npcId: 0, hp: 1, defence: 0, name: CENSOR_NAMES[index] ?? "Censer", size: 1 }));
    dress(this.mounted.player, this.launch.gear);
    this.memory = initialMemory(this.launch.id);
    this.clockTick = 0;
    this.rows = [];
    this.lines = [];
    this.run = { kind: "running" };
    this.banked = 0;
    this.spent = new Set();
    this.previous = ROOMS[this.launch.id].player;
    if (this.launch.id === "ocellus-p1" || this.launch.id === "ocellus-p2" || this.launch.id === "ocellus-p3") {
      this.say(`Demonbane weapons deal ${Math.round(DEMONBANE_RESISTANCE * 100)}% less against Ocellus.`);
    }
    if (this.launch.id === "ocellus-p1") this.say("Block the tendrils. At 66% and 25% he comes to the centre.");
    if (this.launch.id === "ocellus-p2") this.say("Stand where the orange arms cross. The Blade passes on half its damage.");
    if (this.launch.id === "ocellus-p3") this.say("You are the tank. Two melee hits, then a wave. After two waves, the blade.");
    const notice = standInNotice(this.launch.id);
    if (notice.length > 0) this.say(notice);
    const place = arenaFor(this.launch.id);
    const plane = place.region === 16472 ? ", plane 1" : "";
    this.say(`The arena is map region ${place.region}${plane}.`);
    this.describeShots();
    if (this.launch.id === "ocellus-p3") this.say("The censers are coloured stand-ins. They are scenery, and this view has no model for them.");
  }

  private present(event: RaidEvent): void {
    if (!this.mounted) return;
    const { player, boss } = this.mounted;
    switch (event.kind) {
      case "attack":
        this.playAttack(event.name);
        this.say(event.text);
        return;
      case "chat":
        this.say(event.text);
        return;
      case "damage": {
        const prayed = event.style !== "typeless" && protectionOf(player) === event.style;
        const amount = prayed ? event.protectedAmount : event.unprotectedAmount;
        landSplat(boss, player, amount);
        player.currentStats.hitpoint -= amount;
        if (amount > 0 && player.equipment.weapon instanceof TwistedBow) void player.playAnimation(PLAYER_BLOCK);
        return;
      }
      case "heal-player":
        landSplat(boss, player, -event.amount);
        player.currentStats.hitpoint = Math.min(player.stats.hitpoint, player.currentStats.hitpoint + event.amount);
        return;
      case "heal-boss":
        landSplat(player, boss, -event.amount);
        boss.currentStats.hitpoint = Math.min(boss.stats.hitpoint, boss.currentStats.hitpoint + event.amount);
        if (this.form === "grounded") this.realHp = boss.currentStats.hitpoint;
        return;
      case "bank-halve": {
        const stored = Math.max(0, boss.stats.hitpoint - boss.currentStats.hitpoint - this.banked);
        const half = Math.floor(stored / 2);
        landSplat(player, boss, -half);
        boss.currentStats.hitpoint = Math.min(boss.stats.hitpoint, boss.currentStats.hitpoint + half);
        this.banked += stored;
        this.say(`The Blade passes on ${half}.`);
        return;
      }
      case "boss-at":
        boss.setLocation({ x: event.tile.x, y: event.tile.y });
        return;
      case "add-at": {
        const add = this.mounted.adds[event.index];
        if (add) add.setLocation({ x: event.tile.x, y: event.tile.y });
        return;
      }
      case "respawn-adds":
        this.mounted.adds.slice(0, event.count).forEach((add) => {
          add.currentStats.hitpoint = add.stats.hitpoint;
          if (!this.mobs.includes(add) && !this.newMobs.includes(add)) this.addMob(add);
        });
        return;
      case "phase":
        this.enterPhase(event.name);
        return;
      case "pad":
        this.escape = { tile: event.tile, next: event.next, until: (this.clockTick ?? 0) + 8 };
        this.say("An orange portal is open. Step on it.");
        return;
      case "mark":
        event.tiles.forEach((at) => {
          const mark = new Mark(this, { x: at.x, y: at.y });
          mark.paint = event.colour;
          mark.label = event.text;
          mark.life = event.ticks;
          this.addEntity(mark);
          this.marks.push(mark);
        });
        return;
      default: {
        const unhandled: never = event;
        return unhandled;
      }
    }
  }

  private enterPhase(name: string): void {
    if (!this.mounted) return;
    const { boss } = this.mounted;
    boss.immune = name === "protect-melee";
    if (name === "rooted") this.rooted = tile(this.mounted.player.location.x, this.mounted.player.location.y);
    if (name === "free") this.rooted = null;
    if (name === "flying") {
      this.form = "flying";
      boss.stats.hitpoint = ARCHIVE.guardian.shield;
      boss.currentStats.hitpoint = ARCHIVE.guardian.shield;
      boss.label = "Archive Guardian";
      this.wear(boss, ARCHIVE.guardian.flyingNpcId);
    }
    if (name === "grounded") {
      this.form = "grounded";
      boss.stats.hitpoint = this.realHp;
      boss.currentStats.hitpoint = this.realHp;
      this.wear(boss, ARCHIVE.guardian.groundedNpcId);
    }
    if (name === "void-rift" || name === "void-siphon" || name === "void-augmenter") this.summonVoid(name);
    if (name === "complete") this.run = { kind: "ended", at: tick(this.clockTick ?? 0), reason: "complete" };
  }

  private summonVoid(name: "void-rift" | "void-siphon" | "void-augmenter"): void {
    const add = this.mounted?.adds[0];
    if (!add) return;
    const label = name === "void-rift" ? "Void rift" : name === "void-siphon" ? "Void siphon" : "Void augmenter";
    add.label = label;
    const bar = addBar(this.launch, label);
    this.applyBar(add, bar);
    const spawn = spawnSequence(bar.npcId);
    if (spawn !== null) void add.playAnimation(spawn);
    this.spent.delete(add);
    if (!this.mobs.includes(add) && !this.newMobs.includes(add)) this.addMob(add);
  }

  private crossPad(): void {
    if (!this.mounted || !this.escape) return;
    const { player } = this.mounted;
    if ((this.clockTick ?? 0) > this.escape.until) {
      this.escape = null;
      return;
    }
    if (player.location.x === this.escape.tile.x && player.location.y === this.escape.tile.y) {
      player.setLocation({ x: this.escape.next.x, y: this.escape.next.y });
      this.say("The orange portal carries you to the next quadrant.");
      this.escape = null;
    }
  }

  private applyAugmenter(player: Player): void {
    const base = player.stats;
    const publishedFor99 = base.attack === 99 && base.strength === 99 && base.range === 99 && base.magic === 99;
    if (publishedFor99) {
      player.currentStats.attack = ARCHIVE.p3.augmenterAttack;
      player.currentStats.strength = ARCHIVE.p3.augmenterStrength;
      player.currentStats.range = ARCHIVE.p3.augmenterRanged;
      player.currentStats.magic = ARCHIVE.p3.augmenterMagic;
      this.say(
        `The augmenter sets Attack and Strength to ${ARCHIVE.p3.augmenterAttack} and Magic and Ranged to ${ARCHIVE.p3.augmenterRanged}. That is the published buff for a player who started at 99.`,
      );
      return;
    }
    this.say("The published augmenter buff assumes 99 Attack, Strength, Magic and Ranged, so another base is left unchanged.");
  }

  private rewardVoids(): void {
    if (!this.mounted) return;
    const { player } = this.mounted;
    this.mounted.adds.forEach((add) => {
      if (add.currentStats.hitpoint > 0 || this.spent.has(add) || !add.label.startsWith("Void ")) return;
      this.spent.add(add);
      switch (add.label) {
        case "Void siphon":
          landSplat(add, player, -ARCHIVE.p3.siphonHeal);
          player.currentStats.hitpoint = Math.min(player.stats.hitpoint, player.currentStats.hitpoint + ARCHIVE.p3.siphonHeal);
          this.say("The siphon's killing blow heals you for 22.");
          return;
        case "Void rift":
          player.attackDelay = 0;
          this.say("The rift resets your attack.");
          return;
        case "Void augmenter":
          this.applyAugmenter(player);
          return;
        default:
          return;
      }
    });
  }

  private collectCensers(): void {
    if (!this.mounted) return;
    const { player } = this.mounted;
    this.mounted.censers.forEach((censer) => {
      if (censer.currentStats.hitpoint > 0 || this.spent.has(censer)) return;
      this.spent.add(censer);
      switch (censer.label) {
        case "Bandosian censer":
          this.say("Bandosian censer: your next melee hit is a max hit.");
          return;
        case "Armadylean censer":
          this.say("Armadylean censer: your next ranged hit is a max hit.");
          return;
        case "Zarosian censer":
          player.currentStats.specialAttack = Math.min(100, player.currentStats.specialAttack + 50);
          this.say("Zarosian censer: 50% special attack restored.");
          return;
        case "Saradomin censer":
          landSplat(censer, player, -ARCHIVE.p3.censerHeal);
          player.currentStats.hitpoint = Math.min(player.stats.hitpoint, player.currentStats.hitpoint + ARCHIVE.p3.censerHeal);
          player.currentStats.prayer = Math.min(99, (player.currentStats.prayer ?? 0) + ARCHIVE.p3.censerPrayer);
          this.say("Saradomin censer: 50 hitpoints and 50 prayer. Captures have also shown 28–40.");
          return;
        default:
          return;
      }
    });
  }

  private clampDefence(): void {
    if (!this.mounted) return;
    const floor = floorFor(this.launch);
    if (this.mounted.boss.currentStats.defence < floor) this.mounted.boss.currentStats.defence = floor;
  }

  private expireMarks(): void {
    this.marks.forEach((mark) => {
      mark.life -= 1;
      if (mark.life <= 0) mark.dying = 0;
    });
    this.marks = this.marks.filter((mark) => mark.life > 0);
    this.shots.forEach((shot) => shot.advance());
    this.shots = this.shots.filter((shot) => shot.life > 0);
  }

  private launchShots(events: readonly Stamp[]): void {
    if (!this.mounted) return;
    const { boss, player } = this.mounted;
    const from = tile(boss.location.x, boss.location.y);
    const to = tile(player.location.x, player.location.y);
    events.forEach((stamp) => {
      if (stamp.event.kind !== "attack") return;
      shotLooks(this.launch, stamp.event.name).forEach((look) => {
        const shot = new Shot(this, { x: from.x, y: from.y });
        shot.fly(from, to, look.ticks, look.paint, look.graphic, look.hold);
        this.addEntity(shot);
        this.shots.push(shot);
      });
    });
  }

  private applyBar(mob: PracticeMob, bar: Bar): void {
    if (mob.fill(bar)) mob.invalidateModel();
  }

  private wear(mob: PracticeMob, npcId: number): void {
    if (mob.npcId === npcId) return;
    const refresh = mob.npcId !== 0;
    mob.npcId = npcId;
    if (refresh) mob.invalidateModel();
  }

  private finish(invincible: boolean): void {
    if (!this.mounted) return;
    const player = this.mounted.player;
    player.currentStats.hitpoint = player.stats.hitpoint;
    player.cancelDeath();
    if (invincible) {
      this.say("Invincible: that hit would have killed you.");
      return;
    }
    this.run = { kind: "ended", at: tick(Math.max(0, (this.clockTick ?? 1) - 1)), reason: "death" };
  }

  private say(text: string): void {
    this.lines.push(text);
    if (this.lines.length > 8) this.lines.shift();
  }

  private describeShots(): void {
    switch (this.launch.id) {
      case "bork":
        this.say("Projectiles 4056 and 4057 have no captured source, so they are not drawn.");
        return;
      case "ezekiel":
        return;
      case "guardian":
        this.say(`The ranged shot is graphic ${GRAPHICS.guardianRanged}. The beam's travel is a coloured stand-in. Its own graphic is ${GRAPHICS.guardianBeam}.`);
        return;
      case "moia":
        this.say(`The ranged shot is graphic ${GRAPHICS.moiaRanged} and the relocate shot is ${GRAPHICS.moiaRelocate}. This sample is three fights, so those roles stay low confidence.`);
        return;
      case "xarth":
        this.say(`Magic is graphic ${GRAPHICS.xarthMagic}, ranged is ${GRAPHICS.xarthRanged}, and the tell is ${GRAPHICS.xarthTell}.`);
        return;
      case "dagonhai":
        this.say(`Ranged is graphic ${GRAPHICS.dagonRanged} and magic is ${GRAPHICS.dagonMagic}. The book throw is a coloured stand-in. Hitsplat type 11 has no sprite here. This sample is one fight, so the 5-tick hit stays.`);
        return;
      case "ocellus-p1":
        this.say(`The volleys are graphics ${GRAPHICS.p1Magic} and ${GRAPHICS.p1Ranged}. Ocellus has no captured death animation, so none plays.`);
        return;
      case "ocellus-p2":
        this.say("Projectile 4269 has no captured source, so the volley is a coloured stand-in. The Blade stands still, because the captures record no animation.");
        return;
      case "ocellus-p3":
        this.say(`The void shot is graphic ${GRAPHICS.p3Void}. Ocellus has no captured death animation, so none plays. The vine's animations are a stand-in.`);
        return;
      default: {
        const unhandled: never = this.launch.id;
        return unhandled;
      }
    }
  }

  private playAttack(name: string): void {
    if (!this.mounted) return;
    const played = attackSequence(this.launch.id, name);
    if (!played) return;
    actorsFor(this.mounted, played.role).forEach((actor) => {
      void actor.playAnimation(played.sequence);
    });
  }

  private spawnAdds(): PracticeMob[] {
    const room = ROOMS[this.launch.id];
    if (this.launch.id === "bork") {
      const smork = new PracticeMob(this, { x: ROOMS.bork.smork.x, y: ROOMS.bork.smork.y });
      smork.kind = "add";
      smork.blocks = true;
      smork.label = "Smorks";
      smork.fill({ npcId: ARCHIVE.bork.smorkNpcId, hp: ARCHIVE.bork.smorkHp, defence: this.launch.options.smorkDefence, name: "Smorks", size: ARCHIVE.bork.smorkSize });
      return [smork];
    }
    if (this.launch.id === "moia") {
      return Array.from({ length: ARCHIVE.moia.bindersAtStart }, (_, index) => {
        const stop = { x: 4 + (index % 4), y: 4 };
        const binder = new PracticeMob(this, stop);
        binder.kind = "add";
        binder.label = "Undead binder";
        binder.fill({ npcId: ARCHIVE.moia.binderNpcId, hp: ARCHIVE.moia.binderHp, defence: 1, name: "Undead binder", size: 1 });
        return binder;
      });
    }
    if (this.launch.id === "ocellus-p3") {
      const rift = new PracticeMob(this, { x: room.player.x + 2, y: room.player.y });
      rift.kind = "add";
      rift.label = "Void rift";
      rift.fill({ npcId: ARCHIVE.p3.riftNpcId, hp: 50, defence: 0, name: "Void rift", size: 1 });
      return [rift];
    }
    return [];
  }

  private spawnCensers(): PracticeMob[] {
    return CENSERS.map((at, index) => {
      const censer = new PracticeMob(this, { x: at.x, y: at.y });
      censer.kind = "censer";
      censer.label = CENSOR_NAMES[index] ?? "Censer";
      return censer;
    });
  }

  private wallIn(): void {
    for (let x = -1; x <= this.width; x += 1) {
      this.addEntity(new InvisibleMovementBlocker(this, { x, y: -1 }));
      this.addEntity(new InvisibleMovementBlocker(this, { x, y: this.height }));
    }
    for (let y = 0; y < this.height; y += 1) {
      this.addEntity(new InvisibleMovementBlocker(this, { x: -1, y }));
      this.addEntity(new InvisibleMovementBlocker(this, { x: this.width, y }));
    }
  }
}

function actorsFor(mounted: Mounted, role: ActorRole): readonly PracticeMob[] {
  switch (role) {
    case "boss":
      return [mounted.boss];
    case "smorks":
      return mounted.adds.filter((add) => add.label === "Smorks");
    case "binder":
      return mounted.adds.filter((add) => add.label === "Undead binder");
    default: {
      const unhandled: never = role;
      return unhandled;
    }
  }
}

/** A hitsplat that draws on the land tick and the next, without applying its damage a second time. */
function landSplat(from: Unit, target: Unit, amount: number): void {
  const splat = new Projectile(null, amount, from, target, "typeless", { setDelay: 1 });
  splat.remainingDelay = 0;
  splat.totalDelay = 0;
  target.incomingProjectiles.push(splat);
}

function addBar(launch: RaidLaunch, name: string): Bar {
  if (name === "Smorks") return { npcId: ARCHIVE.bork.smorkNpcId, hp: ARCHIVE.bork.smorkHp, defence: launch.options.smorkDefence, name, size: ARCHIVE.bork.smorkSize };
  if (name === "Undead binder") return { npcId: ARCHIVE.moia.binderNpcId, hp: ARCHIVE.moia.binderHp, defence: 1, name, size: 1 };
  if (name === "Void rift") return { npcId: ARCHIVE.p3.riftNpcId, hp: 50, defence: 0, name, size: 1 };
  if (name === "Void siphon") return { npcId: ARCHIVE.p3.siphonNpcId, hp: 44, defence: 0, name, size: 1 };
  if (name === "Void augmenter") return { npcId: ARCHIVE.p3.augmenterNpcId, hp: ARCHIVE.p3.augmenterHp, defence: 0, name, size: 1 };
  return { npcId: 0, hp: 1, defence: 1, name, size: 1 };
}

const RANGED_SHOT = "#7ec8ff";
const MAGIC_SHOT = "#c45bff";
const TYPELESS_SHOT = "#e0a040";

type ShotLook = Readonly<{ ticks: number; paint: string; graphic: number | null; hold: boolean }>;

function shotLooks(launch: RaidLaunch, name: string): readonly ShotLook[] {
  const travel = (ticks: number, paint: string, graphic: number | null): ShotLook => ({ ticks, paint, graphic, hold: false });
  const held = (ticks: number, graphic: number): ShotLook => ({ ticks, paint: TYPELESS_SHOT, graphic, hold: true });
  switch (launch.id) {
    case "bork":
    case "ezekiel":
      return [];
    case "guardian":
      if (name === "14751") return [travel(ARCHIVE.guardian.autoFlight, RANGED_SHOT, GRAPHICS.guardianRanged)];
      if (name === "beam") return [travel(launch.options.guardianBeamDelay, MAGIC_SHOT, null), held(launch.options.guardianBeamDelay, GRAPHICS.guardianBeam)];
      if (name === "mushroom") return [held(ARCHIVE.guardian.mushroomArm, GRAPHICS.guardianMushroom)];
      return [];
    case "moia":
      if (name === "14785") return [travel(Math.max(1, ARCHIVE.moia.rangedFlight), RANGED_SHOT, GRAPHICS.moiaRanged)];
      if (name === "relocate") return [travel(ARCHIVE.moia.magicFlight, MAGIC_SHOT, GRAPHICS.moiaRelocate)];
      return [];
    case "xarth":
      if (name === "14984") return [travel(ARCHIVE.xarth.autoFlight, MAGIC_SHOT, GRAPHICS.xarthMagic)];
      if (name === "14985") return [travel(ARCHIVE.xarth.autoFlight, RANGED_SHOT, GRAPHICS.xarthRanged)];
      if (name === "14992") return [travel(ARCHIVE.xarth.autoFlight, TYPELESS_SHOT, GRAPHICS.xarthTell)];
      return [];
    case "dagonhai":
      if (name === "14597") return [travel(ARCHIVE.dagonhai.autoFlight, MAGIC_SHOT, GRAPHICS.dagonMagic)];
      if (name === "14593") return [travel(ARCHIVE.dagonhai.autoFlight, RANGED_SHOT, GRAPHICS.dagonRanged)];
      if (name === "throw") return [travel(ARCHIVE.dagonhai.bookFlight, TYPELESS_SHOT, null)];
      return [];
    case "ocellus-p1":
      if (name === "4229") return [travel(ARCHIVE.p1.volleyFlight, MAGIC_SHOT, GRAPHICS.p1Magic)];
      if (name === "4232") return [travel(ARCHIVE.p1.volleyFlight, RANGED_SHOT, GRAPHICS.p1Ranged)];
      if (name === "14810") return [travel(ARCHIVE.p1.annihilationDelay, TYPELESS_SHOT, null)];
      return [];
    case "ocellus-p2":
      if (name === "volley") return [travel(ARCHIVE.p2.hitDelay, TYPELESS_SHOT, null)];
      return [];
    case "ocellus-p3":
      if (name === "void-shot") return [travel(1, TYPELESS_SHOT, GRAPHICS.p3Void)];
      return [];
    default: {
      const unhandled: never = launch.id;
      return unhandled;
    }
  }
}

function modelledNpc(id: number): boolean {
  switch (id) {
    case ARCHIVE.bork.npcId:
    case ARCHIVE.bork.smorkNpcId:
    case ARCHIVE.ezekiel.npcId:
    case ARCHIVE.guardian.flyingNpcId:
    case ARCHIVE.guardian.groundedNpcId:
    case ARCHIVE.moia.npcId:
    case ARCHIVE.moia.binderNpcId:
    case ARCHIVE.xarth.npcId:
    case ARCHIVE.dagonhai.npcId:
    case ARCHIVE.p1.npcId:
    case ARCHIVE.p2.npcId:
    case ARCHIVE.p3.npcId:
    case ARCHIVE.p3.riftNpcId:
    case ARCHIVE.p3.siphonNpcId:
    case ARCHIVE.p3.augmenterNpcId:
      return true;
    default:
      return false;
  }
}
