import { act } from "react";
import { captureNavigation, loadPage } from "./page";

describe("Settings menu", () => {
  beforeEach(() => localStorage.setItem("osrs-sdk:settings", JSON.stringify({ version: 1, values: { use3dView: false } })));

  test("the Settings button opens the menu, a click inside keeps it open, and a second click, Escape, Escape in the seed box or a click outside closes it", () => {
    const page = loadPage("/?seed=1");
    const shown = () => [page.element("settings_menu").hidden === false, page.element("settings").getAttribute("aria-expanded")];
    const states: Record<string, unknown> = { onLoad: shown() };
    page.click("settings");
    states.afterClick = shown();
    act(() => void page.element("sound").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    states.afterClickInside = shown();
    page.click("settings");
    states.afterSecondClick = shown();
    page.click("settings");
    page.press("Escape");
    states.afterEscape = shown();
    page.click("settings");
    page.press("Escape", page.element("seed"));
    states.afterEscapeInSeedBox = shown();
    page.click("settings");
    act(() => void document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    states.afterClickOutside = shown();
    states.restartOutsideMenu = page.element("settings_menu").contains(page.element("restart"));
    page.close();

    expect(states).toEqual({
      onLoad: [false, "false"],
      afterClick: [true, "true"],
      afterClickInside: [true, "true"],
      afterSecondClick: [false, "false"],
      afterEscape: [false, "false"],
      afterEscapeInSeedBox: [false, "false"],
      afterClickOutside: [false, "false"],
      restartOutsideMenu: false,
    });
  });

  test("guard, controls unchanged: a setup chosen in the open menu is the one Restart loads", () => {
    const navigation = captureNavigation();
    const page = loadPage("/?seed=3");
    page.click("settings");
    act(() => {
      const setup = page.element("setup");
      if (!(setup instanceof HTMLSelectElement)) throw new Error("#setup is not a select");
      setup.value = "melee";
      setup.dispatchEvent(new Event("change", { bubbles: true }));
    });
    page.click("restart");
    page.close();
    navigation.restore();
    expect(navigation.assigned).toEqual(["http://localhost/?setup=melee&focus=full-fight"]);
  });
});
