import type { Tile } from "../../sim/brands";
import { tile } from "../../sim/brands";
import { P1_CENTRE, P1_CORNERS } from "./layout";
import { P1_ROOM } from "./roomFacts";

/**
 * Phase 1 floor cracks, from the fight logs behind upstream #87.
 * Seven cracks, one every 2 ticks, each 8 tiles, closing 5 ticks after it opens.
 * An x or y crack runs straight (62 of 107). The corner crack runs on the diagonal (20 of 42).
 * The drill swaps the second and third shape on a coin flip. This room keeps first, corner, then the other, so the floor is one pattern.
 * The spotanim family is the direction back toward him: 60 client cycles on the far tile, and one more cycle per tile closer.
 */

const BOSS_SIZE = 3;
const ROOM = 25;
const { crackPieces, crackTiming, floorExplosions } = P1_ROOM;
const CRACK_LENGTH = P1_ROOM.crackLength;
const OPEN_DELAY = crackTiming.openDelay;
const PER_TILE = crackTiming.perTile;
const BLAST_RADIUS = P1_ROOM.blastRadius;

type Step = -1 | 0 | 1;
type Tendril = "x" | "y" | "corner";
type Growth = "north" | "east" | "south" | "west" | "north-east" | "south-east" | "south-west" | "north-west";
type Run = Readonly<{ dx: Step; dy: Step }>;
type Pieces = Readonly<{ start: number; piece: number; end: number }>;

export type CrackCue = Readonly<{ at: Tile; open: number; close: number; openDelay: number; closeDelay: number }>;
export type BlastCue = Readonly<{ at: Tile; spotAnim: number; delay: number }>;

const sign = (n: number): Step => (n > 0 ? 1 : n < 0 ? -1 : 0);

function named(dx: Step, dy: Step): Growth {
  if (dx === 0 && dy < 0) return "north";
  if (dx === 0 && dy > 0) return "south";
  if (dy === 0 && dx > 0) return "east";
  if (dy === 0 && dx < 0) return "west";
  if (dx > 0 && dy < 0) return "north-east";
  if (dx > 0 && dy > 0) return "south-east";
  if (dx < 0 && dy > 0) return "south-west";
  return "north-west";
}

function piecesFor(growth: Growth): Pieces {
  switch (growth) {
    case "north":
      return crackPieces.straight.north;
    case "east":
      return crackPieces.straight.east;
    case "south":
      return crackPieces.straight.south;
    case "west":
      return crackPieces.straight.west;
    case "north-east":
      return crackPieces.diagonal["north-east"];
    case "south-east":
      return crackPieces.diagonal["south-east"];
    case "south-west":
      return crackPieces.diagonal["south-west"];
    case "north-west":
      return crackPieces.diagonal["north-west"];
    default: {
      const unhandled: never = growth;
      return unhandled;
    }
  }
}

/** Toward the room centre: east is +x, north is −y, matching the crack spotanims. */
function firstTendril(ix: Step, iy: Step): "x" | "y" {
  if (ix > 0 && iy < 0) return "y";
  if (ix < 0 && iy < 0) return "x";
  if (ix > 0 && iy > 0) return "x";
  return "y";
}

function tendrilOf(ix: Step, iy: Step, index: number): Tendril {
  const first = firstTendril(ix, iy);
  const other: "x" | "y" = first === "x" ? "y" : "x";
  const order: readonly Tendril[] = [first, "corner", other];
  return order[index % order.length] ?? first;
}

function lineOf(tendril: Tendril, centre: Readonly<{ x: number; y: number }>, innerX: number, innerY: number, ix: Step, iy: Step): Readonly<{ from: Tile; run: Run }> {
  switch (tendril) {
    case "x":
      return { from: tile(innerX + ix, centre.y), run: { dx: ix, dy: 0 } };
    case "y":
      return { from: tile(centre.x, innerY + iy), run: { dx: 0, dy: iy } };
    case "corner":
      return { from: tile(innerX + ix, innerY + iy), run: { dx: ix, dy: iy } };
    default: {
      const unhandled: never = tendril;
      return unhandled;
    }
  }
}

/** Eight tiles from his face toward the middle. Index 0 is the crack on the charge tick. */
export function cornerCrack(corner: number, index: number): readonly Tile[] {
  const anchor = P1_CORNERS[corner % P1_CORNERS.length] ?? P1_CORNERS[0];
  const centre = { x: anchor.x + (BOSS_SIZE - 1) / 2, y: anchor.y - (BOSS_SIZE - 1) / 2 };
  const middle = { x: P1_CENTRE.x + (BOSS_SIZE - 1) / 2, y: P1_CENTRE.y - (BOSS_SIZE - 1) / 2 };
  const ix = sign(middle.x - centre.x) || 1;
  const iy = sign(middle.y - centre.y) || 1;
  const innerX = ix < 0 ? anchor.x : anchor.x + BOSS_SIZE - 1;
  const innerY = iy < 0 ? anchor.y - BOSS_SIZE + 1 : anchor.y;
  const { from, run } = lineOf(tendrilOf(ix, iy, index), centre, innerX, innerY, ix, iy);
  const tiles: Tile[] = [];
  for (let step = 0; step < CRACK_LENGTH; step += 1) {
    const at = tile(from.x + run.dx * step, from.y + run.dy * step);
    if (at.x < 0 || at.y < 0 || at.x >= ROOM || at.y >= ROOM) break;
    tiles.push(at);
  }
  return tiles;
}

function growthOf(tiles: readonly Tile[]): Growth {
  const near = tiles[0];
  const far = tiles[tiles.length - 1];
  if (near === undefined || far === undefined || (near.x === far.x && near.y === far.y)) return "south";
  return named(sign(near.x - far.x), sign(near.y - far.y));
}

/** Open and close spotanims for one crack. The far tile carries the start piece. */
export function crackCues(tiles: readonly Tile[]): readonly CrackCue[] {
  const pieces = piecesFor(growthOf(tiles));
  const last = tiles.length - 1;
  return tiles.map((at, index) => ({
    at,
    open: index === last ? pieces.start : pieces.piece,
    close: pieces.end,
    openDelay: OPEN_DELAY + PER_TILE * (last - index),
    closeDelay: PER_TILE * (last - index),
  }));
}

/** Floor tiles within the blast's reach of a 3×3, the tiles the slam paints. */
export function blastRing(origin: Tile): readonly Tile[] {
  const tiles: Tile[] = [];
  const x0 = origin.x - BLAST_RADIUS;
  const x1 = origin.x + BOSS_SIZE - 1 + BLAST_RADIUS;
  const y0 = origin.y - (BOSS_SIZE - 1) - BLAST_RADIUS;
  const y1 = origin.y + BLAST_RADIUS;
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const onBody = x >= origin.x && x <= origin.x + BOSS_SIZE - 1 && y >= origin.y - (BOSS_SIZE - 1) && y <= origin.y;
      if (onBody || x < 0 || y < 0 || x >= ROOM || y >= ROOM) continue;
      tiles.push(tile(x, y));
    }
  }
  return tiles;
}

function listedDelay(ringDelays: readonly number[], ring: number): number {
  const listed = ringDelays[ring - 1];
  if (listed !== undefined) return listed;
  const first = ringDelays[0];
  return first === undefined ? 0 : first;
}

/** Spotanims for a blast ring. The nearer ring is the tiles two out from its centre. */
export function blastCuesOn(tiles: readonly Tile[]): readonly BlastCue[] {
  const { pieces, ringDelays } = floorExplosions;
  const count = tiles.length;
  const cx = count === 0 ? 0 : Math.round(tiles.reduce((sum, at) => sum + at.x, 0) / count);
  const cy = count === 0 ? 0 : Math.round(tiles.reduce((sum, at) => sum + at.y, 0) / count);
  return tiles.map((at) => {
    const out = Math.max(Math.abs(at.x - cx), Math.abs(at.y - cy));
    const spotAnim = pieces[(at.x * 7 + at.y * 3) % pieces.length] ?? pieces[0];
    return { at, spotAnim, delay: listedDelay(ringDelays, out <= 2 ? 1 : 2) };
  });
}

/** The blast's four quarter-turns. The nearer ring starts at once and the outer ring 2 client cycles later. */
export function blastCues(origin: Tile): readonly BlastCue[] {
  return blastCuesOn(blastRing(origin));
}
