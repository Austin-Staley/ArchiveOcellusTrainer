import { Player, Random } from "osrs-sdk";
import type { Location, MovePace, Region } from "osrs-sdk";
import type { InputObservation, PlayerObservation, Style, Tile } from "./P4Types";
import { tile } from "./P4Types";
import { Ocellus } from "./mobs/Ocellus";
import type { CombatStream } from "./p4/roll";

export class OcellusPlayer extends Player {
  private steps: readonly Tile[] = [];

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

  get stepsThisTick(): readonly Tile[] {
    return this.steps;
  }

  override movementStep(): void {
    const queued = this.visualPath.length;
    super.movementStep();
    // The SDK exposes a run's first step only as the tile it queues for rendering.
    this.steps = this.visualPath.slice(queued).map(({ x, y }) => tile(x, y));
  }

  override moveTo(x: number, y: number, pace: MovePace = "run-setting"): void {
    super.moveTo(x, y, pace);
    this.report({ kind: "walk-ordered", destination: tile(x, y), pace });
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
