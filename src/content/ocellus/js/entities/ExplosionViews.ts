import { CollisionType, Entity, LineOfSightMask, Settings } from "osrs-sdk";
import type { Model, Region, UILayerProjector } from "osrs-sdk";
import { OCELLUS_P4 } from "../OcellusTimings";
import type { Tile } from "../../../../sim/brands";
import type { RenderView, VoidKind } from "../P4Types";
import { SpotAnimModel } from "./P4Views";

const SHARD_COLOUR = OCELLUS_P4.explosion.shards.value;
const LOOK = OCELLUS_P4.explosion.look.value;
const CUE = { spotAnim: OCELLUS_P4.explosion.spotAnim.value, loops: false } as const;
const SHARDS = 7;
const SPRITE_PX = 64;
const FALLOFF: readonly (readonly [distance: number, alpha: number])[] = [[0, 1], [0.6, 0.85], [1, 0]];

type Blast = "marked" | "detonated";
type MarkPose = Readonly<{ shardRadius: number; shardOpacity: number; glowOpacity: number }>;

const HEXAGON = (x: number, y: number) => Math.max(Math.abs(y), 0.866 * Math.abs(x) + 0.5 * Math.abs(y)) / 0.866;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

function falloff(distance: number): number {
  for (let stop = 1; stop < FALLOFF.length; stop++) {
    const [near, nearAlpha] = FALLOFF[stop - 1];
    const [far, farAlpha] = FALLOFF[stop];
    if (distance <= far) return lerp(nearAlpha, farAlpha, (distance - near) / (far - near));
  }
  return 0;
}

function glowSprite(): OffscreenCanvas {
  const canvas = new OffscreenCanvas(SPRITE_PX, SPRITE_PX);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const rgb = parseInt(LOOK.glow.slice(1), 16);
  const image = context.createImageData(SPRITE_PX, SPRITE_PX);
  for (let py = 0; py < SPRITE_PX; py++) {
    for (let px = 0; px < SPRITE_PX; px++) {
      const at = 4 * (py * SPRITE_PX + px);
      const half = SPRITE_PX / 2;
      image.data.set([rgb >> 16, (rgb >> 8) & 255, rgb & 255, Math.round(255 * falloff(HEXAGON((px + 0.5 - half) / half, (py + 0.5 - half) / half)))], at);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function markPose(t: number): MarkPose {
  const glow = clamp01((t - LOOK.glowFrom) / LOOK.glowRamp);
  return {
    shardRadius: lerp(...LOOK.shardRadius, clamp01(t / LOOK.glowFrom)),
    shardOpacity: Math.min(clamp01(t / LOOK.shardsFadeIn), 1 - glow),
    glowOpacity: LOOK.glowOpacity * glow,
  };
}

let markSprite: OffscreenCanvas | null = null;

class ExplosionView extends Entity {
  private blast: Blast = "marked";

  constructor(region: Region, at: Tile, private readonly view: RenderView) {
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
    const radius = (LOOK.glowTiles / 2) * scale;
    markSprite ??= glowSprite();
    context.save();
    context.globalAlpha = markPose(tickPercent).glowOpacity;
    context.drawImage(markSprite, (this.location.x + 0.5) * scale - radius, (this.location.y + 0.5) * scale - radius, 2 * radius, 2 * radius);
    context.restore();
  }

  override drawUILayer(tickPercent: number, projector: UILayerProjector, context: OffscreenCanvasRenderingContext2D, scale: number): void {
    if (this.blast !== "marked" || this.view === "3d") return;
    const pose = markPose(tickPercent);
    const [cx, cy] = [(this.location.x + 0.5) * scale, (this.location.y + 0.5) * scale];
    const shard = LOOK.shardTiles * scale;
    context.save();
    context.globalAlpha = pose.shardOpacity;
    context.fillStyle = SHARD_COLOUR;
    for (let at = 0; at < SHARDS; at++) {
      const angle = (2 * Math.PI * at) / SHARDS;
      context.fillRect(cx + Math.cos(angle) * pose.shardRadius * scale - shard / 2, cy + Math.sin(angle) * pose.shardRadius * scale - shard / 2, shard, shard);
    }
    context.restore();
  }

  protected override create3dModel(): Model {
    return new SpotAnimModel(this, () => CUE);
  }
}

export class ExplosionViews {
  private readonly live = new Map<string, ExplosionView>();

  constructor(private readonly region: Region, private readonly view: RenderView) {}

  mark(kind: VoidKind, pulse: number, at: Tile): void {
    const view = new ExplosionView(this.region, at, this.view);
    this.region.addEntity(view);
    this.live.set(`${kind}:${pulse}`, view);
  }

  detonate(kind: VoidKind, pulse: number): void {
    this.live.get(`${kind}:${pulse}`)?.detonate();
    this.live.delete(`${kind}:${pulse}`);
  }

  retire(): void {
    this.live.forEach((view) => {
      view.dying = 0;
    });
    this.live.clear();
  }
}
