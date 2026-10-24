import type { Tile } from "./brands";
import { tile } from "./brands";

const key = (at: Tile) => `${at.x},${at.y}`;

export type Side = "north" | "south" | "east" | "west";
const STEP: Readonly<Record<Side, Readonly<{ dx: number; dy: number }>>> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
  east: { dx: 1, dy: 0 },
};
const SIDES: readonly Side[] = ["north", "south", "west", "east"];

export function beside(at: Tile, side: Side): Tile {
  return tile(at.x + STEP[side].dx, at.y + STEP[side].dy);
}

export function reach(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export class TileSet<Tag extends string | null = string | null> {
  private constructor(readonly tag: Tag, private readonly byKey: ReadonlyMap<string, Tile>) {}

  static area(from: Tile, to: Tile): TileSet<null> {
    if (from.x > to.x || from.y > to.y) throw new RangeError(`empty area from ${key(from)} to ${key(to)}`);
    const tiles = new Map<string, Tile>();
    for (let x: number = from.x; x <= to.x; x++) {
      for (let y: number = from.y; y <= to.y; y++) tiles.set(`${x},${y}`, tile(x, y));
    }
    return new TileSet(null, tiles);
  }

  static at(tiles: readonly Tile[]): TileSet<null> {
    return new TileSet(null, new Map(tiles.map((at) => [key(at), at])));
  }

  /** Row y = 0 first, x = 0 leftmost. */
  static grid<G extends string>(rows: readonly string[], alphabet: readonly G[], ...members: readonly G[]): TileSet<null> {
    const tiles = new Map<string, Tile>();
    rows.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (!alphabet.some((glyph) => glyph === cell)) throw new RangeError(`grid cell ${JSON.stringify(cell)} at ${x},${y} is not one of ${alphabet.join(" ")}`);
        if (members.some((glyph) => glyph === cell)) tiles.set(`${x},${y}`, tile(x, y));
      }),
    );
    return new TileSet(null, tiles);
  }

  minus(other: TileSet): TileSet<null> {
    return new TileSet(null, new Map([...this.byKey].filter(([at]) => !other.byKey.has(at))));
  }

  tagged<T extends string>(tag: T): TileSet<T> {
    return new TileSet(tag, this.byKey);
  }

  contains(at: Tile): boolean {
    return this.byKey.has(key(at));
  }

  tiles(): readonly Tile[] {
    return [...this.byKey.values()];
  }

  border(): readonly Readonly<{ at: Tile; side: Side }>[] {
    return this.tiles().flatMap((at) =>
      SIDES.filter((side) => !this.contains(beside(at, side))).map((side) => ({ at, side })),
    );
  }

  surround(): TileSet<null> {
    const around = new Map<string, Tile>();
    for (const { x, y } of this.tiles()) {
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          const at = tile(x + dx, y + dy);
          if (!this.contains(at)) around.set(key(at), at);
        }
      }
    }
    return new TileSet(null, around);
  }

  extent(): Readonly<{ width: number; height: number }> {
    const tiles = this.tiles();
    return { width: Math.max(0, ...tiles.map(({ x }) => x + 1)), height: Math.max(0, ...tiles.map(({ y }) => y + 1)) };
  }
}
