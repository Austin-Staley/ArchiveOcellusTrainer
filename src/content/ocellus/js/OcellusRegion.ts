import { CardinalDirection, Player, Region } from "osrs-sdk";
import type { Location } from "osrs-sdk";
import { ocellusLoadout } from "./OcellusLoadout";

export const PLACEHOLDER_ARENA_SIZE = { width: 20, height: 20 } as const;
export const SPAWN_TILE: Readonly<Location> = { x: 10, y: 10 };

export class OcellusRegion extends Region {
  constructor() {
    super([ocellusLoadout]);
  }

  override getName() {
    return "Ocellus";
  }

  override get width() {
    return PLACEHOLDER_ARENA_SIZE.width;
  }

  override get height() {
    return PLACEHOLDER_ARENA_SIZE.height;
  }

  override get initialFacing() {
    return CardinalDirection.NORTH;
  }

  override drawWorldBackground(context: OffscreenCanvasRenderingContext2D, scale: number) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        context.fillStyle = (x + y) % 2 === 0 ? "#4a4339" : "#3f392f";
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  initialiseRegion(): { player: Player } {
    const player = new Player(this, { ...SPAWN_TILE });
    this.addPlayer(player);
    return { player };
  }
}
