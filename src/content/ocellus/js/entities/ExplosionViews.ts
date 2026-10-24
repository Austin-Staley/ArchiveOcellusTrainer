import * as THREE from "three";
import { CollisionType, Entity, GROUND_OVERLAY_Y, LineOfSightMask, Settings } from "osrs-sdk";
import type { Location3, Model, Region } from "osrs-sdk";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Tile } from "../../../../sim/brands";
import type { VoidKind } from "../P4Types";

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
