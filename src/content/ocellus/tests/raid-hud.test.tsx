import { readFileSync } from "node:fs";
import { act } from "react";
import { RaidRegion } from "../../archive/RaidRegion";
import { loadPage } from "./page";

const CHAT_POLL_WAIT_MS = 400;

function drawRandomSeeds(values: readonly number[]) {
  const queue = [...values];
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (array: Uint32Array) => {
        array[0] = queue.shift() ?? 0;
        return array;
      },
    },
  });
}

async function loadRaid(url: string) {
  const built = vi.spyOn(RaidRegion.prototype, "initialiseRegion");
  const page = loadPage(url);
  await act(() => new Promise((resolve) => setTimeout(resolve)));
  const region = built.mock.contexts.at(-1);
  built.mockRestore();
  if (!(region instanceof RaidRegion)) throw new Error("the page built no raid region");
  return { page, region };
}

function tick(region: RaidRegion, steps: number) {
  region.world.getReadyTimer = 0;
  for (let step = 0; step < steps; step += 1) region.world.tickWorld();
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, CHAT_POLL_WAIT_MS)));
}

describe("phase 2 labels and the chat window", () => {
  const crypto = globalThis.crypto;
  beforeEach(() => localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } })));
  afterEach(() => Object.defineProperty(globalThis, "crypto", { configurable: true, value: crypto }));

  test("the fork build leaves the three phase flags on", () => {
    const config = readFileSync("webpack.config.js", "utf8");
    expect(config).toContain('ARCHIVE_P1: "on"');
    expect(config).toContain('ARCHIVE_P2: "on"');
    expect(config).toContain('ARCHIVE_P3: "on"');
  });

  test("after eight lines the panel shows the newest volley, and the colour label shows the quadrant", async () => {
    const { page, region } = await loadRaid("/?encounter=ocellus-p2&seed=5&invincible=on");
    tick(region, 22);
    await settle();
    const spoken = region.chat();
    const newest = spoken[spoken.length - 1] ?? "";
    const panel = [...document.querySelectorAll("#game_chat li")].map((line) => line.textContent).join(" ");
    const call = document.querySelector("#portal_call")?.textContent;
    page.close();

    expect(spoken).toHaveLength(8);
    expect(region.chatMark()).toBeGreaterThan(8);
    expect(panel).toContain(newest);
    expect(call).toBe("red · NE");
  });

  test("a phase 2 room with no seed draws a fresh one, and that seed picks the opening colour", async () => {
    drawRandomSeeds([4, 8]);
    const first = await loadRaid("/?encounter=ocellus-p2&invincible=on");
    tick(first.region, 12);
    await settle();
    const firstView = { seed: first.page.value("seed"), call: document.querySelector("#portal_call")?.textContent };
    first.page.close();

    const second = await loadRaid("/?encounter=ocellus-p2&invincible=on");
    tick(second.region, 12);
    await settle();
    const secondView = { seed: second.page.value("seed"), call: document.querySelector("#portal_call")?.textContent };
    second.page.close();

    expect({ firstView, secondView }).toEqual({
      firstView: { seed: "4", call: "red · NW" },
      secondView: { seed: "8", call: "green · NW" },
    });
  });
});
