# Where a phase 4 fight spends its time

A phase 4 fight on this machine spends the frame in one SDK call. `Viewport.draw` copies the WebGL canvas onto the page canvas, and that copy waits on the software GPU. The median frame is 33.3 ms. One busy tick of the fight, with rendering removed, takes 0.80 ms. A faster tick loop leaves the canvas copy in place, so it does not change the frame a player sees on this machine.

This VM renders with SwiftShader, a software GPU (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`). Chrome 156.0.8078.47, Node 22.23.4, 4 cores. There is no discrete graphics card in these numbers. A desktop GPU will spend less time inside the same copy, and these timings do not say how much less.

The SDK is the pin `f390629452ecfe5e1cb0a7d24ec4bb7ccdca5aa4` of [Julian-Dasilva/osrs-sdk](https://github.com/Julian-Dasilva/osrs-sdk). The fight is seed 1 with invincible on, at 1280 by 800. The harness is `scripts/perf-profile.mts`.

## Frame time on the production build

Five production fights, 150 s each, with no profiler and no trace attached. The page is the webpack production bundle. An extra animation callback records frame gaps, and it wraps `drawElements` and `drawArrays` to count them. That wrapper is on these runs. The profiled fight and the traced fight are separate, and their frame times are not the ones below.

| | Median of five | Range |
| --- | ---: | --- |
| Frame p50 | 33.3 ms | 33.3 ms on every run |
| Frame p95 | 50 ms | 49.9 to 50 ms |
| Frame p99 | 50.1 ms | 50.1 ms on every run |
| Slowest frame | 233 ms | 217 to 283 ms |
| Frames in 150 s | 5,008 | 4,853 to 5,190 |

The gaps sit on a 16.7 ms grid. That is a 60 Hz vsync. The frame misses one slot, so the next callback lands on the following one and the median is 33.3 ms. Frames also land at 16.7 ms and at 50 ms, which is the same 60 Hz grid.

Share of frames later than a vsync slot:

- Later than 16.7 ms: median 80% of frames, range 77% to 82%.
- Later than 33.4 ms: median 18%, range 16% to 21%.
- Later than 50 ms: median 1.4%, range 1.2% to 2.6%.

Long tasks are main-thread tasks over 50 ms, from `PerformanceObserver`. Median 45 tasks in a fight, range 42 to 100. Median total 2.8 s, range 2.8 s to 6.1 s. The slowest task in a fight was 220 to 283 ms. The first fight is the high end (100 tasks, 6.1 s). The median frame did not move, so those spikes are not what holds the frame at 33.3 ms.

WebGL draw calls (`drawElements` and `drawArrays`) are 505 to 525 per frame, median 523.

Used heap peaks about 30 s in, at 171 to 189 MB, then settles. The last sample is 153 to 168 MB. Growth from the first sample to the last is 22 to 54 MB, median 37 MB. The shape is a rise, a drop, and a band. This window does not show a leak that grows with the fight.

The canvas is 1280 by 800 and painted (15,234 to 16,514 non-black samples). Each fight issued 145 to 148 clicks and recorded 0 page errors and 0 console errors. Loading the assets took 6.7 to 7.1 s before the timer started.

One development-build fight of the same length, with the in-page probe, also has a p50 of 33.3 ms and 513 draw calls per frame. That is one run, so it is only a check that the development bundle is not the reason for the 33.3 ms. On that run the fight went from tick 8 to tick 241 (233 ticks, 233 log rows) in 150 s, about one tick per 644 ms against the 600 ms setting. The player walked to 24 tiles (117 walk orders). Boss hit points went from 1,312 to 1,619, with heals, floor hits, explosions, orbs, and rifts in the log. The fight was still running at the end. Combat draws were 11, so the player was walking through the fight more than attacking. The production build has no probe, so its tick count is not measured. The same URL starts the same fight, and the draw-call count matches.

## What the main thread was doing

One production fight, 151.2 s of CPU samples, profiler only. This run is not in the frame-time table. Idle samples are 5.8%. Shares below are of the whole profile, idle included. `unmapped` samples are 0 after the webpack map and the SDK map.

| Bucket | Time | Share |
| --- | ---: | ---: |
| Canvas copy (`drawImage`) | 128.9 s | 85.2% |
| three.js and SDK rendering | 9.7 s | 6.4% |
| Idle | 8.8 s | 5.8% |
| Other | 1.3 s | 0.9% |
| SDK tick and world logic | 1.1 s | 0.8% |
| HUD | 0.59 s | 0.4% |
| Garbage collection | 0.31 s | 0.2% |
| Ocellus fight code | 0.27 s | 0.2% |
| Pathing and collision | 0.12 s | 0.1% |
| React | 0.04 s | 0.0% |
| Input queue | 0.02 s | 0.0% |
| Asset decode during the fight | 0.00 s | 0.0% |

Asset decode shows up in the 7 s before the fight, not inside it.

A separate 150 s trace (no CPU profiler) agrees. `FireAnimationFrame` covers 141 s of the 150 s. Layout is 7 ms and paint is 3 ms across the whole trace. Main-thread GC in the trace is 98 ms of minor GC plus 207 ms of major GC, which matches the 0.31 s in the profile. Background marking runs off the main thread. `GPUTask` sums to 110 s. Those tasks overlap the canvas copy. They are the same wait seen from the GPU side. Adding them to the copy would count that wait twice. The trace file is complete (`dataLossOccurred` false).

The sample that dominates the profile is native `drawImage`. Its caller is `Viewport.draw` (`src/sdk/Viewport.ts`). V8 records the function at line 230. The WebGL copy is the call at line 243. A 12 s development fight, with `drawImage` timed and not used for the frame table, measured that split directly. The page copies two full-size canvases per frame, 2.00 per frame across 437 frames. The first copy is the WebGL `OffscreenCanvas`. It took 10.7 s of the 12 s, which is 24.5 ms per frame. The second copy is the UI canvas in the same function (line 245) and took 0.08 s. The stack is `Viewport.draw`, called from `World.browserLoop` (`src/sdk/World.ts` line 109).

That 24.5 ms is why the frame is not 16.7 ms. One call is already longer than a vsync slot, so the next callback lands at 33.3 ms. The other JavaScript in the frame is a few milliseconds. `renderer.render` itself runs on a second animation loop in `Viewport3d.animate` (`src/sdk/rendering/Viewport3d.ts` line 376) and is not the hot sample. The wait shows up when the 2D canvas reads the WebGL canvas back.

## Hottest functions

Same 151.2 s production profile. Self time. The owner is SDK, three.js, or the browser. No Ocellus function is in the ten.

| Function | File:line | Owner | Self time | Share |
| --- | --- | --- | --- | ---: |
| `drawImage` | `src/sdk/Viewport.ts:243` (sampled on `Viewport.draw` at line 230) | SDK | 127.6 s | 84.4% |
| `applyRawFrame` | `src/sdk/rendering/utils/animations.ts:121` | SDK | 2.30 s | 1.5% |
| `applyMayaFrame` | `src/sdk/rendering/utils/animations.ts:310` | SDK | 1.83 s | 1.2% |
| `drawImage` | `src/sdk/MapController.ts:416` (`MapController.draw`) | SDK | 0.75 s | 0.5% |
| `presentActorAnimation` | `src/sdk/rendering/CacheRenderModel.ts:556` | SDK | 0.56 s | 0.4% |
| `renderBufferDirect` | `node_modules/three/build/three.cjs:28827` | three.js | 0.32 s | 0.2% |
| `(garbage collector)` | browser | browser | 0.31 s | 0.2% |
| `toReference` | `node_modules/three/build/three.cjs:1603` | three.js | 0.29 s | 0.2% |
| `bufferSubData` | `node_modules/three/build/three.cjs:13518` | three.js | 0.26 s | 0.2% |
| `expandBounds` | `src/sdk/rendering/utils/clickbox.ts:114` | SDK | 0.23 s | 0.1% |

`toReference` at three.cjs:1603 is the sRGB-to-linear arrow. The production profile names that column `color`, which is the arrow's parameter. `bufferSubData` is three.js uploading vertex buffers after the pose update. `MapController.draw` is the minimap. Its `drawImage` calls start at line 431.

## Tick rate with rendering turned off

Five fresh processes per workload, 2,000 ticks each, jsdom, `force2d`, no `start()`, so nothing renders. They ran as two alternating batches (three idle and two busy, then three busy and two idle). The harness now treats `--runs 5 --workload alternate` as five of each in one go. Warmup of 30 ticks is outside the timer. Idle calls `tickWorld` only. Busy also calls `moveTo` on a rotating tile every tick, which paths more often than the scripted fight. Zero errors. Every run wrote 2,030 log rows. Boss hit points went from 1,312 to 4,956 idle and 4,957 busy, so the boss script ran. Busy moved the player on 1,916 of 2,000 ticks. Idle moved the player on 0.

| Workload | Median | Range | One tick |
| --- | ---: | --- | ---: |
| Idle | 21,727 ticks/s | 21,605 to 22,686 | 0.046 ms |
| Busy | 1,257 ticks/s | 1,193 to 1,311 | 0.80 ms |

The 600 ms tick budget is about 750 times the busy tick and about 13,000 times the idle tick. The idle tick still includes boss logic. The extra 0.75 ms in the busy tick is the per-tick `moveTo`. In the browser profile, pathing is 0.12 s of the whole fight.

SDK logic, Ocellus fight code, pathing, and the input queue together are 1.5 s of the 151 s profile, about 1.0%. Deleting that work can make the fight at most about 1% faster. It cannot move a 33.3 ms frame to 16.7 ms.

## Fixes with the largest payoff

1. Stop reading the WebGL canvas back every frame. SDK, `Viewport.draw` line 243. The profile puts 84% of the fight in this copy, and the timed wrapper puts 24.5 ms of every frame in it on this VM. Removing a piece that is 84% of the run can make the run at most about six times as fast, and only when the GPU work stays off the main thread after the copy is gone. If SwiftShader is finishing the draw calls during the copy, the wait moves into `renderer.render` and the frame stays put. The overlapping `GPUTask` time fits that reading. On a real GPU the same call is still a readback, and a readback stalls the GPU. This VM cannot price that stall. The change belongs in the SDK fork.

2. Cut the 523 draw calls per frame. SDK scene and three.js, `Viewport3d`. The renderer is created with `antialias: true` and `logarithmicDepthBuffer: true` (`Viewport3d.ts` lines 145 to 148). JavaScript inside three.js is 6.4% of the profile because the GPU wait is charged to the copy. Once the copy is gone, the draw count is the portable input to that wait. No millisecond saving is claimed. Measuring it needs a run with the copy removed, on SwiftShader and on a real GPU. The change belongs in the SDK fork.

3. Leave the pose update for later. SDK, `applyRawFrame` and `applyMayaFrame` in `animations.ts`. Together they are 4.1 s, 2.7% of the profile, about 0.9 ms per frame at this frame rate. Deleting both can make the fight at most about 2.8% faster. A WASM skinning path would land here, and the 33.3 ms frame would stay. The change belongs in the SDK fork.

4. Leave the minimap for later. SDK, `MapController.draw`. The copy there is 0.5% of the profile. Deleting it can make the fight at most about 0.5% faster. Worth doing after the WebGL copy.

Ocellus fight code is 0.2% of the profile, and React is under 0.1% (the page polls on a 300 ms timer). No Ocellus change is in this list.

A WASM port of the tick loop is the change these numbers argue against doing first. The ceiling is 1,257 busy ticks per second against a game that plays at 1.7. The frame limit is the canvas copy on this VM, and the draw-call count is the part most likely to still matter on a real GPU.

## Limits of this measurement

- SwiftShader is not a discrete GPU. Frame milliseconds from this VM do not transfer. The draw-call count does.
- The profiler and the trace each had their own fight. Frame p50, p95, and p99 come from the five unprofiled production fights.
- The development fight is one run. It matches production at p50. Its tail (p99 67 ms, one frame at 600 ms) is not a five-run result.
- Production clicks are offsets from the canvas centre. Development clicks use the probe's tile projection. Draw calls per frame match, and so does p50.
- The player mostly walks. Combat draws on the development fight were 11 in 150 s. Boss mechanics still ran.
- The frame observer adds one animation callback and a counter around the WebGL draw calls. It is present in every reported frame time. There is no paired fight with the observer removed, so those milliseconds include it.
- Headless ticks do not start the render loop. They answer how fast the tick is when drawing is gone. They do not answer how fast the page is.
