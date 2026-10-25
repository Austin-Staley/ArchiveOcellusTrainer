import type { Changelog } from "../../releases";

export const CHANGELOG: Changelog = [
  {
    version: "2026.10.25.2",
    notes: [
      "Change your mind before the tick, like in game. Whatever you click last before the tick is what you do.",
      "A click made right before the tick registers on that tick, instead of a tick late.",
      "The 2D view draws each frame into a canvas a little larger than the game view instead of one 10,000 pixels wide, so it lags less on slower computers. To help find the cause of lag, a random sample of runs now sends an anonymous performance summary when it ends: frame and tick timings, 2D or 3D, screen scale, game size, CPU cores, graphics card maker, browser, run length and how it ended.",
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
