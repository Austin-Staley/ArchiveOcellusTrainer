import { act } from "react";
import { DRILL_ROOMS, ENCOUNTERS } from "../../archive/catalog";
import { captureNavigation, loadPage } from "./page";

describe("encounter menu", () => {
  beforeEach(() => localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } })));
  afterEach(() => vi.unstubAllEnvs());

  test("phase 4 stays the fight when no encounter is chosen, and the menu can open Bork", () => {
    const page = loadPage("/?seed=1");
    const select = page.element("encounter");
    if (!(select instanceof HTMLSelectElement)) throw new Error("#encounter is not a select");
    const labels = [...select.options].map((option) => option.text);
    const phase4 = window.__archiveOcellusProbe?.snapshot().fight?.boss.hp;
    page.close();

    const navigation = captureNavigation();
    const again = loadPage("/?seed=1");
    act(() => {
      const menu = again.element("encounter");
      if (!(menu instanceof HTMLSelectElement)) throw new Error("#encounter is not a select");
      menu.value = "bork";
      menu.dispatchEvent(new Event("change", { bubbles: true }));
    });
    again.close();
    navigation.restore();

    const bork = loadPage("/?encounter=bork&seed=1");
    const chosen = bork.element("encounter");
    const borkHp = chosen instanceof HTMLSelectElement ? chosen.value : "";
    const hp = window.__archiveOcellusProbe?.snapshot().fight?.boss.hp;
    bork.close();

    expect(labels).toContain("Bork");
    expect(labels).toContain("Ocellus phase 4");
    expect(phase4).toBe(1312);
    expect(navigation.assigned).toEqual(["http://localhost/?encounter=bork"]);
    expect(borkHp).toBe("bork");
    expect(hp).toBe(1500);
  });

  test("with the phase flags on, the room list adds the upstream drills and a drill opens on its phase", () => {
    vi.stubEnv("ARCHIVE_P1", "on");
    vi.stubEnv("ARCHIVE_P2", "on");
    vi.stubEnv("ARCHIVE_P3", "on");
    const navigation = captureNavigation();
    const page = loadPage("/?seed=1");
    const select = page.element("encounter");
    if (!(select instanceof HTMLSelectElement)) throw new Error("#encounter is not a select");
    const labels = [...select.options].map((option) => option.text);
    act(() => {
      select.value = "drill-p3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    page.close();
    navigation.restore();

    expect(labels).toEqual([...ENCOUNTERS.map((item) => item.label), ...DRILL_ROOMS.map((room) => room.label)]);
    expect(navigation.assigned).toEqual(["http://localhost/?phase=p3&setup=ranged"]);
  });
});
