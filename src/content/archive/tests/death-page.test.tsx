import { act } from "react";
import { seed, tick } from "../../../sim/brands";
import { RaidRegion } from "../RaidRegion";
import { captureNavigation, loadPage } from "../../ocellus/tests/page";

const RESULT_POLL_WAIT_MS = 400;

async function openRaid(url: string) {
  const built = vi.spyOn(RaidRegion.prototype, "initialiseRegion");
  const page = loadPage(url);
  const region = built.mock.contexts.at(-1);
  built.mockRestore();
  if (!(region instanceof RaidRegion)) throw new Error("the page built no raid");
  region.world.getReadyTimer = 0;
  await act(() => Promise.resolve());
  const run = () => region.snapshot()?.run;
  const ticks = (count: number) => {
    for (let step = 0; step < count; step += 1) region.world.tickWorld();
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
  return { page, run, ticks, result };
}

describe("raid death", () => {
  beforeEach(() => localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } })));

  test.each([
    { id: "xarth", room: "Xarth", gear: "ranged", at: 10 },
    { id: "ocellus-p3", room: "Ocellus phase 3", gear: "melee", at: 14 },
  ])("$room shows You died on tick $at, and Restart and Retry seed keep the room", async ({ id, room, gear, at }) => {
    const navigation = captureNavigation();
    const fight = await openRaid(`/?encounter=${id}&seed=7&gear=${gear}`);
    fight.ticks(at + 1);
    const ended = fight.run();
    const shown = await fight.result();
    fight.page.click("result_retry");
    fight.page.click("invincible");
    fight.page.click("result_restart");
    fight.page.close();
    navigation.restore();

    expect({ ended, shown, navigation: navigation.assigned }).toEqual({
      ended: { kind: "ended", seed: seed(7), at: tick(at), reason: "death" },
      shown: { lines: ["You died", `on ${room} tick ${at}`], buttons: ["Restart", "Retry seed"] },
      navigation: [
        `http://localhost/?encounter=${id}&seed=7&gear=${gear}`,
        `http://localhost/?encounter=${id}&gear=${gear}&invincible=on`,
      ],
    });
  });
});
