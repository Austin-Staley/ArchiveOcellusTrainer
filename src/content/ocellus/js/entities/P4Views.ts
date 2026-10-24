import * as THREE from "three";
import { CacheRenderInstancedModel, CacheRenderModel, CacheRenderReferences, CollisionType, Entity, GROUND_OVERLAY_Y, LineOfSightMask, Settings } from "osrs-sdk";
import type { Location3, Model, Region, Renderable, Unit } from "osrs-sdk";
import { spriteFile } from "../../../../assets";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Tile } from "../../../../sim/brands";
import type { BossOverhead, Special, Stage, VoidKind } from "../P4Types";
import type { Side } from "../../../../sim/tiles";
import { TileSet, beside } from "../../../../sim/tiles";
import { VOID_MASKS, floodedHalves } from "../p4/floor";

const LOOK = OCELLUS_P4.floor.look.value;
const RIM_DEPTH = 0.18;
const RIM_HEIGHT = 0.15;
const STAR_TILES = 4;
const STAR_PX_PER_TILE = 32;

type Point = Readonly<{ x: number; z: number }>;
type Edge = Readonly<{ at: Tile; side: Side; from: Point; to: Point; inward: Point }>;
type Rim = Readonly<{ from: Point; to: Point; inward: Point }>;

/** Tile (x, y) spans world x to x + 1 and z from y - 1 to y; lower y is north. */
export function rimEdges(mask: TileSet): readonly Edge[] {
  return mask.border().map(({ at, side }): Edge => {
    const { x, y } = at;
    switch (side) {
      case "north":
        return { at, side, from: { x, z: y - 1 }, to: { x: x + 1, z: y - 1 }, inward: { x: 0, z: 1 } };
      case "south":
        return { at, side, from: { x, z: y }, to: { x: x + 1, z: y }, inward: { x: 0, z: -1 } };
      case "west":
        return { at, side, from: { x, z: y - 1 }, to: { x, z: y }, inward: { x: 1, z: 0 } };
      case "east":
        return { at, side, from: { x: x + 1, z: y - 1 }, to: { x: x + 1, z: y }, inward: { x: -1, z: 0 } };
      default: {
        const unhandled: never = side;
        return unhandled;
      }
    }
  });
}

function voidRim(mask: TileSet): readonly Rim[] {
  const halves = floodedHalves(mask);
  const flooded = TileSet.at(halves.map(({ at }) => at));
  const cuts = halves.map(({ cut: [from, to], floorCorner }): Rim => {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const length = Math.hypot(floorCorner.x - mid.x, floorCorner.y - mid.y);
    return { from: { x: from.x, z: from.y - 1 }, to: { x: to.x, z: to.y - 1 }, inward: { x: (floorCorner.x - mid.x) / length, z: (floorCorner.y - mid.y) / length } };
  });
  return [...rimEdges(mask).filter(({ at, side }) => !flooded.contains(beside(at, side))), ...cuts];
}

function starfield(): THREE.Texture {
  const size = STAR_TILES * STAR_PX_PER_TILE;
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = LOOK.void;
    context.fillRect(0, 0, size, size);
    context.fillStyle = LOOK.stars;
    let state = 0x2545f491;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    for (let star = 0; star < 6 * STAR_TILES * STAR_TILES; star++) {
      context.globalAlpha = 0.35 + 0.65 * next();
      context.fillRect(Math.floor(next() * size), Math.floor(next() * size), next() < 0.2 ? 2 : 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function floorGeometry(mask: TileSet): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const corner = (cx: number, cz: number) => {
    positions.push(cx, GROUND_OVERLAY_Y, cz);
    uvs.push(cx / STAR_TILES, cz / STAR_TILES);
  };
  for (const { x, y } of mask.tiles()) {
    for (const [cx, cz] of [[x, y - 1], [x + 1, y], [x + 1, y - 1], [x, y - 1], [x, y], [x + 1, y]]) corner(cx, cz);
  }
  for (const { floorCorner, cut } of floodedHalves(mask)) {
    for (const { x, y } of [floorCorner, ...cut]) corner(x, y - 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

type Vertex = readonly [number, number, number];
type Segment = Readonly<{ from: Vertex; to: Vertex }>;

function rimGeometry(mask: TileSet): THREE.BufferGeometry {
  const rim = new THREE.Color(LOOK.rim);
  const positions: number[] = [];
  const colors: number[] = [];
  const lit = (at: Vertex) => {
    positions.push(...at);
    colors.push(rim.r, rim.g, rim.b);
  };
  const dark = (at: Vertex) => {
    positions.push(...at);
    colors.push(0, 0, 0);
  };
  const fadeFromEdge = (edge: Segment, far: Segment) => {
    lit(edge.from);
    lit(edge.to);
    dark(far.to);
    lit(edge.from);
    dark(far.to);
    dark(far.from);
  };
  const floor = GROUND_OVERLAY_Y;
  for (const { from, to, inward } of voidRim(mask)) {
    const edge: Segment = { from: [from.x, floor, from.z], to: [to.x, floor, to.z] };
    const stripInside: Segment = {
      from: [from.x + inward.x * RIM_DEPTH, floor, from.z + inward.z * RIM_DEPTH],
      to: [to.x + inward.x * RIM_DEPTH, floor, to.z + inward.z * RIM_DEPTH],
    };
    const wallTop: Segment = { from: [from.x, floor + RIM_HEIGHT, from.z], to: [to.x, floor + RIM_HEIGHT, to.z] };
    fadeFromEdge(edge, stripInside);
    fadeFromEdge(edge, wallTop);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

class VoidFloorModel implements Model {
  private readonly group = new THREE.Group();
  private readonly layers = new Map<VoidKind, THREE.Group>();
  private readonly owned: { dispose(): void }[] = [];
  private stars: THREE.Texture | null = null;

  constructor(private readonly showing: () => VoidKind | null) {}

  draw(scene: THREE.Scene, clockDelta: number, tickPercent: number, location: Location3, angleRadians: number, pitchRadians: number, visible: boolean): void {
    if (this.group.parent !== scene) scene.add(this.group);
    const kind = this.showing();
    if (kind !== null && !this.layers.has(kind)) this.layers.set(kind, this.build(VOID_MASKS[kind]));
    this.layers.forEach((layer, layerKind) => {
      layer.visible = visible && layerKind === kind;
    });
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.owned.forEach((resource) => resource.dispose());
  }

  getWorldPosition(): THREE.Vector3 {
    return this.group.getWorldPosition(new THREE.Vector3());
  }

  async preload(): Promise<void> {}

  private build(mask: TileSet): THREE.Group {
    if (this.stars === null) {
      this.stars = starfield();
      this.owned.push(this.stars);
    }
    const floorMaterial = new THREE.MeshBasicMaterial({ map: this.stars, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const rimMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const floor = floorGeometry(mask);
    const rim = rimGeometry(mask);
    this.owned.push(floorMaterial, rimMaterial, floor, rim);
    const layer = new THREE.Group();
    layer.add(new THREE.Mesh(floor, floorMaterial), new THREE.Mesh(rim, rimMaterial));
    this.group.add(layer);
    return layer;
  }
}

export class VoidField extends Entity {
  private showing: VoidKind | null = null;

  constructor(region: Region) {
    super(region, { x: 0, y: 0 });
  }

  show(kind: VoidKind | null): void {
    this.showing = kind;
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    if (this.showing === null) return;
    const mask = VOID_MASKS[this.showing];
    const scale = Settings.tileSize;
    context.fillStyle = LOOK.void;
    for (const { x, y } of mask.tiles()) context.fillRect(x * scale, y * scale, scale, scale);
    for (const { floorCorner, cut: [from, to] } of floodedHalves(mask)) {
      context.beginPath();
      context.moveTo(floorCorner.x * scale, floorCorner.y * scale);
      context.lineTo(from.x * scale, from.y * scale);
      context.lineTo(to.x * scale, to.y * scale);
      context.closePath();
      context.fill();
    }
    context.strokeStyle = LOOK.rim;
    context.lineWidth = 2;
    context.beginPath();
    for (const { from, to } of voidRim(mask)) {
      context.moveTo(from.x * scale, (from.z + 1) * scale);
      context.lineTo(to.x * scale, (to.z + 1) * scale);
    }
    context.stroke();
  }

  protected override create3dModel(): Model {
    return new VoidFloorModel(() => this.showing);
  }
}

const HOLES = OCELLUS_P4.floorHoles;

export class FloorHole extends Entity {
  private covered = false;

  constructor(region: Region, at: Tile) {
    super(region, { x: at.x, y: at.y });
  }

  cover(floor: VoidKind | null): void {
    this.covered = floor === HOLES.hiddenUnder.value;
  }

  override visible(): boolean {
    return !this.covered;
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  override get drawOutline(): boolean {
    return false;
  }

  override get animationIndex(): number {
    return HOLES.look.idle.value;
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    if (!this.visible()) return;
    const scale = Settings.tileSize;
    const { x, y } = this.location;
    context.fillStyle = LOOK.rim;
    context.fillRect((x + 0.1) * scale, (y + 0.1) * scale, 0.8 * scale, 0.8 * scale);
    context.fillStyle = LOOK.void;
    context.fillRect((x + 0.2) * scale, (y + 0.2) * scale, 0.6 * scale, 0.6 * scale);
  }

  protected override create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.model(HOLES.look.model.value));
  }
}

const ORB_LOOK = OCELLUS_P4.lifeforceOrb.look;
const ORB_MARKER = OCELLUS_P4.lifeforceOrb.marker.value;
const SPAWN_LOOK: Readonly<Record<VoidKind, number>> = { "inner-void": ORB_LOOK.innerSpawn.value, "outer-void": ORB_LOOK.outerSpawn.value };

type Cue = Readonly<{ spotAnim: number; loops: boolean }>;

class Playing {
  ended = false;
  readonly model: CacheRenderInstancedModel;

  constructor(renderable: Renderable, readonly cue: Cue) {
    this.model = CacheRenderInstancedModel.forRenderable(renderable, CacheRenderReferences.spotAnim([{ id: cue.spotAnim }]), {
      onSpotAnimComplete: () => {
        this.ended = true;
      },
    });
  }
}

/** The SDK plays a cache spotanim once, so a looping cue gets a fresh instance each time one ends. */
class SpotAnimModel implements Model {
  private playing: Playing | null = null;

  constructor(private readonly renderable: Renderable, private readonly cue: () => Cue | null) {}

  draw(scene: THREE.Scene, clockDelta: number, tickPercent: number, location: Location3, angleRadians: number, pitchRadians: number, visible: boolean, modelOffsets: Location3[]): void {
    const cue = this.cue();
    if (this.playing !== null && (this.playing.cue !== cue || (this.playing.ended && this.playing.cue.loops))) {
      this.playing.model.destroy(scene);
      this.playing = null;
    }
    if (this.playing === null && cue !== null) this.playing = new Playing(this.renderable, cue);
    this.playing?.model.draw(scene, clockDelta, tickPercent, location, angleRadians, pitchRadians, visible, modelOffsets);
  }

  destroy(scene: THREE.Scene): void {
    this.playing?.model.destroy(scene);
  }

  getWorldPosition(): THREE.Vector3 {
    return this.playing?.model.getWorldPosition() ?? new THREE.Vector3();
  }

  async preload(): Promise<void> {}
}

export class OrbView extends Entity {
  private shown: Readonly<{ cue: Cue; marker: string | null }> | null = null;

  constructor(region: Region) {
    super(region, { x: 0, y: 0 });
  }

  spawn(kind: VoidKind, at: Tile): void {
    this.location = { x: at.x, y: at.y };
    this.shown = { cue: { spotAnim: SPAWN_LOOK[kind], loops: false }, marker: ORB_MARKER.dormant };
  }

  mature(): void {
    this.shown = { cue: { spotAnim: ORB_LOOK.idle.value, loops: true }, marker: ORB_MARKER.ready };
  }

  leave(): void {
    this.shown = { cue: { spotAnim: ORB_LOOK.despawn.value, loops: false }, marker: null };
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    if (!this.shown?.marker) return;
    const scale = Settings.tileSize;
    context.fillStyle = this.shown.marker;
    context.beginPath();
    context.arc((this.location.x + 0.5) * scale, (this.location.y + 0.5) * scale, scale / 3, 0, 2 * Math.PI);
    context.fill();
  }

  protected override create3dModel(): Model {
    return new SpotAnimModel(this, () => this.shown?.cue ?? null);
  }
}

const SHARD_COLOUR = OCELLUS_P4.explosion.shards.value;
const MARK = OCELLUS_P4.explosion.look.value;
const SHARDS = 7;
const SHARD_HALF_WIDTH = 0.05;
const SHARD_HEIGHT = 0.85;
const GLOW_LIFT = 0.02;
const DUST_LIFT = 0.15;
const SPRITE_PX = 64;
const FALLOFF: readonly (readonly [distance: number, alpha: number])[] = [[0, 1], [0.6, 0.85], [1, 0]];

type Blast = "marked" | "detonated";
type Shape = (x: number, y: number) => number;
type BurstPose = Readonly<{
  shardRadius: number;
  shardLean: number;
  shardOpacity: number;
  glowOpacity: number;
  glowScale: number;
  dustOpacity: number;
  dustScale: number;
}>;

const HEXAGON: Shape = (x, y) => Math.max(Math.abs(y), 0.866 * Math.abs(x) + 0.5 * Math.abs(y)) / 0.866;
const DISC: Shape = (x, y) => Math.hypot(x, y);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const along = ([from, to]: readonly [from: number, to: number], t: number) => lerp(from, to, t);

function falloff(distance: number): number {
  for (let stop = 1; stop < FALLOFF.length; stop++) {
    const [near, nearAlpha] = FALLOFF[stop - 1];
    const [far, farAlpha] = FALLOFF[stop];
    if (distance <= far) return lerp(nearAlpha, farAlpha, (distance - near) / (far - near));
  }
  return 0;
}

function sprite(colour: string, shape: Shape): OffscreenCanvas {
  const canvas = new OffscreenCanvas(SPRITE_PX, SPRITE_PX);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const rgb = parseInt(colour.slice(1), 16);
  const image = context.createImageData(SPRITE_PX, SPRITE_PX);
  for (let py = 0; py < SPRITE_PX; py++) {
    for (let px = 0; px < SPRITE_PX; px++) {
      const at = 4 * (py * SPRITE_PX + px);
      const half = SPRITE_PX / 2;
      image.data.set([rgb >> 16, (rgb >> 8) & 255, rgb & 255, Math.round(255 * falloff(shape((px + 0.5 - half) / half, (py + 0.5 - half) / half)))], at);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function spriteTexture(colour: string, shape: Shape): THREE.Texture {
  const texture = new THREE.CanvasTexture(sprite(colour, shape));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function burstPose(blast: Blast, t: number): BurstPose {
  switch (blast) {
    case "marked": {
      const { mark } = MARK;
      const converge = clamp01(t / mark.glowFrom);
      const glow = clamp01((t - mark.glowFrom) / mark.glowRamp);
      return {
        shardRadius: along(mark.shardRadius, converge),
        shardLean: along(mark.shardLean, converge),
        shardOpacity: Math.min(clamp01(t / mark.shardsFadeIn), 1 - glow),
        glowOpacity: MARK.glowOpacity * glow,
        glowScale: along(mark.glowScale, glow),
        dustOpacity: 0,
        dustScale: 1,
      };
    }
    case "detonated": {
      const { impact } = MARK;
      const burst = 1 - (1 - t) ** 2;
      return {
        shardRadius: along(impact.shardRadius, burst),
        shardLean: along(impact.shardLean, burst),
        shardOpacity: 1 - t,
        glowOpacity: MARK.glowOpacity * clamp01(1 - t / impact.glowFadeOut),
        glowScale: along(impact.glowScale, t),
        dustOpacity: MARK.dustOpacity * (1 - t),
        dustScale: along(impact.dustScale, burst),
      };
    }
    default: {
      const unhandled: never = blast;
      return unhandled;
    }
  }
}

function shardGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -SHARD_HALF_WIDTH, 0, 0, SHARD_HALF_WIDTH, 0, SHARD_HEIGHT, 0], 3));
  return geometry;
}

function groundSprite(texture: THREE.Texture, tiles: number, lift: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.PlaneGeometry(tiles, tiles).rotateX(-Math.PI / 2).translate(0, lift, 0);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
}

class BurstModel implements Model {
  private readonly group = new THREE.Group();
  private readonly shardMaterial = new THREE.MeshBasicMaterial({ color: SHARD_COLOUR, side: THREE.DoubleSide, transparent: true });
  private readonly shards: THREE.Mesh[] = [];
  private readonly glowMap = spriteTexture(MARK.glow, HEXAGON);
  private readonly dustMap = spriteTexture(MARK.dust, DISC);
  private readonly glow = groundSprite(this.glowMap, MARK.glowTiles, GLOW_LIFT);
  private readonly dust = groundSprite(this.dustMap, MARK.dustTiles, DUST_LIFT);
  private readonly owned: { dispose(): void }[] = [];

  constructor(private readonly blast: () => Blast) {
    const blade = shardGeometry();
    for (let shard = 0; shard < SHARDS; shard++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (2 * Math.PI * shard) / SHARDS;
      const mesh = new THREE.Mesh(blade, this.shardMaterial);
      pivot.add(mesh);
      this.shards.push(mesh);
      this.group.add(pivot);
    }
    this.group.add(this.glow, this.dust);
    this.owned.push(blade, this.shardMaterial, this.glowMap, this.dustMap, this.glow.geometry, this.glow.material, this.dust.geometry, this.dust.material);
  }

  draw(scene: THREE.Scene, clockDelta: number, tickPercent: number, location: Location3, angleRadians: number, pitchRadians: number, visible: boolean): void {
    if (this.group.parent !== scene) scene.add(this.group);
    const pose = burstPose(this.blast(), tickPercent);
    this.group.visible = visible;
    this.group.position.set(location.x + 0.5, GROUND_OVERLAY_Y, location.y - 0.5);
    for (const shard of this.shards) {
      shard.position.x = pose.shardRadius;
      shard.rotation.z = pose.shardLean;
    }
    this.shardMaterial.opacity = pose.shardOpacity;
    this.glow.material.opacity = pose.glowOpacity;
    this.glow.scale.setScalar(pose.glowScale);
    this.dust.material.opacity = pose.dustOpacity;
    this.dust.scale.setScalar(pose.dustScale);
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.owned.forEach((resource) => resource.dispose());
  }

  getWorldPosition(): THREE.Vector3 {
    return this.group.getWorldPosition(new THREE.Vector3());
  }

  async preload(): Promise<void> {}
}

let markSprite: OffscreenCanvas | null = null;

class ExplosionView extends Entity {
  private blast: Blast = "marked";

  constructor(region: Region, at: Tile) {
    super(region, { x: at.x, y: at.y });
  }

  detonate(): void {
    this.blast = "detonated";
  }

  override tick(): void {
    if (this.blast === "detonated") this.dying = 0;
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    if (this.blast !== "marked") return;
    const scale = Settings.tileSize;
    const pose = burstPose("marked", tickPercent);
    const [cx, cy] = [(this.location.x + 0.5) * scale, (this.location.y + 0.5) * scale];
    const radius = (MARK.glowTiles / 2) * scale;
    const shard = MARK.shardTiles2d * scale;
    markSprite ??= sprite(MARK.glow, HEXAGON);
    context.save();
    context.globalAlpha = pose.glowOpacity;
    context.drawImage(markSprite, cx - radius, cy - radius, 2 * radius, 2 * radius);
    context.globalAlpha = pose.shardOpacity;
    context.fillStyle = SHARD_COLOUR;
    for (let at = 0; at < SHARDS; at++) {
      const angle = (2 * Math.PI * at) / SHARDS;
      context.fillRect(cx + Math.cos(angle) * pose.shardRadius * scale - shard / 2, cy + Math.sin(angle) * pose.shardRadius * scale - shard / 2, shard, shard);
    }
    context.restore();
  }

  protected override create3dModel(): Model {
    return new BurstModel(() => this.blast);
  }
}

export class ExplosionViews {
  private readonly live = new Map<string, ExplosionView>();

  constructor(private readonly region: Region) {}

  mark(kind: VoidKind, pulse: number, at: Tile): void {
    const view = new ExplosionView(this.region, at);
    this.region.addEntity(view);
    this.live.set(`${kind}:${pulse}`, view);
  }

  detonate(kind: VoidKind, pulse: number): void {
    this.live.get(`${kind}:${pulse}`)?.detonate();
    this.live.delete(`${kind}:${pulse}`);
  }
}

export class FragmentFlash extends Entity {
  private cue: Cue | null = null;

  constructor(region: Region) {
    super(region, { x: 0, y: 0 });
  }

  tell(at: Tile): void {
    this.play(at, ORB_LOOK.tell.value);
  }

  regain(at: Tile): void {
    this.play(at, ORB_LOOK.regain.value);
  }

  private play(at: Tile, spotAnim: number): void {
    this.location = { x: at.x, y: at.y };
    this.cue = { spotAnim, loops: false };
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.NONE;
  }

  override draw(): void {}

  protected override create3dModel(): Model {
    return new SpotAnimModel(this, () => this.cue);
  }
}

const { bossPoses, transitionTells, tellCentre, overheadIcons, overheadIconBelowHpBar } = OCELLUS_P4.presentation;
const OVERHEAD_ICONS = new Map<BossOverhead, HTMLImageElement>();

export function drawOverheadIcon(context: OffscreenCanvasRenderingContext2D, scale: number, overhead: BossOverhead): void {
  let icon = OVERHEAD_ICONS.get(overhead);
  if (!icon) {
    icon = new Image();
    icon.src = `osrs-assets/${spriteFile(overheadIcons[overhead].value)}`;
    OVERHEAD_ICONS.set(overhead, icon);
  }
  if (icon.complete && icon.naturalWidth > 0) context.drawImage(icon, -scale / 2, overheadIconBelowHpBar.value, scale, scale);
}

const HEAL_SPLAT_SLOTS: readonly Readonly<{ x: number; y: number }>[] = [{ x: 0, y: 30 }, { x: -18, y: 20 }, { x: 18, y: 20 }];

/** Drawn like the SDK's own hitsplats, in the slots its damage splats use last. */
export function drawHealSplats(context: OffscreenCanvasRenderingContext2D, image: HTMLImageElement, amounts: readonly number[], verticalOffset: number): void {
  amounts.slice(0, HEAL_SPLAT_SLOTS.length).forEach((amount, slot) => {
    const { x, y } = HEAL_SPLAT_SLOTS[slot];
    context.drawImage(image, x - 11, verticalOffset - y - 1, 24, 23);
    context.font = "16px Stats_11";
    context.textAlign = "center";
    context.fillStyle = "#000000";
    context.fillText(String(amount), x + 1, verticalOffset - y + 16);
    context.fillStyle = "#FFFFFF";
    context.fillText(String(amount), x, verticalOffset - y + 15);
    context.textAlign = "left";
  });
}

export class PlayerLook {
  constructor(private readonly player: Unit) {}

  riftBurst(): void {
    this.player.addSpotAnim({ id: OCELLUS_P4.rifts.burstFlare.value, channel: "rift-burst" });
  }
}

export class BossLook {
  constructor(private readonly boss: Unit) {}

  enter(stage: Stage): void {
    switch (stage) {
      case "inner-void":
        this.boss.playAnimation(bossPoses.deflectIn.value);
        return;
      case "lead-in":
      case "after-inner":
      case "outer-void":
      case "after-outer":
        return;
      default: {
        const unhandled: never = stage;
        return unhandled;
      }
    }
  }

  land(): void {
    this.boss.playAnimation(bossPoses.deflectOut.value);
  }

  tell(variant: Special): void {
    const { faceColour, rgb } = tellCentre.value;
    this.boss.playAnimation(bossPoses.meleeHybrid.value);
    this.boss.addSpotAnim({ id: transitionTells[variant].value, channel: "transition-tell", recolor: { [faceColour]: rgb } });
  }
}
