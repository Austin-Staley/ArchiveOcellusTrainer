import { Collision, Player, Random } from "osrs-sdk";
import type { Location, MovePace, Region } from "osrs-sdk";
import type { InputObservation, PlayerObservation, Style } from "./P4Types";
import { tile } from "../../../sim/brands";
import { Ocellus } from "./mobs/Ocellus";
import type { CombatStream } from "./p4/roll";

export class OcellusPlayer extends Player {
  private orderedPace: MovePace = "run-setting";

  constructor(
    region: Region,
    location: Location,
    private readonly combat: CombatStream,
    private readonly report: (input: InputObservation) => void,
    private readonly settle: () => void,
  ) {
    super(region, location);
  }

  get combatDraws(): number {
    return this.combat.draws;
  }

  get protection(): Style | null {
    if (this.prayerController.matchFeature("melee")) return "melee";
    if (this.prayerController.matchFeature("range")) return "ranged";
    if (this.prayerController.matchFeature("magic")) return "magic";
    return null;
  }

  observe(): PlayerObservation {
    return { tile: tile(this.location.x, this.location.y), hp: this.currentStats.hitpoint, prayer: this.protection };
  }

  override moveTo(x: number, y: number, pace: MovePace = "run-setting"): void {
    this.orderedPace = pace;
    super.moveTo(x, y, pace);
    this.report({ kind: "walk-ordered", destination: tile(x, y), pace });
  }

  /** The SDK redirects a blocked tile only when it is ordered, and a walk stops dead when its tile becomes blocked later. The SDK keeps the order's pace private, so the player holds it to re-order at the same pace. */
  override determineDestination(): void {
    super.determineDestination();
    const to = this.destinationLocation;
    if (to && Collision.collideableEntitiesAtPoint(this.region, to.x, to.y, 1).length > 0) super.moveTo(to.x, to.y, this.orderedPace);
  }

  override pretick(): void {
    const before = this.protection;
    super.pretick();
    const after = this.protection;
    if (after !== before) this.report({ kind: "prayer-published", prayer: after });
  }

  override postAttacksEvent(): void {
    super.postAttacksEvent();
    this.settle();
  }

  override attack(): boolean {
    const swingsMelee = !this.manualSpellCastSelection && this.equipment.weapon?.isMeleeAttack === true;
    if (swingsMelee && this.aggro instanceof Ocellus && this.aggro.outOfMeleeReach()) return false;
    return super.attack();
  }

  override attackStep(): void {
    const previous = Random.randomFn;
    Random.setRandom(() => this.combat.next());
    try {
      super.attackStep();
    } finally {
      Random.setRandom(previous);
    }
  }
}
