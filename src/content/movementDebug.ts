import { TileMarker } from "osrs-sdk";
import type { Region } from "osrs-sdk";
import type { Tile } from "../sim/brands";

export type Mobility = "stationary" | "mobile";

export type BossMovement = Readonly<{
  mobility: Mobility;
  tick: number;
  actor: string;
}>;

/** A region that can tint its boss's walkable tiles and report this tick's mobility. */
export type MovementDebug = {
  showBossMovement(on: boolean): void;
  bossMovement(): BossMovement | null;
};

const TINT = "#3d7ec8";

export function movementDebug(value: object): MovementDebug | null {
  if (!isMovementDebug(value)) return null;
  return value;
}

function isMovementDebug(value: object): value is MovementDebug {
  if (!("showBossMovement" in value) || !("bossMovement" in value)) return false;
  const show: unknown = value.showBossMovement;
  const read: unknown = value.bossMovement;
  return typeof show === "function" && typeof read === "function";
}

/** Blue tile markers for the 3D view, and the same tint on the 2D floor. */
export class WalkTint {
  private on = false;
  private marks: TileMarker[] = [];

  constructor(
    private readonly region: Region,
    private readonly tiles: () => readonly Tile[],
  ) {}

  show(on: boolean): void {
    this.on = on;
    this.repaint();
  }

  /** Drop marker refs after the region has already cleared its entities. */
  forget(): void {
    this.marks = [];
  }

  repaint(): void {
    this.marks.forEach((mark) => this.region.removeEntity(mark));
    this.marks = [];
    if (!this.on) return;
    this.marks = this.tiles().map((at) => new TileMarker(this.region, { x: at.x, y: at.y }, TINT, 1, false));
    this.marks.forEach((mark) => this.region.addEntity(mark));
  }

  paint(context: OffscreenCanvasRenderingContext2D, scale: number): void {
    if (!this.on) return;
    context.save();
    context.globalAlpha = 0.28;
    context.fillStyle = TINT;
    this.tiles().forEach((at) => context.fillRect(at.x * scale, at.y * scale, scale, scale));
    context.restore();
  }
}
