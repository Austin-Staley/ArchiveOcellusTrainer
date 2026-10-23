import * as THREE from "three";
import type { Entity } from "osrs-sdk";
import { renderPathGaps } from "../../../../review-ratchet/checks/render-paths.mjs";
import { drawsVisibly } from "../../../../test/paintedTiles";
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

function sampleTracks(selection: DrillSelection, ticks: number) {
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
        samples: FRACTIONS.map((at) => ({ at, flat: drawsVisibly((context) => entity.draw(at, context)), model: modelDraws(entity, at) })),
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
});
