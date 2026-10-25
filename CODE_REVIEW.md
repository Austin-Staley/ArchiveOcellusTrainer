# Code review

Read this before you review a change to the trainer, whether you are a person or an agent. It lists the performance mistakes to look for and the check that proves them. Players have reported lag, so a review judges performance as well as correctness.

## Look for these performance red flags

Each flag below is a pattern that costs frame time or memory on a player's machine. A flag is a finding only when it comes with an executable proof: a measured regression from `scripts/verify.sh perf`, or a test or script that shows the growth or the extra work.

- Work per frame that could run once per tick. The world ticks every 600 ms and the browser draws up to 60 frames a second, so per-frame work runs about 36 times as often.
- Allocation inside a frame or tick loop, including new `THREE` geometries, textures, materials and canvases. Build them once and reuse them, as `VoidFloorModel` in `src/content/ocellus/js/entities/P4Views.ts` does for each void kind.
- A draw call per tile, per shard or per particle where one batched mesh would do. Each mesh is at least one draw call.
- A canvas larger than the viewport times `devicePixelRatio`. The 2D view's backing canvas is 10,000 by 10,000 pixels today, about 98 times a 1280 by 800 viewport.
- An entity, view, listener or timer that is never disposed. A model's `destroy` must dispose the geometries, materials and textures it owns, not only remove them from the scene.
- An array, map or log that grows without bound over a long run.
- A first-use asset fetch, image decode or shader compile in the middle of the fight. Load and warm these before P4 starts.

A change to rendering, the tick loop, entities, views or input states its performance effect in the pull request. If it touches those paths, the author runs `scripts/verify.sh perf` and reports the frame-time p95, the tick-gap p95 and the draw calls.

## Run the perf stage

```sh
source ~/osrs-sims/env.sh                     # Node 22 on this machine
scripts/verify.sh assets perf                 # assets once, then the perf stage
VERIFY_PERF_BASE=<rev> scripts/verify.sh perf # compare against a base other than the merge base with origin/main
```

The stage builds production bundles for the working tree (the head) and for the base, serves both on `VERIFY_PRODUCTION_PORT` (default 8003), and drives seeded passive fights in headless Chrome. `src/perf/observer.js` records every animation frame, every world tick, each 3D render's draw calls, the renderer's geometry and texture counts, and the largest canvas the page allocates. `src/perf/check.ts` turns the captures into a verdict. Evidence lands in `<evidence>/perf/captures/` and `<evidence>/perf-checks.json`.

Each run uses `?seed=1&invincible=on`, stands still, and runs from P4 tick 8 to P4 tick 80, so the void rifts that spawn at tick 67 are on screen for the last 13 ticks. The stage runs 5 pairs of base and head runs in each view and alternates their order, then one long 3D head run to P4 tick 400. The whole stage takes about 22 minutes on an M3 Max and on a GitHub Actions runner, where the `perf` job in `.github/workflows/test.yml` runs it for every pull request.

## Read the verdict

`src/perf/perfGate.json` holds every budget and the timing rule. The stage fails when any line fails.

The hard budgets do not depend on machine speed. The draw-call, canvas and texture budgets are set to the value measured on `main` when the gate landed, which was the same on an M3 Max and on a GitHub Actions runner, so the stage passes on `main` and fails on any regression. The geometry budget has an allowance, described below.

| Budget | What the stage measures |
| --- | --- |
| `drawCallsMedian3d` | The median draw calls per 3D render in the fight window, worst head run |
| `drawCallsMax3d` | The most draw calls in one 3D render in the fight window, worst head run |
| `canvasToViewport2d` | The largest canvas backing store in the 2D view, in pixels, divided by the viewport's pixels times `devicePixelRatio` squared |
| `geometriesPerRetiredRift3d` | The renderer's geometry count gained between P4 ticks 220 and 400, which sit at the same point of the 60-tick cycle, divided by the rifts retired in between |
| `texturesPerRetiredRift3d` | The same for textures |

The resource count starts at P4 tick 220 because the page loads models during its first cycles, and loads them more slowly when it draws fewer frames. At three frames a second the geometry count still grows from loading between ticks 160 and 220, and by tick 220 it has stopped.

From tick 220 the geometry count on `main` grows by 4 every cycle, 12 over the 6 rifts the window retires, which is 2 per rift. On a GitHub Actions runner the count also gains a lasting geometry at a random tick about once every 150 ticks, so a runner usually measures 13 or 14. The budget of 2.67 allows 16, which is 4 of those extra geometries. A rift that leaks one geometry adds 6 over the window and fails. A smaller leak, such as one geometry every third rift, stays under the budget.

Frame-time p95 and tick-gap p95 depend on the machine and its load. The stage compares them against the base build on the same machine at the same seed. For each pair it divides the head's value by the base's value, and it fails when the median of those ratios exceeds `timing.medianRatioLimit`, which is 1.25.

The limit rests on 10 runs whose base and head ship the same game code, 5 on an M3 Max with its GPU and 5 on a GitHub Actions runner with software WebGL. Every median ratio fell between 0.994 and 1.003. Every per-pair ratio fell between 0.984 and 1.011 except one. On the runner, one base run drew its 3D frames at 49.9 ms instead of 33.5 ms, a ratio of 0.67, and the median of 5 pairs absorbed it. The median is why one slow run cannot fail the stage. A limit of 1.25 sits more than 40 times above the medians' noise and leaves room for a busy machine, while a 300 ms stall in every frame raises the frame-time ratio far past it. Frame times move in whole display refreshes of 16.7 ms, so the frame-time measure moves only when a frame misses a refresh. The hard budgets catch slower costs, such as extra draw calls, on any machine.

## Tighten a budget

When a change lowers a measured value, lower its budget in `src/perf/perfGate.json` to the new value in the same pull request. Raise a budget only when the pull request says why the extra cost is worth it, because a raised budget hides the next regression of the same size.
