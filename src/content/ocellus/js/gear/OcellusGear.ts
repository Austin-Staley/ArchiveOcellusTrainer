import { AttackStyle, AttackStyleTypes, Chest, Gloves, Helmet, ImageLoader, Legs, RangedWeapon, ScytheOfVitur, TwistedBow } from "osrs-sdk";
import type { AttackBonuses, ProjectileOptions, Unit, UnitBonuses, UnitEquipment, Weapon } from "osrs-sdk";
import type { TrainerItemKey } from "../OcellusTimings";
import { OCELLUS_P4 } from "../OcellusTimings";

// The SDK matches set effects by its closed ItemName enum and Player.attack never applies void, so the trainer's
// weapons read the worn pieces by class and fold the set bonuses into their own rolls.

const { gear } = OCELLUS_P4;

function bonuses(key: TrainerItemKey): UnitBonuses {
  const { attack, defence, other } = gear.items[key].stats.value;
  return { attack: { ...attack }, defence: { ...defence }, other: { ...other }, targetSpecific: { undead: 0, slayer: 0 } };
}

const ICONS: Readonly<Record<TrainerItemKey, Readonly<{ set: string; piece: string; colour: string }>>> = {
  voidRangerHelm: { set: "Void", piece: "helm", colour: "#3d6b4f" },
  eliteVoidTop: { set: "Elite", piece: "top", colour: "#3d6b4f" },
  eliteVoidRobe: { set: "Elite", piece: "robe", colour: "#3d6b4f" },
  voidKnightGloves: { set: "Void", piece: "gloves", colour: "#3d6b4f" },
  inquisitorsGreatHelm: { set: "Inq", piece: "helm", colour: "#5a5f6e" },
  inquisitorsHauberk: { set: "Inq", piece: "body", colour: "#5a5f6e" },
  inquisitorsPlateskirt: { set: "Inq", piece: "skirt", colour: "#5a5f6e" },
  tonalzticsOfRalos: { set: "Ralos", piece: "spec", colour: "#8a5a2b" },
};

/** Cache 2746 extraction has no inventory icons, and committing sprites is not allowed, so trainer items draw a label. */
function icon(key: TrainerItemKey): HTMLImageElement {
  const { set, piece, colour } = ICONS[key];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="1" y="1" width="30" height="30" rx="5" fill="${colour}" stroke="#000"/><g fill="#fff" font-family="sans-serif" font-size="9" text-anchor="middle"><text x="16" y="14">${set}</text><text x="16" y="25">${piece}</text></g></svg>`;
  return ImageLoader.createImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
}

export class VoidRangerHelm extends Helmet {
  override inventorySprite = icon("voidRangerHelm");
  override get cacheItemId(): number {
    return gear.items.voidRangerHelm.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("voidRangerHelm");
  }
}

export class EliteVoidTop extends Chest {
  override inventorySprite = icon("eliteVoidTop");
  override get cacheItemId(): number {
    return gear.items.eliteVoidTop.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("eliteVoidTop");
  }
}

export class EliteVoidRobe extends Legs {
  override inventorySprite = icon("eliteVoidRobe");
  override get cacheItemId(): number {
    return gear.items.eliteVoidRobe.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("eliteVoidRobe");
  }
}

export class VoidKnightGloves extends Gloves {
  override inventorySprite = icon("voidKnightGloves");
  override get cacheItemId(): number {
    return gear.items.voidKnightGloves.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("voidKnightGloves");
  }
}

export class InquisitorsGreatHelm extends Helmet {
  override inventorySprite = icon("inquisitorsGreatHelm");
  override get cacheItemId(): number {
    return gear.items.inquisitorsGreatHelm.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("inquisitorsGreatHelm");
  }
}

export class InquisitorsHauberk extends Chest {
  override inventorySprite = icon("inquisitorsHauberk");
  override get cacheItemId(): number {
    return gear.items.inquisitorsHauberk.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("inquisitorsHauberk");
  }
}

export class InquisitorsPlateskirt extends Legs {
  override inventorySprite = icon("inquisitorsPlateskirt");
  override get cacheItemId(): number {
    return gear.items.inquisitorsPlateskirt.itemId.value;
  }
  override setStats(): void {
    this.bonuses = bonuses("inquisitorsPlateskirt");
  }
}

function wearsEliteVoid(equipment: UnitEquipment): boolean {
  return (
    equipment.helmet instanceof VoidRangerHelm &&
    equipment.chest instanceof EliteVoidTop &&
    equipment.legs instanceof EliteVoidRobe &&
    equipment.gloves instanceof VoidKnightGloves
  );
}

function rangedBonuses(weapon: Weapon, from: Unit, bonuses: AttackBonuses): AttackBonuses {
  return {
    ...bonuses,
    isAccurate: weapon.attackStyle() === AttackStyle.ACCURATE,
    voidMultiplier: wearsEliteVoid(from.equipment) ? gear.eliteVoid.value.accuracy : 1,
  };
}

const PRAYER_FACTORS = gear.rangedStrengthPrayers.value;
const strengthensRanged = (prayer: string): prayer is keyof typeof PRAYER_FACTORS => Object.prototype.hasOwnProperty.call(PRAYER_FACTORS, prayer);

/** The wiki's maximum ranged hit; the SDK's own formula leaves the void product unfloored and reuses it for damage. */
function rangedMaxHit(from: Unit, bonuses: AttackBonuses, weaponFactor: number): number {
  const prayer = bonuses.effectivePrayers?.range?.name;
  const prayerFactor = prayer !== undefined && strengthensRanged(prayer) ? PRAYER_FACTORS[prayer] : 1;
  const voidFactor = wearsEliteVoid(from.equipment) ? gear.eliteVoid.value.damage : 1;
  const strength = Math.floor((Math.floor(from.currentStats.range * prayerFactor) + (bonuses.isAccurate ? 3 : 0) + 8) * voidFactor);
  const base = Math.floor(0.5 + (strength * (from.bonuses.other.rangedStrength + 64)) / 640);
  return Math.floor(Math.floor(Math.floor(base * (bonuses.gearRangeMultiplier ?? 1)) * weaponFactor) * (bonuses.overallMultiplier ?? 1));
}

export class OcellusTwistedBow extends TwistedBow {
  override attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}): boolean {
    return super.attack(from, to, rangedBonuses(this, from, bonuses), options);
  }

  override _maxHit(from: Unit, to: Unit, bonuses: AttackBonuses): number {
    return rangedMaxHit(from, bonuses, this._damageMultiplier(from, to, bonuses));
  }
}

function inquisitorFactor(equipment: UnitEquipment): number {
  const perMille = gear.inquisitorCrushPerMille.value;
  const worn =
    (equipment.helmet instanceof InquisitorsGreatHelm ? perMille.inquisitorsGreatHelm : 0) +
    (equipment.chest instanceof InquisitorsHauberk ? perMille.inquisitorsHauberk : 0) +
    (equipment.legs instanceof InquisitorsPlateskirt ? perMille.inquisitorsPlateskirt : 0);
  return 1 + worn / 1000;
}

/** The SDK rolls every melee attack as slash; Jab rolls crush, and only crush earns Inquisitor's bonus. */
export class OcellusScythe extends ScytheOfVitur {
  override attack(from: Unit, to: Unit, bonuses: AttackBonuses): boolean {
    if (this.attackStyle() !== AttackStyle.AGGRESSIVECRUSH) return super.attack(from, to, bonuses);
    const gearMeleeMultiplier = (bonuses.gearMeleeMultiplier ?? 1) * inquisitorFactor(from.equipment);
    return super.attack(from, to, { ...bonuses, attackStyle: "crush", gearMeleeMultiplier });
  }
}

export class TonalzticsOfRalos extends RangedWeapon {
  override inventorySprite = icon("tonalzticsOfRalos");

  override get cacheItemId(): number {
    return gear.items.tonalzticsOfRalos.itemId.value;
  }

  override setStats(): void {
    this.bonuses = bonuses("tonalzticsOfRalos");
  }

  override attackStyles(): AttackStyle[] {
    return [AttackStyle.ACCURATE, AttackStyle.RAPID, AttackStyle.LONGRANGE];
  }

  override attackStyleCategory(): AttackStyleTypes {
    return AttackStyleTypes.THROWN;
  }

  override defaultStyle(): AttackStyle {
    return AttackStyle.RAPID;
  }

  override get attackSpeed(): number {
    const { rapidSpeed, otherSpeed } = gear.ralos.value;
    return this.attackStyle() === AttackStyle.RAPID ? rapidSpeed : otherSpeed;
  }

  override get attackRange(): number {
    const { range, longrangeRange } = gear.ralos.value;
    return this.attackStyle() === AttackStyle.LONGRANGE ? longrangeRange : range;
  }

  override attack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}): boolean {
    return this.throwBoth(from, to, bonuses, options);
  }

  override _maxHit(from: Unit, to: Unit, bonuses: AttackBonuses): number {
    return Math.floor(rangedMaxHit(from, bonuses, 1) * gear.ralos.value.hitMaxFraction);
  }

  override _accuracyMultiplier(from: Unit, to: Unit, bonuses: AttackBonuses): number {
    return bonuses.isSpecialAttack ? gear.division.value.accuracyFactor : 1;
  }

  override hasSpecialAttack(): boolean {
    return true;
  }

  override specialAttackDrain(): number {
    return gear.division.value.energy;
  }

  override specialAttack(from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}): boolean {
    return this.throwBoth(from, to, { ...bonuses, isSpecialAttack: true }, options);
  }

  /** Division drains as each hit rolls, so on an NPC the first drain lowers the second roll's defence. */
  private throwBoth(from: Unit, to: Unit, bonuses: AttackBonuses, options: ProjectileOptions): boolean {
    let thrown = false;
    for (let hit = 0; hit < gear.ralos.value.hits; hit++) {
      if (!super.attack(from, to, rangedBonuses(this, from, bonuses), options)) return thrown;
      thrown = true;
      if (bonuses.isSpecialAttack && this.damage > 0) {
        to.currentStats.defence = Math.max(0, to.currentStats.defence - Math.floor(to.currentStats.magic * gear.division.value.defenceDrainOfMagic));
      }
    }
    return thrown;
  }
}
