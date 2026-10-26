import { BasicModel, CacheRenderModel, CacheRenderReferences, CacheRenderSceneModel, CollisionType, Entity, InvisibleMovementBlocker, LineOfSightMask, Mob, Player, Projectile, Region, Settings, TileMarkerModel, TwistedBow } from "osrs-sdk";
import type { Model, RenderableListener, Unit, UnitBonuses } from "osrs-sdk";
import type { Seed, Tick, Tile } from "../../sim/brands";
import { tick, tile } from "../../sim/brands";
import { protectionOf } from "../../sim/sdk/EncounterBinding";
import type { RaidLaunch } from "./catalog";
import { advance, initialMemory } from "./clock";
import type { RaidEvent, RaidInput, RaidMemory, Stamp } from "./clock";
import { blastCuesOn, crackCues } from "./cracks";
import { FloorGraphic, idlePortals, paintPortals, raisePortals } from "./floorView";
import type { PortalGraphic } from "./floorView";
import { BATTERY_TILES, CENSERS, P1_CENTRE, ROOMS } from "./layout";
import type { Quadrant } from "./layout";
import type { PortalColour } from "./portals";
import { dress } from "./loadout";
import { BLADE_MODEL, BLADE_SEAT, GRAPHICS, PLAYER_BLOCK, arenaFor, attackSequence, deathSequence, spawnSequence } from "./poses";
import type { ActorRole } from "./poses";
import { ARCHIVE, DEMONBANE_RESISTANCE, standInNotice } from "./timings";
import type { BossMovement, Mobility } from "../movementDebug";
import { WalkTint } from "../movementDebug";
import { acceptAddStep, acceptBossStep, actorName, addMobility, bossMobility, cauldronMayStand, overlayTiles } from "./movement";
import { flightProgress, graphicAnchor, heldStandIn, movementPoseIndex, shotByGraphic, shotMotion, visualLifeTicks, wholeTickStandIn, clientProjectileHeight } from "./visualSync";
import type { ShotMotion } from "./visualSync";

type Bar = Readonly<{ npcId: number; hp: number; defence: number; name: string; size: number }>;

class PracticeMob extends Mob {
  blocks = false;
  immune = false;
  label = "Boss";
  tiles = 1;
  npcId = 0;
  kind: "boss" | "add" | "censer" | "fixture" = "boss";
  /** The first cache model is the one on screen. Later builds must not replace its animation listener. */
  private hearListener = true;
  /** Set for the render after a step that changed the tile. setLocation snaps, so the SDK never sees the move. */
  private stepping = false;

  /** The next render plays the walk pose. Cleared at the start of the following tick. */
  stepped(): void {
    this.stepping = true;
  }

  settlePose(): void {
    this.stepping = false;
  }

  override get animationIndex(): number {
    return movementPoseIndex(this.stepping);
  }

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

  /** The clock places every practice mob. The SDK chase would walk The Blade onto the player. */
  override canMove(): boolean {
    return false;
  }

  override movementStep(): void {}

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
    // Monster 16676 is an uncoloured clickbox. The coloured sword is scenery model 62699.
    // Its stand is pose 0, which hides the sword that does not sit on this tile. No extra yaw: the object is rotation 0.
    if (this.npcId === ARCHIVE.p2.npcId) return CacheRenderModel.forRenderable(this, CacheRenderReferences.model(BLADE_MODEL), { basisRotation: 0 });
    if (modelledNpc(this.npcId)) return CacheRenderModel.forRenderable(this, CacheRenderReferences.npc(this.npcId));
    return BasicModel.forRenderable(this);
  }

  override getPerceivedLocation(tickPercent: number): { x: number; y: number; z: number } {
    const at = super.getPerceivedLocation(tickPercent);
    // The marker stays on the walk tile. Only the mesh drops, onto the centre of that marker.
    if (this.npcId !== ARCHIVE.p2.npcId) return at;
    return { x: at.x, y: at.y, z: at.z - BLADE_SEAT };
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
    const x = this.location.x * scale;
    const y = this.location.y * scale;
    if (this.label === "blast-outline") {
      context.strokeStyle = this.paint;
      context.lineWidth = Math.max(2, Math.floor(scale / 8));
      context.strokeRect(x + 1.5, y + 1.5, scale - 3, scale - 3);
      return;
    }
    context.fillStyle = this.paint;
    context.globalAlpha = 0.55;
    context.fillRect(x, y, scale, scale);
    context.globalAlpha = 1;
    if (!this.label.startsWith("stand-")) return;
    const digit = this.label.slice("stand-".length);
    context.fillStyle = "#06221c";
    context.font = `bold ${Math.max(12, Math.floor(scale * 0.62))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(digit, x + scale / 2, y + scale / 2);
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
  private startCycles = 0;
  private travelCycles = 1;
  private startHeight = 1.2;
  private endHeight = 1.2;
  private slope = 0;
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

  /**
   * The entity's tile stays on the attacker's south-west corner, which is what a same-tick lookup reads.
   * The mesh is drawn from the footprint centre, on the captured client cycles.
   */
  fly(from: Tile, fromSize: number, to: Tile, toSize: number, paint: string, motion: ShotMotion): void {
    const start = graphicAnchor(from, fromSize, this.size);
    const end = graphicAnchor(to, toSize, this.size);
    this.fromX = start.x;
    this.fromY = start.y;
    this.toX = end.x;
    this.toY = end.y;
    this.startCycles = motion.startCycles;
    this.travelCycles = motion.travelCycles;
    this.startHeight = motion.startHeight;
    this.endHeight = motion.endHeight;
    this.slope = motion.slope;
    this.life = visualLifeTicks(motion.startCycles, motion.travelCycles);
    this.paint = paint;
    this.graphicId = motion.graphic;
    this.held = motion.hold;
    this.age = 0;
    this.location = { x: from.x, y: from.y };
  }

  advance(): void {
    this.age += 1;
    this.life -= 1;
    if (this.life <= 0) this.dying = 0;
  }

  override visible(tickPercent: number): boolean {
    if (this.held) return true;
    return flightProgress(this.age, tickPercent, this.startCycles, this.travelCycles) !== null;
  }

  override getPerceivedLocation(tickPercent: number): { x: number; y: number; z: number } {
    if (this.held) return { x: this.fromX, y: this.fromY, z: this.startHeight };
    const along = flightProgress(this.age, tickPercent, this.startCycles, this.travelCycles) ?? 0;
    return {
      x: this.fromX + (this.toX - this.fromX) * along,
      y: this.fromY + (this.toY - this.fromY) * along,
      z: clientProjectileHeight(this.startHeight, this.endHeight, this.slope, along),
    };
  }

  override getPerceivedPitch(tickPercent: number): number {
    if (this.held) return 0;
    const along = flightProgress(this.age, tickPercent, this.startCycles, this.travelCycles) ?? 0;
    const dx = this.toX - this.fromX;
    const dy = this.toY - this.fromY;
    const distance = Math.hypot(dx, dy);
    const dz = this.endHeight - this.startHeight + this.slope * (1 - 2 * along);
    return distance === 0 ? 0 : Math.atan2(dz, distance);
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    if (!this.visible(tickPercent)) return;
    const at = this.getPerceivedLocation(tickPercent);
    const scale = Settings.tileSize;
    context.fillStyle = this.paint;
    context.beginPath();
    context.arc((at.x + this.size / 2) * scale, (at.y - this.size / 2) * scale, scale * 0.28, 0, Math.PI * 2);
    context.fill();
  }
}

/**
 * The coloured sword in phase 1. Fight log L3: scenery object 62706 stands at region local (31, 41)
 * through the vines, and it despawns on the tick npc 16676 appears. That npc is the phase 2 sword,
 * so phase 1 draws the scenery model and not a second Ocellus. The shared scene still omits 62706,
 * because phase 2 also draws the sword on the boss.
 * The anchor is the logged middle. A 3×3 hung toward lower Y centres the sword on trainer (6, 16),
 * which is local (31, 41) under this room's offset.
 */
class BladeScenery extends Entity {
  override get size(): number {
    return 3;
  }

  override entityName(): string {
    return "The Blade";
  }

  override get color(): string {
    return "#c0c6d0";
  }

  override create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.model(BLADE_MODEL), { basisRotation: 0 });
  }

  override getPerceivedLocation(tickPercent: number): { x: number; y: number; z: number } {
    const at = super.getPerceivedLocation(tickPercent);
    return { x: at.x, y: at.y, z: at.z - BLADE_SEAT };
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    void tickPercent;
    void context;
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

type ChatLine = Readonly<{ id: number; text: string }>;

/** The sequence colour and quadrant of the volley currently on the grid. */
export type PortalCall = Readonly<{ colour: PortalColour; quadrant: Quadrant }>;

type Mounted = Readonly<{ player: Player; boss: PracticeMob; adds: readonly PracticeMob[]; censers: readonly PracticeMob[]; fixtures: readonly PracticeMob[] }>;

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
  private mobility: Mobility = "stationary";
  /** Cyan stand tile and its countdown. On unless Settings turns it off. */
  standHelper = true;
  /** Red outline of the tiles a vine explosion will hit. On unless Settings turns it off. */
  blastOutline = true;
  private shownTick = 0;
  private readonly tint = new WalkTint(this, () => overlayTiles(this.launch.id));
  private rows: Stamp[] = [];
  private lines: ChatLine[] = [];
  private nextChatId = 1;
  private litCall: PortalCall | null = null;
  private previous: Tile = ROOMS[this.launch.id].player;
  private realHp = 0;
  private form: "flying" | "grounded" = this.launch.id === "guardian" ? "flying" : "grounded";
  private rooted: Tile | null = null;
  private spent = new Set<PracticeMob>();
  private marks: Mark[] = [];
  private shots: Shot[] = [];
  private floor: FloorGraphic[] = [];
  private portals: readonly PortalGraphic[] = [];
  private run: RaidRunState = { kind: "running" };
  /** Damage The Blade is holding. The bar drops only when a release pays half of it. */
  private held = 0;
  private released = 0;
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
    this.tint.paint(context, scale);
  }

  showBossMovement(on: boolean): void {
    this.tint.show(on);
  }

  bossMovement(): BossMovement | null {
    if (!this.mounted) return null;
    return { mobility: this.mobility, tick: this.shownTick, actor: actorName(this.launch.id) };
  }

  initialiseRegion(): { player: Player } {
    const room = ROOMS[this.launch.id];
    const player = new Player(this, { x: room.player.x, y: room.player.y });
    const boss = new PracticeMob(this, { x: room.boss.x, y: room.boss.y });
    boss.kind = "boss";
    const adds = this.spawnAdds();
    const censers = this.launch.id === "ocellus-p3" ? this.spawnCensers() : [];
    const fixtures = this.spawnFixtures();
    this.addPlayer(player);
    this.addEntity(new Arena(this, { x: 0, y: 0 }, this.launch.id));
    if (this.launch.id === "ocellus-p1") this.addEntity(new BladeScenery(this, { x: P1_CENTRE.x, y: P1_CENTRE.y }));
    this.addMob(boss);
    this.setBoss(boss);
    adds.forEach((add) => this.addMob(add));
    censers.forEach((censer) => this.addMob(censer));
    fixtures.forEach((fixture) => this.addMob(fixture));
    this.wallIn();
    this.mounted = { player, boss, adds, censers, fixtures };
    return { player };
  }

  override reset(startWorld = true): { player: Player } {
    this.tint.forget();
    const result = super.reset(false);
    this.boot();
    this.mobility = "stationary";
    this.shownTick = 0;
    this.tint.repaint();
    if (startWorld) this.world.startTicking();
    return result;
  }

  override postTick(): void {
    if (this.world.getReadyTimer > 0 || this.run.kind === "ended" || !this.mounted) return;
    this.mounted.boss.settlePose();
    this.mounted.adds.forEach((add) => add.settlePose());
    const { player, boss } = this.mounted;
    if (this.launch.id === "ocellus-p2") this.holdBladeDamage(boss);
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
      running: player.running,
    };
    const atTick = this.clockTick ?? 0;
    const step = advance(this.memory, this.launch.options, input, tick(atTick));
    this.memory = step.memory;
    this.mobility = bossMobility(step.memory, atTick);
    this.shownTick = atTick;
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

  snapshot(): Readonly<{ run: RaidRunView; boss: { npcId: number; hp: number; maxHp: number; visible: boolean; defence: number; x: number; y: number }; player: { hp: number } }> | null {
    if (!this.mounted) return null;
    const { boss, player } = this.mounted;
    return {
      run: this.runView(),
      boss: {
        npcId: barFor(this.launch).npcId,
        hp: boss.currentStats.hitpoint,
        maxHp: boss.stats.hitpoint,
        visible: true,
        defence: boss.currentStats.defence,
        x: boss.location.x,
        y: boss.location.y,
      },
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
    return this.lines.map((line) => line.text);
  }

  /** Climbs on every spoken line, including one that pushes an older line out of the eight-line window. */
  chatMark(): number {
    const last = this.lines[this.lines.length - 1];
    return last === undefined ? 0 : last.id;
  }

  /** The last lit volley. It stays up through the idle gap so the colour can be read without the chat. */
  portalCall(): PortalCall | null {
    return this.litCall;
  }

  fightLog(): Readonly<{ header: { seed: Seed }; rows: readonly Stamp[] }> {
    return { header: { seed: this.launch.options.seed }, rows: this.rows };
  }

  /** Hits on The Blade stay in `held` until a release. The bar shows only what has already been released. */
  private holdBladeDamage(boss: PracticeMob): void {
    const missing = Math.max(0, boss.stats.hitpoint - boss.currentStats.hitpoint);
    const fresh = missing - this.held - this.released;
    if (fresh > 0) this.held += fresh;
    boss.currentStats.hitpoint = boss.stats.hitpoint - this.released;
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
    this.mounted.fixtures.forEach((fixture) => this.applyBar(fixture, fixtureBar(fixture.label)));
    dress(this.mounted.player, this.launch.gear);
    this.memory = initialMemory(this.launch.id);
    this.clockTick = 0;
    this.rows = [];
    this.lines = [];
    this.litCall = null;
    this.run = { kind: "running" };
    this.held = 0;
    this.released = 0;
    this.spent = new Set();
    this.marks = [];
    this.shots = [];
    this.floor = [];
    this.portals = [];
    this.previous = ROOMS[this.launch.id].player;
    if (this.launch.id === "ocellus-p1" || this.launch.id === "ocellus-p2" || this.launch.id === "ocellus-p3") {
      this.say(`Demonbane weapons deal ${Math.round(DEMONBANE_RESISTANCE * 100)}% less against Ocellus.`);
    }
    if (this.launch.id === "ocellus-p1") this.say("Block the vines. The cyan tile is where to stand, and the red outline is the explosion.");
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
        if (event.name !== "repair" && event.text !== "") this.say(event.text);
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
        const half = Math.min(Math.floor(this.held / 2), Math.max(0, boss.stats.hitpoint - this.released - 1));
        this.released += half;
        this.held = 0;
        boss.currentStats.hitpoint = boss.stats.hitpoint - this.released;
        if (half > 0) landSplat(player, boss, half);
        this.say(`The Blade passes on ${half}.`);
        return;
      }
      case "boss-at": {
        const from = tile(boss.location.x, boss.location.y);
        const next = acceptBossStep(this.launch.id, from, event.tile, this.mobility);
        if (next.x !== from.x || next.y !== from.y) boss.stepped();
        boss.setLocation({ x: next.x, y: next.y });
        return;
      }
      case "add-at": {
        const add = this.mounted.adds[event.index];
        if (!add) return;
        const from = tile(add.location.x, add.location.y);
        const next = acceptAddStep(this.launch.id, from, event.tile, addMobility(this.launch.id, this.shownTick));
        if (next.x !== from.x || next.y !== from.y) add.stepped();
        add.setLocation({ x: next.x, y: next.y });
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
      case "portals":
        this.showPortals(event);
        return;
      case "mark":
        if ((event.text === "stand" || event.text.startsWith("stand-")) && !this.standHelper) return;
        if (event.text === "blast-outline" && !this.blastOutline) return;
        if (event.text === "tendril" || event.text === "vine") {
          this.showFloor(event.text, event.tiles, event.ticks);
          return;
        }
        (event.text === "cauldron" ? event.tiles.filter((at) => cauldronMayStand(at)) : event.tiles).forEach((at) => {
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
    this.floor.forEach((graphic) => {
      if (graphic.age()) this.removeEntity(graphic);
    });
    this.floor = this.floor.filter((graphic) => graphic.dying !== 0);
  }

  /** Phase 1 cracks and the slam's floor blast, on the walk floor. */
  private showFloor(text: "tendril" | "vine", tiles: readonly Tile[], ticks: number): void {
    const life = ticks + 1;
    if (text === "tendril") {
      crackCues(tiles).forEach((cue) => {
        const graphic = new FloorGraphic(this, { x: cue.at.x, y: cue.at.y });
        graphic.kind = "crack";
        graphic.spotAnim = cue.open;
        graphic.delay = cue.openDelay;
        graphic.loops = true;
        graphic.closeAnim = cue.close;
        graphic.closeDelay = cue.closeDelay;
        graphic.life = life;
        this.addEntity(graphic);
        this.floor.push(graphic);
      });
      return;
    }
    blastCuesOn(tiles).forEach((cue) => {
      const graphic = new FloorGraphic(this, { x: cue.at.x, y: cue.at.y });
      graphic.kind = "blast";
      graphic.spotAnim = cue.spotAnim;
      graphic.delay = cue.delay;
      graphic.loops = false;
      graphic.life = life;
      this.addEntity(graphic);
      this.floor.push(graphic);
    });
  }

  /** The 24 portals rise orange. A round paints its two arms purple except the orange gaps. */
  private showPortals(event: Extract<RaidEvent, { kind: "portals" }>): void {
    if (this.portals.length === 0) {
      this.portals = raisePortals(this);
      this.portals.forEach((portal) => this.addEntity(portal));
      this.say("Orange portals are the gap. Purple portals fire, and prayer does not block them.");
    }
    switch (event.look) {
      case "idle":
        idlePortals(this.portals);
        return;
      case "lit":
        this.litCall = { colour: event.colour, quadrant: event.quadrant };
        paintPortals(this.portals, event.quadrant, event.nsGap, event.ewGap);
        return;
      default: {
        const unhandled: never = event;
        return unhandled;
      }
    }
  }

  private launchShots(events: readonly Stamp[]): void {
    if (!this.mounted) return;
    const to = tile(this.mounted.player.location.x, this.mounted.player.location.y);
    const playerSize = this.mounted.player.size;
    events.forEach((stamp) => {
      if (stamp.event.kind !== "attack") return;
      shotLooks(this.launch, stamp.event.name).forEach((look) => {
        const actor = shotOrigin(this.mounted, look.from);
        if (!actor) return;
        const start = tile(actor.location.x, actor.location.y);
        const shot = new Shot(this, { x: start.x, y: start.y });
        shot.fly(start, actor.size, to, playerSize, look.paint, look.motion);
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
    const id = this.nextChatId;
    this.nextChatId += 1;
    this.lines.push({ id, text });
    if (this.lines.length > 8) this.lines.shift();
  }

  private describeShots(): void {
    switch (this.launch.id) {
      case "bork":
        this.say(`The bomb is graphic ${GRAPHICS.smorkBomb} from the Smorks. It waits 1 tick, then flies 4.5. Projectiles 4056 and 4057 have no captured source, so they are not drawn.`);
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
        this.say(`The volley is projectile ${GRAPHICS.p2Volley}. Repair particles ${GRAPHICS.p2Repair} play on the sword. The Blade stands still, because the captures record no animation.`);
        return;
      case "ocellus-p3":
        this.say(`The void shot is graphic ${GRAPHICS.p3Void} and the spin is ${GRAPHICS.p3Spin}. Ocellus has no captured death animation, so none plays. The vine's animations are a stand-in.`);
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

  private spawnFixtures(): PracticeMob[] {
    if (this.launch.id === "guardian") {
      return BATTERY_TILES.map((at) => {
        const battery = new PracticeMob(this, { x: at.x, y: at.y });
        battery.kind = "fixture";
        battery.label = "Guardian battery";
        battery.fill({ npcId: ARCHIVE.guardian.batteryNpcId, hp: 1, defence: 0, name: "Guardian battery", size: ARCHIVE.guardian.batterySize });
        return battery;
      });
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

function fixtureBar(name: string): Bar {
  if (name === "Guardian battery") return { npcId: ARCHIVE.guardian.batteryNpcId, hp: 1, defence: 0, name, size: ARCHIVE.guardian.batterySize };
  return { npcId: 0, hp: 1, defence: 0, name, size: 1 };
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

type ShotFrom = "boss" | "smorks";
type ShotLook = Readonly<{ motion: ShotMotion; paint: string; from: ShotFrom }>;

function shotOrigin(mounted: Mounted | null, from: ShotFrom): PracticeMob | undefined {
  if (!mounted) return undefined;
  switch (from) {
    case "boss":
      return mounted.boss;
    case "smorks":
      return mounted.adds.find((add) => add.label === "Smorks");
    default: {
      const unhandled: never = from;
      return unhandled;
    }
  }
}

function shotLooks(launch: RaidLaunch, name: string): readonly ShotLook[] {
  const drawn = (graphic: number, paint: string, from: ShotFrom = "boss"): ShotLook | null => {
    const record = shotByGraphic(graphic);
    if (!record) return null;
    return { motion: shotMotion(record), paint, from };
  };
  const one = (look: ShotLook | null): readonly ShotLook[] => (look === null ? [] : [look]);
  switch (launch.id) {
    case "bork":
      if (name === "bomb-tell") return one(drawn(GRAPHICS.smorkBomb, TYPELESS_SHOT, "smorks"));
      return [];
    case "ezekiel":
      return [];
    case "guardian":
      if (name === "14751") return one(drawn(GRAPHICS.guardianRanged, RANGED_SHOT));
      if (name === "beam") {
        return [
          { motion: wholeTickStandIn(launch.options.guardianBeamDelay, null), paint: MAGIC_SHOT, from: "boss" },
          { motion: heldStandIn(launch.options.guardianBeamDelay, GRAPHICS.guardianBeam), paint: TYPELESS_SHOT, from: "boss" },
        ];
      }
      if (name === "mushroom") return [{ motion: heldStandIn(ARCHIVE.guardian.mushroomArm, GRAPHICS.guardianMushroom), paint: TYPELESS_SHOT, from: "boss" }];
      return [];
    case "moia":
      if (name === "14785") return one(drawn(GRAPHICS.moiaRanged, RANGED_SHOT));
      if (name === "relocate") return one(drawn(GRAPHICS.moiaRelocate, MAGIC_SHOT));
      return [];
    case "xarth":
      if (name === "14984") return one(drawn(GRAPHICS.xarthMagic, MAGIC_SHOT));
      if (name === "14985") return one(drawn(GRAPHICS.xarthRanged, RANGED_SHOT));
      if (name === "14992") return one(drawn(GRAPHICS.xarthTell, TYPELESS_SHOT));
      return [];
    case "dagonhai":
      if (name === "14597") return one(drawn(GRAPHICS.dagonMagic, MAGIC_SHOT));
      if (name === "14593") return one(drawn(GRAPHICS.dagonRanged, RANGED_SHOT));
      if (name === "throw") return [{ motion: wholeTickStandIn(ARCHIVE.dagonhai.bookFlight, null), paint: TYPELESS_SHOT, from: "boss" }];
      return [];
    case "ocellus-p1":
      if (name === "4229" || name === "last-4229") return one(drawn(GRAPHICS.p1Magic, MAGIC_SHOT));
      if (name === "4232" || name === "last-4232") return one(drawn(GRAPHICS.p1Ranged, RANGED_SHOT));
      if (name === "4260") return [{ motion: heldStandIn(2, GRAPHICS.p1Glow), paint: TYPELESS_SHOT, from: "boss" }];
      if (name === "4261") return [{ motion: heldStandIn(2, GRAPHICS.p1Explode), paint: TYPELESS_SHOT, from: "boss" }];
      if (name === "14810") return [{ motion: wholeTickStandIn(ARCHIVE.p1.strikeFlight, null), paint: TYPELESS_SHOT, from: "boss" }];
      return [];
    case "ocellus-p2":
      if (name === "volley") return one(drawn(GRAPHICS.p2Volley, TYPELESS_SHOT));
      if (name === "repair") return [{ motion: heldStandIn(ARCHIVE.p2.repairEvery, GRAPHICS.p2Repair), paint: TYPELESS_SHOT, from: "boss" }];
      return [];
    case "ocellus-p3":
      if (name === "void-shot") return one(drawn(GRAPHICS.p3Void, TYPELESS_SHOT));
      if (name === "spin") return [{ motion: heldStandIn(ARCHIVE.p3.spinGraphicTicks, GRAPHICS.p3Spin), paint: TYPELESS_SHOT, from: "boss" }];
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
    case ARCHIVE.guardian.batteryNpcId:
    case ARCHIVE.p1.hoodedNpcId:
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
