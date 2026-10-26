import { P1_ROOM, P2_ROOM, P3_ROOM } from "../roomFacts";
import { OCELLUS_P1 } from "../../ocellus/js/OcellusTimingsP1";
import { OCELLUS_P2 } from "../../ocellus/js/OcellusTimingsP2";
import { OCELLUS_P3 } from "../../ocellus/js/OcellusTimingsP3";

const piece = (selected: Readonly<{ value: Readonly<{ start: number; piece: number; end: number }> }>) => selected.value;

describe("encounter room facts", () => {
  test("the phase 1 cracks and blast the rooms draw are the phase 1 recipe", () => {
    const { crackPieces, crackTiming, floorExplosions } = OCELLUS_P1.presentation;
    expect(P1_ROOM).toEqual({
      crackLength: OCELLUS_P1.corner.cracks.value.length,
      blastRadius: OCELLUS_P1.blast.radius.value,
      crackPieces: {
        straight: {
          north: piece(crackPieces.straight.north),
          east: piece(crackPieces.straight.east),
          south: piece(crackPieces.straight.south),
          west: piece(crackPieces.straight.west),
        },
        diagonal: {
          "north-east": piece(crackPieces.diagonal["north-east"]),
          "south-east": piece(crackPieces.diagonal["south-east"]),
          "south-west": piece(crackPieces.diagonal["south-west"]),
          "north-west": piece(crackPieces.diagonal["north-west"]),
        },
      },
      crackTiming: crackTiming.value,
      floorExplosions: floorExplosions.value,
    });
  });

  test("the phase 2 portals the rooms draw are the phase 2 recipe", () => {
    expect(P2_ROOM).toEqual({
      perArm: OCELLUS_P2.portals.perArm.value,
      rotation: OCELLUS_P2.portals.rotation.value,
      looks: OCELLUS_P2.portals.looks.value,
    });
  });

  test("the phase 3 swing the room deals is the phase 3 recipe's max", () => {
    expect(P3_ROOM).toEqual({
      swingProtectedMax: OCELLUS_P3.swing.protectedDamage.value.max,
      swingUnprotectedMax: OCELLUS_P3.swing.unprotectedDamage.value.max,
    });
  });
});
