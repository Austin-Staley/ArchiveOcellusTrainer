import { startDrill } from "./drill";
import { captureNavigation, loadPage } from "./page";

const VOID_FLOOR = { focus: "void-floor" } as const;

function standOnTheFlood(turnOffAt: number | null) {
  const drill = startDrill({ selection: VOID_FLOOR });
  drill.region.invincible = true;
  if (turnOffAt !== null) {
    drill.tickTo(turnOffAt);
    drill.region.invincible = false;
  }
  drill.tickTo(56);
  const observed = {
    floorHits: drill.events("floor-hit").map((e) => [e.at, e.receipt.requested, e.receipt.applied, e.receipt.beforeHp, e.receipt.afterHp]),
    prevented: drill.events("death-prevented"),
    hpAfter: drill.rows().map((row) => row.playerAtPostTick.hp).slice(-3),
    ended: drill.events("run-ended").map((e) => [e.at, e.reason]),
    chat: drill.region.chat(),
  };
  drill.dispose();
  return observed;
}

const HITS_TO_THE_LETHAL_ONE = [
  [44, 9, 9, 99, 90], [45, 11, 11, 90, 79], [46, 10, 10, 79, 69], [47, 11, 11, 69, 58], [48, 10, 10, 58, 48], [49, 9, 9, 48, 39],
  [50, 9, 9, 39, 30], [51, 10, 10, 30, 20], [52, 9, 9, 20, 11], [53, 10, 10, 11, 1], [54, 10, 1, 1, 0],
];

describe("Invincible", () => {
  test("with invincible on, the floor's lethal hit still lands, HP returns to full and the log and chat name the tick and the source", () => {
    expect(standOnTheFlood(null)).toEqual({
      floorHits: [...HITS_TO_THE_LETHAL_ONE, [55, 9, 9, 99, 90], [56, 9, 9, 90, 81]],
      prevented: [{ kind: "death-prevented", at: 54, source: "floor-hit" }],
      hpAfter: [99, 90, 81],
      ended: [],
      chat: ["Invincible: the void floor would have killed you on tick 54."],
    });
  });

  test("with invincible turned off before it, the same lethal hit ends the run on tick 54", () => {
    expect(standOnTheFlood(50)).toEqual({
      floorHits: HITS_TO_THE_LETHAL_ONE,
      prevented: [],
      hpAfter: [11, 1, 0],
      ended: [[54, "death"]],
      chat: [],
    });
  });

  test("a hit that leaves HP above 0 lands the same with invincible on or off", () => {
    const hitsBeforeTick54 = (invincible: boolean) => {
      const drill = startDrill({ selection: VOID_FLOOR });
      drill.region.invincible = invincible;
      drill.tickTo(53);
      const hits = drill.events("floor-hit").map((e) => [e.at, e.receipt.requested, e.receipt.applied, e.receipt.beforeHp, e.receipt.afterHp]);
      const hp = drill.row(53).playerAtPostTick.hp;
      drill.dispose();
      return { hits, hp };
    };
    const nonLethal = { hits: HITS_TO_THE_LETHAL_ONE.slice(0, 10), hp: 1 };
    expect({ off: hitsBeforeTick54(false), on: hitsBeforeTick54(true) }).toEqual({ off: nonLethal, on: nonLethal });
  });

  test("with invincible on, the lifeforce steal still halves the player's HP", () => {
    const drill = startDrill({ selection: { focus: "lifeforce-orb" } });
    drill.region.invincible = true;
    drill.tickTo(13);
    expect([drill.events("lifeforce-drained").map((e) => [e.at, e.receipt]), drill.row(12).playerAtPostTick.hp]).toEqual([
      [[12, { requested: 49, applied: 49, beforeHp: 99, afterHp: 50, prayer: null }]],
      50,
    ]);
    drill.dispose();
  });

  test("the Invincible box starts unchecked, a link with invincible=on starts it checked, and Restart carries what the box shows", () => {
    localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } }));
    const navigation = captureNavigation();
    const plain = loadPage("/?seed=7");
    const checkedOnLoad = [plain.checked("invincible")];
    plain.click("invincible");
    plain.type("seed", "7");
    plain.click("restart");
    plain.close();
    const linked = loadPage(navigation.assigned[0]);
    checkedOnLoad.push(linked.checked("invincible"));
    linked.click("invincible");
    linked.type("seed", "7");
    linked.click("restart");
    linked.close();
    navigation.restore();
    expect({ checkedOnLoad, navigation: navigation.assigned }).toEqual({
      checkedOnLoad: [false, true],
      navigation: ["http://localhost/?seed=7&setup=ranged&focus=full-fight&invincible=on", "http://localhost/?seed=7&setup=ranged&focus=full-fight"],
    });
  });
});
