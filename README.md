# Archive Ocellus Trainer

A free practice simulator for phase 4 of the Ocellus fight in The Fractured Archive.

**Status: early development.** Mechanics come from the community wiki and release-day reports. Timings are unverified and will change.

Built on [osrs-sdk](https://github.com/OldSchoolSDK/osrs-sdk), following the layout of [ColosseumTrainer](https://github.com/Supalosa/ColosseumTrainer).

## Development

Requires Node 22.

```sh
npm ci
scripts/install-beta-sdk.sh     # beta osrs-sdk packages, installed without saving; rerun after any npm ci
npm run assets -- --cache-dir <openrs2 cache dir> --reader-path <osrscachereader checkout>
npm start                       # http://127.0.0.1:8002
```

`npm run assets` extracts models from OpenRS2 cache 2746 into `public/osrs-assets/`, which is never committed.

## Deploy

`netlify.toml` tells Netlify to run `scripts/netlify-build.sh` on Node 22 and publish `dist`. The script installs the dependencies and the beta SDK, installs the cache reader at a pinned commit, extracts the models from OpenRS2 cache 2746, and builds the app. The models are published with the app under `dist/osrs-assets/`. The cache and the reader go in Netlify's build cache directory, `/opt/build/cache`. That Netlify restores this directory after a successful build is inferred, not documented. The source is a 2019 answer from Netlify staff on the Netlify support forum. Confirm it in the logs of the first two deploys. The second deploy logs `reusing cache reader` and `Using cached OpenRS2 cache 2746` when the directory was restored.

To connect the repository in the Netlify dashboard:

1. Import an existing project from GitHub and pick `Julian-Dasilva/ArchiveOcellusTrainer`.
2. Leave the base directory empty. Netlify reads the build command, the publish directory and the Node version from `netlify.toml`, so leave those fields as Netlify fills them.
3. Set the production branch to `main`, then deploy.

No environment variables are needed. `OSRS_CACHE_READER_REPO` and `OSRS_CACHE_READER_COMMIT` override the reader pin. To run the same build locally, set `NETLIFY_CACHE_DIR` to a writable directory:

```sh
NETLIFY_CACHE_DIR=/tmp/netlify-cache scripts/netlify-build.sh
```

## Credit

Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.

Game models are extracted from the game cache at build time and are not stored in this repository.

## Licence

GPL-3.0. See [LICENSE](LICENSE).
