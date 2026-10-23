import * as THREE from "three";
import type { Entity } from "osrs-sdk";
import { renderPathGaps } from "../../../../review-ratchet/checks/render-paths.mjs";
import { drawsVisibly, zeroSizeFillRects } from "../../../../test/paintedTiles";
import type { DrillSelection } from "../js/OcellusTimings";
import { startDrill } from "./drill";

const FRACTIONS = Array.from({ length: 10 }, (_, step) => (step + 1) / 10);
const FOCUSES = ["void-floor", "lifeforce-orb", "explosions", "transition-attacks", "rifts", "floor-holes"] as const;

function shows(object: THREE.Object3D): boolean {
  if (!object.visible) return false;
  if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points || object instanceof THREE.Sprite) {
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material.visible && material.opacity > 0)) return true;
  }
  return object.children.some(shows);
}

function modelDraws(entity: Entity, at: number): boolean {
  const model = entity.get3dModel();
  if (!model) return false;
  const scene = new THREE.Scene();
  model.draw(scene, 0, at, entity.getPerceivedLocation(at), 0, 0, entity.visible(at), []);
  return shows(scene);
}

type Paint2d = (entity: Entity, at: number, context: OffscreenCanvasRenderingContext2D) => void;

function sampleTracks(selection: DrillSelection, ticks: number, paint2d: Paint2d = (entity, at, context) => entity.draw(at, context)) {
  const drill = startDrill({ selection });
  const tracks = [];
  let previous = Number.NaN;
  for (let t = 0; t < ticks; t++) {
    drill.tickTo(t);
    const rows = drill.rows();
    const tick = rows.length === 0 ? -1 : rows[rows.length - 1].tick;
    if (tick === previous) continue;
    previous = tick;
    for (const entity of drill.region.entities) {
      tracks.push({
        entity: `${selection.focus}:${entity.constructor.name}@${entity.location.x},${entity.location.y}`,
        tick,
        samples: FRACTIONS.map((at) => ({ at, flat: drawsVisibly((context) => paint2d(entity, at, context)), model: modelDraws(entity, at) })),
      });
    }
  }
  drill.dispose();
  return tracks;
}

describe("render paths", () => {
  test("every entity drawn in both 2D and 3D during a tick is drawn over the same fractions of it, including the explosion mark from its first fifth", () => {
    const tracks = FOCUSES.flatMap((focus) => sampleTracks({ focus }, 60));
    const firstMark = tracks.find((track) => track.entity === "explosions:ExplosionView@5,1" && track.tick === 17);
    expect({
      earlyMark: firstMark?.samples.find((sample) => sample.at === 0.2),
      gaps: renderPathGaps(tracks),
    }).toEqual({
      earlyMark: { at: 0.2, flat: true, model: true },
      gaps: [],
    });
  }, 30_000);

  test("a 2D mark whose shards draw at zero size is a gap until its glow shows halfway through the tick", () => {
    const zeroSizeShards: Paint2d = (entity, at, context) => entity.draw(at, zeroSizeFillRects(context));
    const firstMark = sampleTracks({ focus: "explosions" }, 20, zeroSizeShards).filter((track) => track.entity === "explosions:ExplosionView@5,1" && track.tick === 17);
    expect(renderPathGaps(firstMark)).toEqual([{ entity: "explosions:ExplosionView@5,1", tick: 17, flatOnly: [], modelOnly: [0.1, 0.2, 0.3, 0.4, 0.5] }]);
  }, 30_000);

  test("the 2D observer counts a draw only when it covers pixels", () => {
    const pixel = (alpha: number) => (context: OffscreenCanvasRenderingContext2D) => {
      const image = new OffscreenCanvas(1, 1).getContext("2d")?.createImageData(1, 1);
      if (!image) throw new Error("no 2D context");
      image.data[3] = alpha;
      context.putImageData(image, 0, 0);
    };
    const draws: Record<string, (context: OffscreenCanvasRenderingContext2D) => void> = {
      rect: (context) => context.fillRect(0, 0, 1, 1),
      zeroSizeRect: (context) => context.fillRect(0, 0, 0, 0),
      zeroAlphaRect: (context) => {
        context.globalAlpha = 0;
        context.fillRect(0, 0, 1, 1);
      },
      restoredAlphaRect: (context) => {
        context.save();
        context.globalAlpha = 0;
        context.restore();
        context.fillRect(0, 0, 1, 1);
      },
      transparentStyleRects: (context) => {
        for (const style of ["transparent", "rgba(255, 0, 0, 0)", "hsl(0 100% 50% / 0%)", "#ff000000", "#f000"]) {
          context.fillStyle = style;
          context.fillRect(0, 0, 1, 1);
        }
      },
      disc: (context) => {
        context.beginPath();
        context.arc(1, 1, 1, 0, 2 * Math.PI);
        context.fill();
      },
      zeroRadiusDisc: (context) => {
        context.beginPath();
        context.arc(1, 1, 0, 0, 2 * Math.PI);
        context.fill();
      },
      line: (context) => {
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(4, 0);
        context.stroke();
      },
      zeroWidthLine: (context) => {
        context.lineWidth = 0;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(4, 0);
        context.stroke();
      },
      filledLine: (context) => {
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(4, 0);
        context.fill();
      },
      sprite: (context) => context.drawImage(new OffscreenCanvas(8, 8), 0, 0, 4, 4),
      zeroSizeSprite: (context) => context.drawImage(new OffscreenCanvas(8, 8), 0, 0, 0, 4),
      text: (context) => context.fillText("7", 0, 0),
      blankText: (context) => context.fillText(" ", 0, 0),
      pixel: pixel(1),
      clearPixel: pixel(0),
    };
    expect(Object.fromEntries(Object.entries(draws).map(([name, draw]) => [name, drawsVisibly(draw)]))).toEqual({
      rect: true,
      zeroSizeRect: false,
      zeroAlphaRect: false,
      restoredAlphaRect: true,
      transparentStyleRects: false,
      disc: true,
      zeroRadiusDisc: false,
      line: true,
      zeroWidthLine: false,
      filledLine: false,
      sprite: true,
      zeroSizeSprite: false,
      text: true,
      blankText: false,
      pixel: true,
      clearPixel: false,
    });
  });
});
