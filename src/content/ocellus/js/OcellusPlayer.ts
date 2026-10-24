import { Collision, Player } from "osrs-sdk";
import type { Location, MovePace, Region } from "osrs-sdk";
import type { PlayerObservation } from "./P4Types";
import { tile } from "../../../sim/brands";
import { protectionOf } from "../../../sim/sdk/EncounterBinding";
import type { OcellusBinding } from "./mobs/Ocellus";
import { Ocellus } from "./mobs/Ocellus";

export class OcellusPlayer extends Player {
  constructor(region: Region, location: Location, private readonly binding: () => OcellusBinding) {
    super(region, location);
  }

  observe(): PlayerObservation {
    return { tile: tile(this.location.x, this.location.y), hp: this.currentStats.hitpoint, prayer: protectionOf(this) };
  }

  override moveTo(x: number, y: number, pace: MovePace = "run-setting"): void {
    super.moveTo(x, y, pace);
    this.binding().input({ kind: "walk-ordered", destination: tile(x, y), pace });
  }

  /** The SDK redirects a blocked tile only when it is ordered, and a walk stops dead when its tile becomes blocked later. */
  override determineDestination(): void {
    super.determineDestination();
    const to = this.destinationLocation;
    if (to && Collision.collideableEntitiesAtPoint(this.region, to.x, to.y, 1).length > 0) super.moveTo(to.x, to.y, this.pace);
  }

  override pretick(): void {
    const before = protectionOf(this);
    super.pretick();
    const after = protectionOf(this);
    if (after !== before) this.binding().input({ kind: "prayer-published", prayer: after });
  }

  override postAttacksEvent(): void {
    super.postAttacksEvent();
    this.binding().playerHitsSettled();
  }

  override movementStep(): void {
    this.binding().playerMovement(() => super.movementStep());
  }

  override attack(): boolean {
    const swingsMelee = !this.manualSpellCastSelection && this.equipment.weapon?.isMeleeAttack === true;
    if (swingsMelee && this.aggro instanceof Ocellus && this.aggro.outOfMeleeReach()) return false;
    return super.attack();
  }

  override attackStep(): void {
    this.binding().combat(() => super.attackStep());
  }
}
