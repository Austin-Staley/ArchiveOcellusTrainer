import type { HitReceipt } from "../../../sim/combat";
import type { At } from "./drill";
import { footprintCentre, startP3Drill } from "./p3drill";

const loadTimings = () => vi.importActual<typeof import("../js/OcellusTimings")>("../js/OcellusTimings");

const SPAWN: At = { x: 19, y: 9 };
const FAR_EAST: At = { x: 27, y: 9 };

const receipt = (requested: number, beforeHp: number, prayer: "melee" | null): HitReceipt => ({ requested, applied: requested, beforeHp, afterHp: beforeHp - requested, prayer });

describe("P3 drill", () => {
  test.each([
    { bossHp: 3991, expected: { ended: [[3, "quadrant-cleared"]], hpAfterShot: 3937, stageOnShot: "destroy", runAt6: "ended" } },
    { bossHp: 3992, expected: { ended: [], hpAfterShot: 3938, stageOnShot: "arrive", runAt6: "running" } },
  ])("the 75% break ends the run on the landing tick at or below ⌊5250 × 0.75⌋ = 3937: bosshp=$bossHp, seed 100's first shot of 54 lands on P3 tick 3", async ({ bossHp, expected }) => {
    const drill = await startP3Drill({ seed: 100, bossHp });
    drill.tickTo(0);
    await drill.click(footprintCentre(drill.boss()));
    drill.tickTo(6);
    const shot = drill.row(3);
    const observed = {
      ended: drill.events("run-ended").map((event) => [event.at, event.reason.kind]),
      hpAfterShot: shot.bossHp.atPostTick,
      stageOnShot: shot.phase.stage,
      runAt6: drill.region.snapshot()?.run.kind,
    };
    drill.dispose();
    expect(observed).toEqual(expected);
  });

  test.each([
    {
      prayer: "Protect from Melee" as const,
      hits: [[7, "void-shot", receipt(20, 99, "melee")], [10, "void-shot", receipt(20, 79, "melee")], [17, "void-shot", receipt(20, 59, "melee")], [20, "void-shot", receipt(20, 39, "melee")]],
    },
    {
      prayer: null,
      hits: [[7, "void-shot", receipt(20, 99, null)], [10, "void-shot", receipt(20, 79, null)], [17, "void-shot", receipt(20, 59, null)], [20, "void-shot", receipt(20, 39, null)]],
    },
  ])("he holds his anchor, so the spawn two tiles out takes a void shot at 7, 10, 17 and 20, and a wave that does nothing yet at 14 and 24, with prayer $prayer", async ({ prayer, hits }) => {
    const drill = await startP3Drill({ seed: 1 });
    if (prayer !== null) drill.pray(prayer);
    drill.tickTo(26);
    const observed = {
      stages: drill.events("stage-entered").map((event) => [event.at, event.stage]),
      hits: drill.events("player-hit").map((event) => [event.at, event.hit.kind, event.receipt]),
      waves: drill.events("wave-cast").map((event) => [event.at, event.toward]),
    };
    drill.dispose();
    expect(observed).toEqual({ stages: [[0, "arrive"], [7, "autos"]], hits, waves: [[14, SPAWN], [24, SPAWN]] });
  });

  test("he stays on his anchor, so a player who runs to the far east after P3 tick 6 takes a void shot at 7 and at 10", async () => {
    const drill = await startP3Drill({ seed: 1 });
    drill.pray("Protect from Melee");
    drill.tickTo(6);
    await drill.click(FAR_EAST);
    drill.tickTo(10);
    const hits = drill.events("player-hit").map((event) => [event.at, event.hit.kind, event.receipt]);
    const place = { x: drill.boss().location.x, y: drill.boss().location.y };
    drill.dispose();
    expect(place).toEqual({ x: 21, y: 7 });
    expect(hits).toEqual([[7, "void-shot", receipt(20, 99, "melee")], [10, "void-shot", receipt(20, 79, "melee")]]);
  });

  test.each([
    { link: "?phase=p5&seed=1", expected: { phase: "p4", rejected: ["phase=p5"] } },
    { link: "?phase=p4&seed=1", expected: { phase: "p4", rejected: [] } },
    { link: "?phase=p3&seed=1&focus=void-floor", expected: { phase: "p3", rejected: ["focus=void-floor"] } },
  ])("with the P3 flag on, parseRequest opens $expected.phase for $link and rejects $expected.rejected", async ({ link, expected }) => {
    const { parseRequest } = await loadTimings();
    const request = parseRequest(new URL(`http://127.0.0.1:8002/${link}`), () => 99, { p3: true, p2: false, p1: false });
    expect({ phase: request.phase, rejected: request.rejected }).toEqual(expected);
  });
});
