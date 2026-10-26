import { describe, expect, it } from "vitest";
import { tile } from "../../../sim/brands";
import { blastCues, cornerCrack, crackCues } from "../cracks";
import { P1_CORNERS, beamHits } from "../layout";
import type { Quadrant } from "../layout";
import { PORTAL_COLOURS, PORTAL_IDLE, PORTAL_ORANGE, PORTAL_PURPLE, gapsFor, markedSafeTile, portalLook, portalPlaces, portalTiles } from "../portals";

describe("phase 1 floor cracks", () => {
  it("opens an 8-tile south crack from the standing boss, far tile first", () => {
    const tiles = cornerCrack(0, 0);
    expect(tiles).toEqual([tile(6, 14), tile(6, 13), tile(6, 12), tile(6, 11), tile(6, 10), tile(6, 9), tile(6, 8), tile(6, 7)]);
    const cues = crackCues(tiles);
    expect(cues[7]).toMatchObject({ open: 4238, close: 4245, openDelay: 60, closeDelay: 0 });
    expect(cues[0]).toMatchObject({ open: 4244, close: 4245, openDelay: 67, closeDelay: 7 });
    expect(P1_CORNERS[0]).toEqual(tile(5, 17));
  });

  it("runs the corner crack on the diagonal", () => {
    const cues = crackCues(cornerCrack(0, 1));
    expect(cues.map((cue) => ({ x: cue.at.x, y: cue.at.y }))).toEqual([
      { x: 8, y: 14 },
      { x: 9, y: 13 },
      { x: 10, y: 12 },
      { x: 11, y: 11 },
      { x: 12, y: 10 },
      { x: 13, y: 9 },
      { x: 14, y: 8 },
      { x: 15, y: 7 },
    ]);
    expect(cues[7]?.open).toBe(4250);
    expect(cues[0]?.open).toBe(4256);
  });

  it("paints the slam with the four floor-blast spotanims", () => {
    const cues = blastCues(P1_CORNERS[0]);
    expect(cues.length).toBeGreaterThan(8);
    expect(new Set(cues.map((cue) => cue.spotAnim))).toEqual(new Set([4262, 4263, 4264, 4265]));
    expect(cues.every((cue) => cue.delay === 0 || cue.delay === 2)).toBe(true);
  });
});

describe("phase 2 portal grid", () => {
  it("places 24 portals, orange 62758 and purple 62757, both on animation 14830", () => {
    const places = portalPlaces();
    expect(places).toHaveLength(24);
    expect(PORTAL_ORANGE).toBe(62758);
    expect(PORTAL_PURPLE).toBe(62757);
    expect(PORTAL_IDLE).toBe(14830);
    expect(portalTiles("north", 0)).toEqual([tile(12, 13), tile(12, 14)]);
    expect(portalTiles("west", 1)).toEqual([tile(8, 12), tile(9, 12)]);
    expect(new Set(places.map((place) => `${place.tiles[0].x},${place.tiles[0].y}`)).size).toBe(24);
  });

  it("leaves the orange gap safe and paints the other portals on those arms purple", () => {
    expect(portalLook("north", 1, "NW", 2, 2)).toBe("orange");
    expect(portalLook("west", 1, "NW", 2, 2)).toBe("orange");
    expect(portalLook("north", 0, "NW", 2, 2)).toBe("purple");
    expect(portalLook("east", 0, "NW", 2, 2)).toBe("orange");
    expect(beamHits("NW", 2, 2, tile(12, 15))).toBe(false);
    expect(beamHits("NW", 2, 2, tile(12, 13))).toBe(true);
    const yaw = portalPlaces().find((place) => place.arm === "east")?.yaw;
    expect(yaw).toBeCloseTo(-Math.PI / 2);
  });

  it("keeps each marked safe tile inside the gap and one tile in from the dossier band", () => {
    const quadrants: readonly Quadrant[] = ["NW", "NE", "SE", "SW"];
    PORTAL_COLOURS.forEach((colour) => {
      quadrants.forEach((quadrant) => {
        for (let wave = 0; wave < 6; wave += 1) {
          const [nsGap, ewGap] = gapsFor(colour, wave);
          expect(beamHits(quadrant, nsGap, ewGap, markedSafeTile(colour, wave, quadrant))).toBe(false);
        }
      });
    });
    expect(gapsFor("orange", 0)).toEqual([2, 2]);
    expect(markedSafeTile("orange", 0, "NW")).toEqual(tile(9, 15));
    expect(beamHits("NW", 2, 2, tile(9, 15))).toBe(false);
    expect(beamHits("NW", 2, 2, tile(7, 16))).toBe(true);
  });
});
