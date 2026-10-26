import {
  AmuletOfRancour,
  AttackStyle,
  AttackStylesController,
  AvernicTreadsMax,
  Chest,
  DizanasQuiver,
  DragonArrows,
  FerociousGloves,
  Helmet,
  ImageLoader,
  InfernalCape,
  ItemName,
  Legs,
  MasoriBodyF,
  MasoriChapsF,
  MasoriMaskF,
  NecklaceOfRupture,
  ScytheOfVitur,
  TwistedBow,
  UltorRing,
  VenatorRing,
  ZaryteVambraces,
} from "osrs-sdk";
import type { Player, UnitBonuses } from "osrs-sdk";
import { itemIconFile } from "../../assets";
import { OCELLUS_P4 } from "../ocellus/js/OcellusTimings";
import type { GearPlan } from "./catalog";

const { gear } = OCELLUS_P4;

// The combat tab reads names from the SDK enum. These three join it at runtime for the crush armour.
Object.assign(ItemName, {
  INQUISITORS_GREAT_HELM: "Inquisitor's great helm",
  INQUISITORS_HAUBERK: "Inquisitor's hauberk",
  INQUISITORS_PLATESKIRT: "Inquisitor's plateskirt",
});

type InquisitorKey = "inquisitorsGreatHelm" | "inquisitorsHauberk" | "inquisitorsPlateskirt";

function pieceBonuses(key: InquisitorKey): UnitBonuses {
  const { attack, defence, other } = gear.items[key].stats.value;
  return { attack: { ...attack }, defence: { ...defence }, other: { ...other }, targetSpecific: { undead: 0, slayer: 0 } };
}

function inventoryIcon(itemId: number): HTMLImageElement {
  return ImageLoader.createImage(`osrs-assets/${itemIconFile(itemId)}`);
}

export class InquisitorsGreatHelm extends Helmet {
  override inventorySprite = inventoryIcon(this.cacheItemId);
  override get itemName(): ItemName {
    return ItemName.INQUISITORS_GREAT_HELM;
  }
  override get cacheItemId(): number {
    return gear.items.inquisitorsGreatHelm.itemId.value;
  }
  override setStats(): void {
    this.bonuses = pieceBonuses("inquisitorsGreatHelm");
  }
}

export class InquisitorsHauberk extends Chest {
  override inventorySprite = inventoryIcon(this.cacheItemId);
  override get itemName(): ItemName {
    return ItemName.INQUISITORS_HAUBERK;
  }
  override get cacheItemId(): number {
    return gear.items.inquisitorsHauberk.itemId.value;
  }
  override setStats(): void {
    this.bonuses = pieceBonuses("inquisitorsHauberk");
  }
}

export class InquisitorsPlateskirt extends Legs {
  override inventorySprite = inventoryIcon(this.cacheItemId);
  override get itemName(): ItemName {
    return ItemName.INQUISITORS_PLATESKIRT;
  }
  override get cacheItemId(): number {
    return gear.items.inquisitorsPlateskirt.itemId.value;
  }
  override setStats(): void {
    this.bonuses = pieceBonuses("inquisitorsPlateskirt");
  }
}

/** Ranged is the twisted bow on rapid with Masori (f). Crush is the scythe on jab with Inquisitor armour. The style is set on the worn weapon. */
export function dress(player: Player, plan: GearPlan): void {
  switch (plan) {
    case "ranged": {
      const weapon = new TwistedBow();
      player.equipment.weapon = weapon;
      player.equipment.helmet = new MasoriMaskF();
      player.equipment.chest = new MasoriBodyF();
      player.equipment.legs = new MasoriChapsF();
      player.equipment.gloves = new ZaryteVambraces();
      player.equipment.cape = new DizanasQuiver();
      player.equipment.necklace = new NecklaceOfRupture();
      player.equipment.feet = new AvernicTreadsMax();
      player.equipment.ring = new VenatorRing();
      player.equipment.ammo = new DragonArrows();
      player.equipmentChanged();
      AttackStylesController.controller.setWeaponAttackStyle(weapon, AttackStyle.RAPID);
      return;
    }
    case "melee": {
      const weapon = new ScytheOfVitur();
      player.equipment.weapon = weapon;
      player.equipment.helmet = new InquisitorsGreatHelm();
      player.equipment.chest = new InquisitorsHauberk();
      player.equipment.legs = new InquisitorsPlateskirt();
      player.equipment.gloves = new FerociousGloves();
      player.equipment.cape = new InfernalCape();
      player.equipment.necklace = new AmuletOfRancour();
      player.equipment.feet = new AvernicTreadsMax();
      player.equipment.ring = new UltorRing();
      player.equipment.ammo = new DragonArrows();
      player.equipmentChanged();
      AttackStylesController.controller.setWeaponAttackStyle(weapon, AttackStyle.AGGRESSIVECRUSH);
      return;
    }
    default: {
      const unhandled: never = plan;
      return unhandled;
    }
  }
}
