import { OCELLUS_P3 } from "../OcellusTimings";
import { TileSet } from "../../../../sim/tiles";

const GLYPHS = ["1", "2", "3", "4", "+", "b", "B", "."] as const;
const { grid } = OCELLUS_P3.arena;

export const ARENA_SIZE = { width: Math.max(...grid.value.map((row) => row.length)), height: grid.value.length };
export const FLOOR = TileSet.grid(grid.value, GLYPHS, "1", "2", "3", "4", "+");
export const RIM = TileSet.grid(grid.value, GLYPHS, "b", "B");
export const QUADRANT_1_FLOOR = TileSet.grid(grid.value, GLYPHS, "1");
