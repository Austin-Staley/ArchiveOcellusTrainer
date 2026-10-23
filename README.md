# Archive Ocellus Trainer

A free practice simulator for phase 4 of the Ocellus fight in The Fractured Archive.

**Status: early development.** Mechanics come from the community wiki and release-day reports. Timings are unverified and will change.

Play it at https://archive-ocellus-trainer.raid-sims.workers.dev. Add `?invincible=on` to the link to practise without dying, or open **Settings** in the game and tick **Invincible**. Pick a single mechanic to drill from **Focus** in the same menu.

Built on [osrs-sdk](https://github.com/OldSchoolSDK/osrs-sdk), following the layout of [ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer).

## Development

Requires Node 22.

```sh
npm ci
scripts/install-beta-sdk.sh     # beta osrs-sdk packages, installed without saving; rerun after any npm ci
npm run assets -- --cache-dir <openrs2 cache dir> --reader-path <osrscachereader checkout>
npm start                       # http://127.0.0.1:8002
```

`npm run assets` extracts models from OpenRS2 cache 2746 into `public/osrs-assets/`, which is never committed. It then draws an inventory icon for each of the trainer's own items, and for the Masori (f) pieces and Zaryte vambraces, from the item's model in the same cache, the way the game client draws it, into `public/osrs-assets/item-icons/`, and writes the boss's overhead icons from the cache's sprite index into `public/osrs-assets/sprites/`. `npm run item-icons` with the same two options redraws only the icons. The icon renderer in `src/itemIcons/` is ported from RuneLite's cache tool under its BSD 2-clause licence.

## Credit

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

Game models are extracted, and item icons drawn, from the game cache at build time. Neither is stored in this repository.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
