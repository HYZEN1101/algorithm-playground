# Performance Notes

Phase 7 deliverable per `PHASE_7_ACCESSIBILITY_PERFORMANCE.md`. Records
what was actually measured, not just what was assumed, and is honest about
what could NOT be measured in this environment.

## Environment limitation, stated up front

This project has been built entirely inside a sandboxed environment with
**no real browser available** — no way to open the actual app, watch a real
`requestAnimationFrame` loop run, or profile actual Canvas paint cost. Every
number below comes from running the underlying TypeScript modules directly
under Node (via `tsx`), which measures real CPU cost of the algorithm/data
layer accurately, but **cannot** measure:

- actual Canvas 2D paint/composite time
- real device pixel ratio scaling cost
- real `requestAnimationFrame` cadence/jank
- garbage-collection pauses under sustained 60fps allocation

The "manual perf check at 200×200: record actual frame behavior (smooth /
minor stutter / unusable)" acceptance criterion in the phase file
**requires a human with a real browser** — this document cannot satisfy it
directly. What follows is the algorithmic/data-layer half of the picture,
which is the half this environment can measure honestly, plus identification
of the specific things a human should watch for when they do the real-browser
check.

## What was measured (Node, `performance.now()`, 200×200 grid)

All numbers from a single representative run, seed 2024, density 0.15,
corner-to-corner (0,0) to (199,199). Not statistically rigorous (single run,
no warm-up iterations) — order-of-magnitude figures, which is what matters
for catching a real algorithmic blowup, not microbenchmark precision.

| Operation | Time |
|---|---|
| `new Grid(200, 200)` + full neighbor iteration over all 40,000 cells | 25.78 ms |
| `randomObstacles.generate(seed, 200, 200, 0.15)` | 3.42 ms |
| `bfs()` full run (170,700 events, 34,060 nodes explored) | 86.07 ms |
| `dfs()` full run (16,846 events, 2,666 nodes explored) | 17.22 ms |
| `dijkstra()` full run (170,700 events, 34,060 nodes explored) | 138.20 ms |
| `astar()` full run (133,626 events, 25,954 nodes explored) | 84.22 ms |
| `deriveNodeStates` (pure, one full replay of 170,700 events) | 16.91 ms |

All of the above are well within Phase 4's own manual check ("<a few hundred
ms even at 200×200") and comfortably fast enough that Run to Play never
feels like it's "loading" anything — this matches Phases 4/5's prior notes
and adds real Node-measured numbers behind what was previously an eyeballed
claim.

## The one real performance bug found and fixed on this project (pre-Phase-7, but exactly what this phase would have flagged)

This was actually found and fixed during a post-Phase-5 user bug-fix pass
(see `HANDOFF.md`), not during this phase itself — but it's exactly the risk
`ARCHITECTURE.md` §16/§20 and Phase 5's own notes predicted ("if scrubbing
feels laggy... this is the first place to look"), so it's recorded here in
full with real numbers, since this is the phase meant to formally close that
risk out.

**The bug**: `renderer.setPlaybackFrame()` originally called the pure
`deriveNodeStates(events, index)` — which replays the ENTIRE event array
from 0 — once per playback notification (i.e. up to the real device's rAF
rate while Play is active, dozens of times per second). As `index` grows
during a long run, each call does more work than the last.

**Measured cost of the old pattern**, simulated directly: calling the pure
`deriveNodeStates` repeatedly, advancing the index by 8 events each time
(roughly what a single rAF tick advances at a moderate configured speed),
across BFS's full 170,700-event timeline on the 200×200 grid above:

> **134,995.67 ms** (about 135 seconds) to fully play through the timeline
> this way.

**Measured cost of the fix** (`createIncrementalNodeStateDeriver`, applying
only the delta between calls instead of replaying from 0), same access
pattern, same timeline:

> **26.22 ms** — roughly **5,150x faster** for this exact scenario.

This is an extreme, worst-case-shaped number (it sums the cost of every
single one of roughly 21,000 individual `derive()` calls across the whole
run into one total), not a claim about real observed frame time — but it
makes unambiguous that the pre-fix pattern was not merely "a bit slower," it
was algorithmically the wrong shape (effectively quadratic over the course
of a full playthrough) and would have made any sufficiently long run
visibly grind to a halt well before reaching the end, exactly matching the
"playback still felt slow even at the raised speed ceiling" bug report that
prompted the fix.

**Status**: already fixed, already shipped, already covered by
`tests/playback/deriveNodeStates.test.ts`'s incremental-deriver test suite
(correctness) and this phase's own new
`tests/rendering/coordinates.perf.test.ts` (a loose regression-guard smoke
test, not a strict gate, per the phase file's own instruction).

## What a human should check in a real browser (not yet done)

1. **Actual paint smoothness at 200x200 during Play**, especially near the
   end of a long BFS/Dijkstra run on an open map (tens of thousands of
   visited cells drawn every frame in `pathRenderer.ts`'s three-pass overlay
   loop — see the known limitation below). Watch for dropped frames or
   visible stutter, not just "does it eventually finish."
2. **Interactive paint/drag responsiveness at 200x200** (already covered by
   Phase 2's own real-browser bug hunt and fix — the `WorldChange`
   partial-redraw system — but worth re-confirming after this phase's
   palette change, since the darker terrain fill colors are marginally more
   expensive to paint than the lighter originals, though this should be
   negligible).
3. **Real device-pixel-ratio cost** on an actual retina/high-DPR display —
   this environment cannot exercise a dpr != 1 canvas backing store at all.

## Known, unfixed limitation identified this phase (deferred, not silently dropped)

`pathRenderer.ts`'s `drawPathOverlay` does **three full passes** over the
current node-state map every frame it's dirty (one loop each for frontier,
visited, and path status) — cost proportional to the number of nodes
*touched so far*, not total events, so it's a much smaller and much less
severe cost than the `deriveNodeStates` issue above, but it is still real,
repeated per-frame work at large touched-node counts (up to 40,000 at
200x200 fully explored). Not fixed this phase — it wasn't the reported
bottleneck, and guideline §23 ("do not optimize blindly... profile actual
bottlenecks before introducing complex optimization") argues against
speculatively optimizing something not yet confirmed to matter. Flagged
here explicitly as the next thing to look at if a real-browser check in
item 1 above finds stutter during large-map playback that the
`deriveNodeStates` fix didn't already resolve — a single-pass version
(computing all three fill lists during the same map iteration, then
drawing) is the obvious fix if it's ever needed.
