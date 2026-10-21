import {
  AmuletOfTorture,
  AttackStyle,
  AttackStylesController,
  DizanasQuiver,
  DragonArrows,
  FerociousGloves,
  InfernalCape,
  NecklaceOfAnguish,
  PegasianBoots,
  PrimordialBoots,
  UltorRing,
  VenatorRing,
} from "osrs-sdk";
import type { Item, Player, UnitEquipment } from "osrs-sdk";
import type { GearKeys, GearSlot, ResolvedChoices, Setup } from "./OcellusTimings";
import { OCELLUS_P4 } from "./OcellusTimings";
import {
  EliteVoidRobe,
  EliteVoidTop,
  InquisitorsGreatHelm,
  InquisitorsHauberk,
  InquisitorsPlateskirt,
  OcellusScythe,
  OcellusTwistedBow,
  TonalzticsOfRalos,
  VoidKnightGloves,
  VoidRangerHelm,
} from "./gear/OcellusGear";

type SlotItem<S extends GearSlot> = NonNullable<UnitEquipment[S]>;

const ITEMS: { readonly [S in GearSlot]: { readonly [K in GearKeys[S]]: () => SlotItem<S> } } = {
  weapon: { twistedBow: () => new OcellusTwistedBow(), scytheOfVitur: () => new OcellusScythe(), tonalzticsOfRalos: () => new TonalzticsOfRalos() },
  helmet: { voidRangerHelm: () => new VoidRangerHelm(), inquisitorsGreatHelm: () => new InquisitorsGreatHelm() },
  chest: { eliteVoidTop: () => new EliteVoidTop(), inquisitorsHauberk: () => new InquisitorsHauberk() },
  legs: { eliteVoidRobe: () => new EliteVoidRobe(), inquisitorsPlateskirt: () => new InquisitorsPlateskirt() },
  gloves: { voidKnightGloves: () => new VoidKnightGloves(), ferociousGloves: () => new FerociousGloves() },
  cape: { dizanasQuiver: () => new DizanasQuiver(), infernalCape: () => new InfernalCape() },
  necklace: { necklaceOfAnguish: () => new NecklaceOfAnguish(), amuletOfTorture: () => new AmuletOfTorture() },
  feet: { pegasianBoots: () => new PegasianBoots(), primordialBoots: () => new PrimordialBoots() },
  ring: { venatorRing: () => new VenatorRing(), ultorRing: () => new UltorRing() },
  ammo: { dragonArrows: () => new DragonArrows() },
};

const isSlot = (key: string): key is GearSlot => Object.prototype.hasOwnProperty.call(ITEMS, key);
const SLOTS: readonly GearSlot[] = Object.keys(ITEMS).filter(isSlot);

function create<S extends GearSlot>(slot: S, key: GearKeys[S]): SlotItem<S> {
  return ITEMS[slot][key]();
}

function wear<S extends GearSlot>(equipment: UnitEquipment, slot: S, setup: Setup): void {
  equipment[slot] = create(slot, setup[slot]);
}

const STANCES: Readonly<Record<typeof OCELLUS_P4.gear.scytheStance.value, AttackStyle>> = { jab: AttackStyle.AGGRESSIVECRUSH };

export function dress(player: Player, setup: ResolvedChoices["setup"]): void {
  const worn = setup.option.value;
  for (const slot of SLOTS) wear(player.equipment, slot, worn);

  const others = Object.values(OCELLUS_P4.choices.setup.options).filter((option) => option !== setup.option);
  const switches: Item[] = [create("weapon", OCELLUS_P4.gear.specialWeapon.value)];
  for (const other of others) {
    for (const slot of SLOTS) {
      if (other.value[slot] !== worn[slot]) switches.push(create(slot, other.value[slot]));
    }
  }
  switches.forEach((item, index) => (player.inventory[index] = item));
  player.equipmentChanged();
  AttackStylesController.controller.setWeaponAttackStyle(new OcellusScythe(), STANCES[OCELLUS_P4.gear.scytheStance.value]);
}
