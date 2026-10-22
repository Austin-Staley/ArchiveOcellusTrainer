import { act } from "react";
import { Projectile } from "osrs-sdk";
import { OcellusRegion } from "../js/OcellusRegion";
import { captureNavigation, loadPage } from "./page";

const RESULT_POLL_WAIT_MS = 400;

function openFight(url: string) {
  // The page builds its own region; the call-through spy hands the test that instance so it can tick the world the SDK loop would.
  const built = vi.spyOn(OcellusRegion.prototype, "initialiseRegion");
  const page = loadPage(url);
  const region = built.mock.contexts.at(-1);
  built.mockRestore();
  if (!(region instanceof OcellusRegion)) throw new Error("the page built no region");
  region.world.getReadyTimer = 0;
  const run = () => region.snapshot()?.run;
  const tickTo = (t: number) => {
    for (let guard = 0; guard < 400; guard++) {
      const now = run();
      if (now?.kind === "ended" || (now?.kind === "running" && now.tick >= t)) return;
      region.world.tickWorld();
    }
    throw new Error(`the run never reached P4 tick ${t}`);
  };
  const hitBoss = (damage: number) => {
    const boss = region.primaryBoss;
    if (!boss) throw new Error("the region has no boss");
    boss.addProjectile(new Projectile(null, damage, region.players[0], boss, "typeless", { setDelay: 1 }));
  };
  const result = async () => {
    await act(() => new Promise((resolve) => setTimeout(resolve, RESULT_POLL_WAIT_MS)));
    const panel = document.querySelector("#run_result");
    if (!panel) return null;
    return {
      lines: [...panel.querySelectorAll("h2, p")].map((line) => line.textContent),
      buttons: [...panel.querySelectorAll("button")].map((button) => button.textContent),
    };
  };
  return { page, region, run, tickTo, hitBoss, result };
}

describe("Run result", () => {
  beforeEach(() => localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } })));

  test("a kill shows Ocellus defeated with the P4 time in ticks and game time; Restart draws a new seed and Retry seed replays it, both keeping bosshp", async () => {
    const navigation = captureNavigation();
    const fight = openFight("/?seed=9&bosshp=50");
    fight.tickTo(11);
    const whileRunning = await fight.result();
    fight.hitBoss(50);
    fight.tickTo(20);
    const shown = await fight.result();
    fight.page.click("result_restart");
    fight.page.click("result_retry");
    fight.page.close();
    navigation.restore();

    expect({ whileRunning, shown, navigation: navigation.assigned }).toEqual({
      whileRunning: null,
      shown: { lines: ["Ocellus defeated", "P4 time: 12 ticks (0:07.2)"], buttons: ["Restart", "Retry seed"] },
      navigation: ["http://localhost/?bosshp=50&setup=ranged&focus=full-fight", "http://localhost/?seed=9&bosshp=50&setup=ranged&focus=full-fight"],
    });
  });

  test.each([
    {
      name: "with the box still on and no death prevented",
      url: "/?seed=1&invincible=on",
      untickAt: null,
      hitAt: 11,
      time: "P4 time: 12 ticks (0:07.2)",
      navigation: ["http://localhost/?invincible=on&setup=ranged&focus=full-fight", "http://localhost/?seed=1&invincible=on&setup=ranged&focus=full-fight"],
    },
    {
      name: "with the box unticked after it prevented a death",
      url: "/?seed=1&focus=void-floor&invincible=on",
      untickAt: 60,
      hitAt: 99,
      time: "P4 time: 100 ticks (1:00.0)",
      navigation: ["http://localhost/?focus=void-floor&setup=ranged", "http://localhost/?seed=1&focus=void-floor&setup=ranged"],
    },
  ])("a kill $name says Invincible was on, and both buttons carry what the box shows", async ({ url, untickAt, hitAt, time, navigation: expected }) => {
    const navigation = captureNavigation();
    const fight = openFight(url);
    if (untickAt !== null) {
      fight.tickTo(untickAt);
      fight.page.click("invincible");
    }
    fight.tickTo(hitAt);
    fight.hitBoss(1355);
    fight.tickTo(hitAt + 10);
    const shown = await fight.result();
    fight.page.click("result_restart");
    fight.page.click("result_retry");
    fight.page.close();
    navigation.restore();

    expect({ shown, navigation: navigation.assigned }).toEqual({
      shown: { lines: ["Ocellus defeated", time, "Invincible was on."], buttons: ["Restart", "Retry seed"] },
      navigation: expected,
    });
  });

  test("a death shows You died with its P4 tick; Restart keeps setup and focus with a new seed and Retry seed replays it", async () => {
    const navigation = captureNavigation();
    const fight = openFight("/?seed=1&focus=void-floor");
    fight.tickTo(60);
    const ended = fight.run();
    const shown = await fight.result();
    fight.page.click("result_restart");
    fight.page.click("result_retry");
    fight.page.close();
    navigation.restore();

    expect({ ended, shown, navigation: navigation.assigned }).toEqual({
      ended: { kind: "ended", at: 54, reason: "death" },
      shown: { lines: ["You died", "on P4 tick 54"], buttons: ["Restart", "Retry seed"] },
      navigation: ["http://localhost/?focus=void-floor&setup=ranged", "http://localhost/?seed=1&focus=void-floor&setup=ranged"],
    });
  });

  const startingBossHp = (bosshp: string) => {
    const page = loadPage(`/?seed=1&bosshp=${bosshp}`);
    const probe = window.__archiveOcellusProbe?.snapshot();
    page.close();
    return { hp: probe?.fight?.boss.hp, rejected: probe?.rejected };
  };

  test.each([
    { bosshp: "50", hp: 50 },
    { bosshp: "5420", hp: 5420 },
  ])("a link with bosshp=$bosshp starts P4 at $hp boss hitpoints", ({ bosshp, hp }) => {
    expect(startingBossHp(bosshp)).toEqual({ hp, rejected: [] });
  });

  test.each(["5421", "0", "1e3"])("guard, invalid values keep the normal entry HP: a link with bosshp=%s starts P4 at 1355 and lists it as rejected", (bosshp) => {
    expect(startingBossHp(bosshp)).toEqual({ hp: 1355, rejected: [`bosshp=${bosshp}`] });
  });
});
