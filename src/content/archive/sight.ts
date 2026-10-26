import * as THREE from "three";
import { CollisionType, Entity, LineOfSight, LineOfSightMask } from "osrs-sdk";
import type { Model, Region, Unit } from "osrs-sdk";

/**
 * The client's ray reads entity masks, not a mob's own lineOfSight getter.
 * One of these covers a body's footprint. Opening it lets a shot land on that body
 * and still stop on every other body.
 * Movement stays on the mob's own tile flags. This entity does not block a step.
 */
export class FootprintSight extends Entity {
  open = false;
  tiles = 1;

  override get size(): number {
    return this.tiles;
  }

  override get collisionType(): CollisionType {
    return CollisionType.NONE;
  }

  override get lineOfSight(): LineOfSightMask {
    return this.open ? LineOfSightMask.NONE : LineOfSightMask.FULL_MASK;
  }

  override get selectable(): boolean {
    return false;
  }

  override get drawOutline(): boolean {
    return false;
  }

  override entityName(): string {
    return "Line of sight";
  }

  override get color(): string {
    return "#000000";
  }

  override draw(): void {}

  override create3dModel(): Model {
    return SILENT;
  }
}

const SILENT: Model = {
  draw() {},
  destroy() {},
  getWorldPosition: () => new THREE.Vector3(),
  preload: () => Promise.resolve(),
};

/** A player shot, using the client's ray on the tile footprint. The target's own tiles stay open so the shot can land on that body. */
export function attackReaches(region: Region, x: number, y: number, target: Unit, range: number, own: FootprintSight | null): boolean {
  if (own) own.open = true;
  try {
    return LineOfSight.playerHasLineOfSightOfMob(region, x, y, target, range);
  } finally {
    if (own) own.open = false;
  }
}
