import type { Changelog } from "../../releases";

export const CHANGELOG: Changelog = [
  {
    version: "2026.10.26.7",
    notes: [
      "In phase 1, Ocellus alternates the captured charge and slam animations on the 8-tick beat those 32 fights show most often.",
      "Phase 2 draws the volley as ground graphic 4304. Projectile 4269 still has no source, so it is not drawn.",
      "Phase 3 draws graphic 4325 on the spin. The phase 4 loop is unchanged.",
    ],
  },
  {
    version: "2026.10.26.6",
    notes: [
      "The Smorks stand on the tile where every capture put them, and their bomb uses graphic 4440.",
      "Phase 1 shows the Hooded Figure, and the Guardian room shows the four batteries, on the captured tiles.",
      "The cauldron visits the six tiles from the one captured fight. That fight did not record the order.",
      "Projectiles 4056, 4057 and 4269, the Blade and vine animations, Ocellus's death, and hitsplat type 11 stay stand-ins.",
    ],
  },
  {
    version: "2026.10.26.5",
    notes: [
      "The Blade stands in the centre of its tile marker. The drawn sword starts above the model origin, and phase 2 lowers it onto that marker.",
      "The blade tip stays inside the opening view.",
    ],
  },
  {
    version: "2026.10.26.4",
    notes: [
      "Phase 2 shows one Blade, the sword on the boss tile. Phase 1 no longer draws the pair beside it.",
      "The Blade's tile marker and health bar sit on that sword, and the opening view frames it.",
    ],
  },
  {
    version: "2026.10.26.3",
    notes: [
      "Phase 2 draws The Blade in the colours stored on its scenery model.",
      "The Blade stands on the centre of the arena.",
    ],
  },
  {
    version: "2026.10.26.2",
    notes: [
      "Attack sounds this cache does not store are left out, so a missing sound no longer stops the room.",
      "In phase 2 the Blade stands as its own model on the tile where it was captured. The captures record no animation, so it stands still.",
      "Dying in any room shows You died with that room's tick, and Restart and Retry seed, the same as phase 4.",
    ],
  },
  {
    version: "2026.10.26.1",
    notes: [
      "Bosses play recorded stand, attack and death animations, and hits show as hitsplats.",
      "Each room wears a ranged or crush setup, and Settings can switch it.",
      "The arena is the captured map region. Ocellus's floor uses that overlay's map colour. A few projectiles, the Blade's animations, and Ocellus's death animation are still stand-ins.",
      "The Archive Guardian stays down 35 ticks, then 41, then 47.",
    ],
  },
  {
    version: "2026.10.25.6",
    notes: [
      "Bork, Ezekiel, the Archive Guardian, Moia, Xarth, the Dagon'hai trio, and Ocellus phases 1 to 3 now show an arena, you, and the bosses in the 3D view.",
      "The arena floor is a coloured stand-in, because no map id is recorded for these rooms. Flying shots are coloured stand-ins, because no projectile graphic id is recorded.",
      "The phase 3 censers are coloured boxes. They are scenery, and this view has no model for them.",
    ],
  },
  {
    version: "2026.10.25.5",
    notes: [
      "Killing a void augmenter sets Attack and Strength to 116 and Magic and Ranged to 112, the published buff for a player who started at 99. The augmenter has 44 hitpoints.",
      "Each room's chat names any count that is still an unsourced practice stand-in, including the bomb interval, the mushroom interval, Moia's vanish, and the phase 1 tendril counts.",
      "A mushroom within one tile deals 10. Two tiles away it deals 4, the top of the published 3–4.",
    ],
  },
  {
    version: "2026.10.25.4",
    notes: [
      "Settings has an encounter menu for Bork, Ezekiel, the Archive Guardian, Moia, Xarth, the Dagon'hai trio, and Ocellus phases 1 to 3. With no encounter chosen, phase 4 is the same fight as before.",
      "A perfect dodge of a phase 4 explosion halves your weapon cooldown, rounded down. Settings can switch that to cooldown minus 3. The two agree for a 5-tick or 6-tick weapon and differ for a 4-tick weapon.",
      "The airborne half is Deflect Melee and the grounded half is Deflect Range. The 60-tick loop is unchanged.",
      "In phase 1 he walks the corners under Protect from Melee, then seven tendrils and a two-tile slam. At 66% and 25% he comes to the centre. In phase 3 you tank: two melee hits, a wave, and after two waves the charged blade.",
    ],
  },
  {
    version: "2026.10.25.3",
    notes: [
      "The void shards of each explosion now come in high over your head, from the game's own effect, so you can see the cue to step while you move.",
      "In 2D the shards draw on top of your square instead of under it.",
    ],
  },
  {
    version: "2026.10.25.2",
    notes: [
      "Change your mind before the tick, like in game. Whatever you click last before the tick is what you do.",
      "A click made right before the tick registers on that tick, instead of a tick late.",
      "To help find the cause of lag, a random sample of runs now sends an anonymous performance summary when it ends: frame and tick timings, 2D or 3D, screen scale, game size, CPU cores, graphics card maker, browser, run length and how it ended.",
      "The summary has no ID, no cookies and nothing that names you. Page views are counted with Cloudflare Web Analytics, which also uses no cookies. Web Analytics loads on every page view unless you opt out. Only the performance summary is sampled.",
      "To turn both off, open Settings and untick Send anonymous performance data. Page view counting stops from the next page load.",
    ],
  },
  {
    version: "2026.10.25.1",
    notes: [
      "Melee attacks always hit a void rift for your max hit, as ranged attacks already did.",
      "A special attack, such as Ralos's Division, still rolls its damage against a void rift.",
    ],
  },
  {
    version: "2026.10.24",
    notes: [
      "Ocellus has 5,250 HP for a solo or duo team, as the wiki lists, so phase 4 starts at 1,312.",
      "While the void explosions are going off, Ocellus takes 60% less damage, as the wiki describes.",
      "The back wall by the brazier is one smooth diagonal up to the jut, so you walk along it instead of around each corner.",
    ],
  },
  {
    version: "2026.10.23",
    notes: [
      "Hold Control and click a tile to walk there instead of running, like in game.",
      "Healing orbs never form on void puddles. The outer orb forms opposite where you entered the 5x5, and the inner orb lingers into the attack you pray against.",
      "In the melee phase you path around Ocellus instead of running under him.",
      "The east edge by the brazier gets its extra tile: 3 straight tiles, then the diagonal.",
      "Void puddles start stacked in the same corner tiles you'd use in game.",
    ],
  },
];
