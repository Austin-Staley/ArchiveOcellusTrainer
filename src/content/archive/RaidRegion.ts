import { AmuletOfRancour, AttackStyle, AttackStylesController, AvernicTreadsMax, CollisionType, Entity, FerociousGloves, InfernalCape, InvisibleMovementBlocker, LineOfSightMask, Mob, Player, Region, ScytheOfVitur, Settings, UltorRing } from "osrs-sdk";
import type { UnitBonuses } from "osrs-sdk";
import type { Seed, Tile } from "../../sim/brands";
import { tick, tile } from "../../sim/brands";
import { protectionOf } from "../../sim/sdk/EncounterBinding";
import type { RaidLaunch } from "./catalog";
import { advance, initialMemory } from "./clock";
import type { RaidEvent, RaidInput, RaidMemory, Stamp } from "./clock";
import { CENSERS, ROOMS } from "./layout";
import { ARCHIVE, DEMONBANE_RESISTANCE } from "./timings";

type Bar = Readonly<{ npcId: number; hp: number; defence: number; name: string; size: number }>;

class PracticeMob extends Mob {
  blocks = false;
  immune = false;
  label = "Boss";
  tiles = 1;
  kind: "boss" | "add" | "censer" = "boss";

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

  override attack(): boolean {
    return false;
  }

  override attackIfPossible(): void {}

  override setStats(): void {
    const blank = { attack: 1, strength: 1, defence: 1, range: 1, magic: 1, hitpoint: 1 };
    this.stats = blank;
    this.currentStats = { ...blank };
  }

  override get bonuses(): UnitBonuses {
    const melee = this.immune ? 10000 : 0;
    return {
      attack: { stab: 0, slash: 0, crush: 0, magic: 0, range: 0 },
      defence: { stab: melee, slash: melee, crush: melee, magic: 0, range: 0 },
      other: { meleeStrength: 0, rangedStrength: 0, magicDamage: 0, prayer: 0 },
    };
  }

  fill(bar: Bar): void {
    const stats = { attack: 1, strength: 1, defence: bar.defence, range: 1, magic: 1, hitpoint: bar.hp };
    this.stats = stats;
    this.currentStats = { ...stats };
    this.tiles = bar.size;
    this.label = bar.name;
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
}

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
  private ended = false;
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

  override drawDefaultFloor(): boolean {
    return false;
  }

  override drawWorldBackground(context: OffscreenCanvasRenderingContext2D, scale: number): void {
    for (let x = 0; x < this.width; x += 1) {
      for (let y = 0; y < this.height; y += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? "#3c4638" : "#333d30";
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  initialiseRegion(): { player: Player } {
    const room = ROOMS[this.launch.id];
    const player = new Player(this, { x: room.player.x, y: room.player.y });
    const boss = new PracticeMob(this, { x: room.boss.x, y: room.boss.y });
    boss.kind = "boss";
    const adds = this.spawnAdds();
    const censers = this.launch.id === "ocellus-p3" ? this.spawnCensers() : [];
    this.addPlayer(player);
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
    if (this.world.getReadyTimer > 0 || this.ended || !this.mounted) return;
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
    if (player.currentStats.hitpoint <= 0) this.finish(this.invincible);
  }

  snapshot(): Readonly<{ run: { seed: Seed; ended: boolean }; boss: { npcId: number; hp: number; maxHp: number; visible: boolean; defence: number }; player: { hp: number } }> | null {
    if (!this.mounted) return null;
    const { boss, player } = this.mounted;
    return {
      run: { seed: this.launch.options.seed, ended: this.ended },
      boss: { npcId: barFor(this.launch).npcId, hp: boss.currentStats.hitpoint, maxHp: boss.stats.hitpoint, visible: true, defence: boss.currentStats.defence },
      player: { hp: player.currentStats.hitpoint },
    };
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
    this.mounted.boss.fill(bar);
    this.realHp = this.launch.id === "guardian" ? ARCHIVE.guardian.hp : bar.hp;
    if (this.launch.bossHp !== null) {
      this.mounted.boss.currentStats.hitpoint = this.launch.bossHp;
      if (this.form === "grounded") this.realHp = this.launch.bossHp;
    }
    this.mounted.adds.forEach((add) => add.fill(addBar(this.launch, add.label)));
    this.mounted.censers.forEach((censer, index) => censer.fill({ npcId: 0, hp: 1, defence: 0, name: CENSOR_NAMES[index] ?? "Censer", size: 1 }));
    dressMelee(this.mounted.player);
    this.memory = initialMemory(this.launch.id);
    this.clockTick = 0;
    this.rows = [];
    this.lines = [];
    this.ended = false;
    this.banked = 0;
    this.spent = new Set();
    this.previous = ROOMS[this.launch.id].player;
    if (this.launch.id === "ocellus-p1" || this.launch.id === "ocellus-p2" || this.launch.id === "ocellus-p3") {
      this.say(`Demonbane weapons deal ${Math.round(DEMONBANE_RESISTANCE * 100)}% less against Ocellus.`);
    }
    if (this.launch.id === "ocellus-p1") this.say("Block the tendrils. At 66% and 25% he comes to the centre.");
    if (this.launch.id === "ocellus-p2") this.say("Stand where the orange arms cross. The Blade passes on half its damage.");
    if (this.launch.id === "ocellus-p3") this.say("You are the tank. Two melee hits, then a wave. After two waves, the blade.");
  }

  private present(event: RaidEvent): void {
    if (!this.mounted) return;
    const { player, boss } = this.mounted;
    switch (event.kind) {
      case "attack":
        this.say(event.text);
        return;
      case "chat":
        this.say(event.text);
        return;
      case "damage": {
        const prayed = event.style !== "typeless" && protectionOf(player) === event.style;
        const amount = prayed ? event.protectedAmount : event.unprotectedAmount;
        player.currentStats.hitpoint -= amount;
        return;
      }
      case "heal-player":
        player.currentStats.hitpoint = Math.min(player.stats.hitpoint, player.currentStats.hitpoint + event.amount);
        return;
      case "heal-boss":
        boss.currentStats.hitpoint = Math.min(boss.stats.hitpoint, boss.currentStats.hitpoint + event.amount);
        if (this.form === "grounded") this.realHp = boss.currentStats.hitpoint;
        return;
      case "bank-halve": {
        const stored = Math.max(0, boss.stats.hitpoint - boss.currentStats.hitpoint - this.banked);
        const half = Math.floor(stored / 2);
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
    }
    if (name === "grounded") {
      this.form = "grounded";
      boss.stats.hitpoint = this.realHp;
      boss.currentStats.hitpoint = this.realHp;
    }
    if (name === "void-rift" || name === "void-siphon" || name === "void-augmenter") this.summonVoid(name);
    if (name === "complete") this.ended = true;
  }

  private summonVoid(name: "void-rift" | "void-siphon" | "void-augmenter"): void {
    const add = this.mounted?.adds[0];
    if (!add) return;
    const label = name === "void-rift" ? "Void rift" : name === "void-siphon" ? "Void siphon" : "Void augmenter";
    add.label = label;
    add.fill(addBar(this.launch, label));
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

  private rewardVoids(): void {
    if (!this.mounted) return;
    const { player } = this.mounted;
    this.mounted.adds.forEach((add) => {
      if (add.currentStats.hitpoint > 0 || this.spent.has(add) || !add.label.startsWith("Void ")) return;
      this.spent.add(add);
      switch (add.label) {
        case "Void siphon":
          player.currentStats.hitpoint = Math.min(player.stats.hitpoint, player.currentStats.hitpoint + ARCHIVE.p3.siphonHeal);
          this.say("The siphon's killing blow heals you for 22.");
          return;
        case "Void rift":
          player.attackDelay = 0;
          this.say("The rift resets your attack.");
          return;
        case "Void augmenter":
          player.currentStats.attack += ARCHIVE.p3.augmenterBoost;
          player.currentStats.strength += ARCHIVE.p3.augmenterBoost;
          player.currentStats.range += ARCHIVE.p3.augmenterBoost;
          player.currentStats.magic += ARCHIVE.p3.augmenterBoost;
          this.say("The augmenter raises your combat stats.");
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
      if (mark.life <= 0) mark.dying = 1;
    });
    this.marks = this.marks.filter((mark) => mark.life > 0);
  }

  private finish(invincible: boolean): void {
    if (!this.mounted) return;
    if (invincible) {
      this.mounted.player.currentStats.hitpoint = this.mounted.player.stats.hitpoint;
      this.say("Invincible: that hit would have killed you.");
      return;
    }
    this.ended = true;
  }

  private say(text: string): void {
    this.lines.push(text);
    if (this.lines.length > 8) this.lines.shift();
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
      rift.fill({ npcId: 16678, hp: 50, defence: 0, name: "Void rift", size: 1 });
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

function dressMelee(player: Player): void {
  const weapon = new ScytheOfVitur();
  player.equipment.weapon = weapon;
  player.equipment.gloves = new FerociousGloves();
  player.equipment.cape = new InfernalCape();
  player.equipment.necklace = new AmuletOfRancour();
  player.equipment.feet = new AvernicTreadsMax();
  player.equipment.ring = new UltorRing();
  player.equipmentChanged();
  AttackStylesController.controller.setWeaponAttackStyle(weapon, AttackStyle.AGGRESSIVECRUSH);
}

function addBar(launch: RaidLaunch, name: string): Bar {
  if (name === "Smorks") return { npcId: ARCHIVE.bork.smorkNpcId, hp: ARCHIVE.bork.smorkHp, defence: launch.options.smorkDefence, name, size: ARCHIVE.bork.smorkSize };
  if (name === "Undead binder") return { npcId: ARCHIVE.moia.binderNpcId, hp: ARCHIVE.moia.binderHp, defence: 1, name, size: 1 };
  if (name === "Void rift") return { npcId: 16678, hp: 50, defence: 0, name, size: 1 };
  if (name === "Void siphon") return { npcId: 16679, hp: 44, defence: 0, name, size: 1 };
  if (name === "Void augmenter") return { npcId: 16680, hp: 50, defence: 0, name, size: 1 };
  return { npcId: 0, hp: 1, defence: 1, name, size: 1 };
}
