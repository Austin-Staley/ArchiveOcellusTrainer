import { describe, expect, it } from "vitest";
import { tile } from "../../../sim/brands";
import { blastCues, cornerCrack, crackCues } from "../cracks";
import { P1_CENTRE, P1_CORNERS, P1_START, beamHits } from "../layout";
import { P1_MIDDLE, P1_START as loggedStart, p1CornerTile } from "../p1Route";
import type { Quadrant } from "../layout";
import { PORTAL_COLOURS, PORTAL_IDLE, PORTAL_ORANGE, PORTAL_PURPLE, gapsFor, markedSafeTile, portalLook, portalPlaces, portalTiles } from "../portals";

describe("phase 1 floor cracks", () => {
  it("opens an 8-tile crack south from the north-east corner, far tile first", () => {
    const tiles = cornerCrack(0, 0);
    expect(tiles).toEqual([tile(12, 12), tile(12, 13), tile(12, 14), tile(12, 15), tile(12, 16), tile(12, 17), tile(12, 18), tile(12, 19)]);
    const cues = crackCues(tiles);
    expect(cues[7]).toMatchObject({ open: 4236, close: 4241, openDelay: 60, closeDelay: 0 });
    expect(cues[0]).toMatchObject({ open: 4240, close: 4241, openDelay: 67, closeDelay: 7 });
    expect(P1_CORNERS[0]).toEqual(tile(11, 11));
    expect(loggedStart).toEqual(P1_START);
    expect(P1_MIDDLE).toEqual(P1_CENTRE);
    expect(p1CornerTile("south-west")).toEqual(tile(-1, 23));
  });

  it("runs the corner crack on the diagonal", () => {
    const cues = crackCues(cornerCrack(0, 1));
    expect(cues.map((cue) => ({ x: cue.at.x, y: cue.at.y }))).toEqual([
      { x: 10, y: 12 },
      { x: 9, y: 13 },
      { x: 8, y: 14 },
      { x: 7, y: 15 },
      { x: 6, y: 16 },
      { x: 5, y: 17 },
      { x: 4, y: 18 },
      { x: 3, y: 19 },
    ]);
    expect(cues[7]?.open).toBe(4248);
    expect(cues[0]?.open).toBe(4252);
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
