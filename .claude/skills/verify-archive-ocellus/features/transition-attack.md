# Transition attack

Ocellus rises when the inner void forms, hovers over it and lands when it clears. Two ticks after each void clears (P4 tick 32, then 60 after the outer void) he casts a transition attack, and its look tells the player which prayer to use: a purple vortex is magic, a dark disk with purple spikes is ranged, and a black disk with a purple semicircle is melee. Five ticks after the tell the attack hits every tile, including those under the boss. The prayer the player has when the hit lands decides the damage: the matching protection prayer takes 5 to 9, anything else 43 to 50.

## Sub-features

- `special-tell` logs `special-told` at P4 tick 32 and 60 of the first cycle, then every 60 ticks, with the variant and its style, and plays sequence 14844 with the variant's spotanim over the boss.
- `special-hit` logs `special-hit` 5 ticks after each tell with the style, whether the player was protected when it landed, and the landing receipt.
- `prayer-at-landing` judges the prayer the player has on the landing tick. A prayer clicked during tick 36 is up at 37; one clicked during tick 37 is late.
- `boss-landing` plays the rise at the inner void's onset, the hover through it and the landing when it clears.
- `special-choices` select the order with `specialSelection`: `random-uniform` (default, seeded), `rotation-magic-ranged-melee`, `replay-v1` or `replay-v2`.

## How to get to it (user POV)

- Open `http://127.0.0.1:8002/` and watch the boss after the inner void clears at P4 tick 30. The prayer book is open in the side panel.
- Pick `Transition attacks` in the `Focus` selector and press `Restart` to practise the tells alone.
- Add `specialSelection=replay-v2` to the URL for the order V2's kill ran: vortex, spike disk, black disk, then again.

## Driving it with agent-browser

Preconditions:

- The baseline preconditions in the index hold, and the explosions recipe has run.
- The prayer book is the open side panel when the page loads. Clicking its tab button closes it, so the recipe never clicks the tab.
- A click must reach the page between two game ticks. Each click batches a `wait --fn` on the P4 tick with the `mouse move/down/up`, as in the explosions recipe.

- **Pray before the landing.** Run `agent-browser open "http://127.0.0.1:8002/?seed=1&focus=transition-attacks&specialSelection=replay-v2"`. Screenshot `special-before.png` at P4 tick 31, after the landing and before the tell. In one batch, wait for tick 33 and click `PROTECT_MAGIC_RIGHT_PX` (514) right of and `PROTECT_DOWN_PX` (218) below the canvas centre, which is Protect from Magic in the prayer book. Screenshot `special-vortex.png` at tick 35. `log()` shows `prayer-published` magic in row 34, `special-told` vortex at 32 and `special-hit` at 37 with `protected: true` and receipt `{requested 8, applied 8, beforeHp 99, afterHp 91, prayer "magic"}`.
- **Pray late.** Open the same URL again. In one batch, wait for tick 37 and click Protect from Magic. Screenshot `special-spike-disk.png` at 63 and `special-black-disk.png` at 95. `log()` shows `prayer-published` magic first in row 38, `special-hit` at 37 with `protected: false` and receipt `{requested 49, applied 49, beforeHp 99, afterHp 50, prayer null}`, tells at 32 (vortex), 60 (spike disk) and 92 (black disk), and the run ending in death at 97.
- **Full fight.** The cycle recipe clicks Protect from Magic after tick 33 and Protect from Range (`PROTECT_RANGE_RIGHT_PX`, 551) after tick 61, so its player survives the vortex at 37 and the spike disk at 65.
- **Pixels.** The script counts tell pixels, vivid purple or near white, in `TELL_BOX`, a box from 200 left to 200 right and from 220 to 40 above the canvas centre, which holds the boss while the player stands on spawn. `special-before.png` must be under 0.3% and each tell shot at least 1% (measured 0, 6.5, 8.8 and 3.6).
- **Scripted.** `scripts/verify.sh browser` runs these steps after the explosions recipe and records `prayerBeforeLandingProtects`, `lateClickTakesFullHit`, `tellsToldOnSchedule` and `tellsDrawn` in `observed.json`, with the measurements under `observed.special`.

## Gotchas

- The prayer book positions hold for a 1280x800 viewport. A changed viewport or panel layout shows up as a missing `prayer-published` input, not a silent pass.
- The tell's centre renders white where the footage shows black. The shapes and the purple match V2 (k72 to k78, k100 to k106, k132 to k137); the data file records the difference.
- With no prayer, `replay-v2` kills a 99 HP player at 97: 49 at 37, 47 at 65 and the rest at 97.
- Clicking near a tick boundary can land the prayer a tick late. Click on the tick before you need it.
