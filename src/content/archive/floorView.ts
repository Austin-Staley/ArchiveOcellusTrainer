import * as THREE from "three";
import { CacheRenderInstancedModel, CacheRenderModel, CacheRenderReferences, CollisionType, Entity, LineOfSightMask, Settings } from "osrs-sdk";
import type { Location3, Model, Region, Renderable } from "osrs-sdk";
import type { Tile } from "../../sim/brands";
import type { Quadrant } from "./layout";
import { PORTAL_IDLE, PORTAL_ORANGE, PORTAL_PURPLE, portalLook, portalPlaces } from "./portals";
import type { PortalArm } from "./portals";

/** `delay` is in client cycles. A looping cue starts again as soon as it ends. */
type Cue = Readonly<{ spotAnim: number; delay: number; loops: boolean }>;

const sameCue = (left: Cue, right: Cue): boolean => left.spotAnim === right.spotAnim && left.delay === right.delay && left.loops === right.loops;

class Playing {
  ended = false;
  readonly model: CacheRenderInstancedModel;

  constructor(renderable: Renderable, readonly cue: Cue, delay: number) {
    this.model = CacheRenderInstancedModel.forRenderable(renderable, CacheRenderReferences.spotAnim([{ id: cue.spotAnim, delay }]), {
      onSpotAnimComplete: () => {
        this.ended = true;
      },
    });
  }
}

class FloorSpotModel implements Model {
  private playing: Playing | null = null;

  constructor(private readonly renderable: Renderable, private readonly cue: () => Cue) {}

  draw(scene: THREE.Scene, clockDelta: number, tickPercent: number, location: Location3, angleRadians: number, pitchRadians: number, visible: boolean, modelOffsets: Location3[]): void {
    const cue = this.cue();
    const replay = this.playing !== null && sameCue(this.playing.cue, cue) && this.playing.ended && cue.loops;
    if (this.playing !== null && (!sameCue(this.playing.cue, cue) || replay)) {
      this.playing.model.destroy(scene);
      this.playing = null;
    }
    if (this.playing === null) this.playing = new Playing(this.renderable, cue, replay ? 0 : cue.delay);
    this.playing.model.draw(scene, clockDelta, tickPercent, location, 0, pitchRadians, visible, modelOffsets);
  }

  destroy(scene: THREE.Scene): void {
    this.playing?.model.destroy(scene);
  }

  getWorldPosition(): THREE.Vector3 {
    return this.playing?.model.getWorldPosition() ?? new THREE.Vector3();
  }

  async preload(): Promise<void> {}
}

/** One floor tile of a phase 1 crack or blast, on plane 1's walk floor. */
export class FloorGraphic extends Entity {
  kind: "crack" | "blast" = "crack";
  life = 1;
  spotAnim = 0;
  delay = 0;
  loops = true;
  closeAnim = 0;
  closeDelay = 0;
  private closing = false;

  override get size(): number {
    return 1;
  }

  override entityName(): string {
    return this.kind === "crack" ? `Crack ${this.spotAnim}` : `Blast ${this.spotAnim}`;
  }

  override get color(): string {
    return this.kind === "crack" ? "#3d8f4a" : "#c45b28";
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

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    void tickPercent;
    const scale = Settings.tileSize;
    context.fillStyle = this.color;
    context.globalAlpha = 0.55;
    context.fillRect(this.location.x * scale, this.location.y * scale, scale, scale);
    context.globalAlpha = 1;
  }

  /** Ages one tick. A crack plays its end piece once the open life runs out. */
  age(): boolean {
    this.life -= 1;
    if (this.life > 0) return false;
    if (this.kind === "crack" && !this.closing) {
      this.closing = true;
      this.spotAnim = this.closeAnim;
      this.delay = this.closeDelay;
      this.loops = false;
      this.life = 4;
      return false;
    }
    this.dying = 0;
    return true;
  }

  protected override create3dModel(): Model {
    return new FloorSpotModel(this, () => ({ spotAnim: this.spotAnim, delay: this.delay, loops: this.loops }));
  }
}

const ORANGE = "#e07a20";
const PURPLE = "#7a4ec8";

/** One 2×1 portal. Orange while idle or a gap, purple while that arm is lit. Animation 14830 loops on both models. */
export class PortalGraphic extends Entity {
  lit = false;
  readonly arm: PortalArm;
  readonly index: number;
  private readonly footprint: readonly [Tile, Tile];
  private readonly yaw: number;

  constructor(region: Region, arm: PortalArm, index: number, footprint: readonly [Tile, Tile], yaw: number) {
    super(region, { x: footprint[0].x, y: footprint[0].y });
    this.arm = arm;
    this.index = index;
    this.footprint = footprint;
    this.yaw = yaw;
  }

  override get size(): number {
    return 1;
  }

  override get animationIndex(): number {
    return PORTAL_IDLE;
  }

  override entityName(): string {
    return `Portal ${this.lit ? "purple" : "orange"} ${this.arm} ${this.index}`;
  }

  override get color(): string {
    return this.lit ? PURPLE : ORANGE;
  }

  override get selectable(): boolean {
    return false;
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

  show(lit: boolean): void {
    if (this.lit === lit) return;
    this.lit = lit;
    this.invalidateModel();
  }

  override draw(tickPercent: number, context: OffscreenCanvasRenderingContext2D): void {
    void tickPercent;
    const scale = Settings.tileSize;
    context.fillStyle = this.color;
    context.globalAlpha = 0.7;
    this.footprint.forEach((at) => context.fillRect(at.x * scale, at.y * scale, scale, scale));
    context.globalAlpha = 1;
  }

  override getPerceivedRotation(): number {
    return this.yaw;
  }

  override getPerceivedLocation(tickPercent: number): { x: number; y: number; z: number } {
    void tickPercent;
    const [a, b] = this.footprint;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 };
  }

  protected override create3dModel(): Model {
    return CacheRenderModel.forRenderable(this, CacheRenderReferences.model(this.lit ? PORTAL_PURPLE : PORTAL_ORANGE));
  }
}

export function raisePortals(region: Region): readonly PortalGraphic[] {
  return portalPlaces().map((place) => new PortalGraphic(region, place.arm, place.index, place.tiles, place.yaw));
}

export function paintPortals(portals: readonly PortalGraphic[], quadrant: Quadrant, nsGap: number, ewGap: number): void {
  portals.forEach((portal) => portal.show(portalLook(portal.arm, portal.index, quadrant, nsGap, ewGap) === "purple"));
}

export function idlePortals(portals: readonly PortalGraphic[]): void {
  portals.forEach((portal) => portal.show(false));
}
