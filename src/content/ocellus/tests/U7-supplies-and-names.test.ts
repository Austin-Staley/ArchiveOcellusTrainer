import type { Item } from "osrs-sdk";
import { startDrill } from "./drill";

type Drill = ReturnType<typeof startDrill>;

const menu = (drill: Drill, item: Item): string[] => item.contextActions(drill.player()).map((option) => option.text.map((block) => `${block.text}`).join(""));
const hovers = (drill: Drill): string[] => drill.player().inventory.flatMap((item) => (item ? [menu(drill, item)[0]] : []));

describe("U7 item names and supplies", () => {
  test("every item the ranged setup carries or wears shows its name in the inventory menu", () => {
    const drill = startDrill({ selection: { setup: "ranged" } });
    const carried = hovers(drill);
    const helm = drill.player().inventory[2];
    const helmMenu = helm ? menu(drill, helm) : [];
    for (const item of [...drill.player().inventory].slice(1)) item?.inventoryLeftClick(drill.player());
    const switchedOut = hovers(drill);
    drill.dispose();

    expect(helmMenu).toEqual(["Equip Inquisitor's great helm", "Drop Inquisitor's great helm", "Examine Inquisitor's great helm"]);
    expect(carried).toEqual([
      "Equip Tonalztics of Ralos",
      "Equip Scythe of Vitur",
      "Equip Inquisitor's great helm",
      "Equip Inquisitor's hauberk",
      "Equip Inquisitor's plateskirt",
      "Equip Ferocious gloves",
      "Equip Infernal cape",
      "Equip Amulet of torture",
      "Equip Primordial boots",
      "Equip Ultor ring",
    ]);
    expect(switchedOut).toEqual([
      "Equip Tonalztics of Ralos",
      "Equip Twisted Bow",
      "Equip Void ranger helm",
      "Equip Elite void top",
      "Equip Elite void robe",
      "Equip Void knight gloves",
      "Equip Dizana's Quiver",
      "Equip Necklace of Anguish",
      "Equip Pegasian Boots",
      "Equip Venator ring",
    ]);
  });
});
