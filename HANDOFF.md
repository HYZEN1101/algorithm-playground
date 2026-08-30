# HANDOFF

Purpose: this file is the single place a new session (human or LLM) reads
first to know exactly where the project stands. Update it at the end of
every phase — before moving to the next one, not after starting it.

---

## How to Use This File (read this if you're picking up the project)

1. Read `ARCHITECTURE.md` in full — it has all architectural decisions and is
   the source of truth for interfaces, folder structure, and the five-layer
   state boundary (World/Algorithm/Playback/Render/UI state).
2. Read the "Current Status" section below to see what phase is active.
3. Open `phases/PHASE_<N>_*.md` for that phase — it is self-contained: goals,
   files to create/modify, acceptance criteria, and explicit non-goals.
4. Do not start a phase whose prerequisite phase's acceptance criteria aren't
   all checked off below.
5. When a phase is finished: check off its acceptance criteria in that
   phase's file, fill in its "Notes / Decisions to Record When Done" section,
   then update the "Current Status" and "Phase Log" sections below, then move on.

---

## Current Status

**Active phase:** Phase 8 (Testing Hardening, Polish, README, Deployment) — COMPLETE, plus a post-Phase-8 addendum fixing two real UI issues found in the first actual screenshots of the running app (stale "Phase 6" header label; near-invisible Start/Goal markers at default grid density). This closes the pathfinding MVP, with two explicitly-flagged exceptions (live deployment, recorded demo video — see the Phase 8 log entry below).
**Next phase to start:** Phase 9 — Comparison Mode (post-MVP; create `phases/PHASE_9_COMPARISON_MODE.md` when picked up).
**Blocking issues:** none for continued development. Two Phase 8 work items
could not be completed inside this sandboxed environment (no network
access to any static host; no screen-recording capability) — both are
fully prepared (production build verified working standalone; a written,
timestamped demo script provided) and left as the one remaining human
action item. See the Phase 8 log entry below for specifics.
**Repo state:** MVP feature-complete per requirements §31's Definition of
Done. All four pathfinding algorithms, real playback, Inspector + Metrics,
keyboard navigation, reduced-motion support, and a WCAG AA-audited palette
are all in place and tested. `README.md` rewritten as the portfolio-facing
entry point (previous planning-docs-index content preserved via a
"Continuing development" section pointing to `HANDOFF.md`/`ARCHITECTURE.md`).
227/227 tests passing; production build verified to serve standalone via
`npm run preview`.

---

## Phase Log

Append one entry per completed phase. Do not delete earlier entries — this
log is the project's institutional memory.

### Phase 0 — Architecture
- Status: COMPLETE
- Output: `ARCHITECTURE.md`, all Phase 1–8 files under `phases/`.
- Key decisions: event-timeline execution model (adapted per algorithm, not
  forced-identical); eager/synchronous algorithm execution (no generators);
  hand-rolled stores via `useSyncExternalStore` instead of a state library;
  diagonal movement excluded from MVP scope; DFS never labeled "shortest
  path" in UI; priority queue tie-break = insertion order.
- Deferred/non-goals confirmed: Sorting, Game Mode, Genetic Algorithms,
  Reinforcement Learning, Comparison Mode (pushed to a post-MVP Phase 9),
  maze/cellular-automata generators, shareable-scenario URLs.

### Phase 0 Addendum — Specification Amendments (pre-Phase-1)
- Status: COMPLETE. Grid encapsulation via `equals()`; diagonal movement/
  Euclidean-Chebyshev fully out of MVP scope (not just defaulted off);
  A*-vs-Dijkstra "explores fewer nodes" demoted from automated test to
  manual demonstration; event-architecture rule and state-ownership rule
  both confirmed already-correct and made explicit/permanent in
  `ARCHITECTURE.md` §5/§1.

### Phase 0 Addendum 2 — Documentation Consistency Pass (pre-Phase-1)
- Status: COMPLETE. Documentation-only pass: `ARCHITECTURE.md` made
  self-contained (five-layer state table and event-timeline reasoning
  written directly into the doc, not deferred to chat history);
  `PHASE_2_CANVAS_GRID.md` renamed to `PHASE_2_CANVAS.md`; this file's own
  Phase 0 entry corrected to match Addendum 1's diagonal-movement scope;
  all eight roadmap phase files confirmed present and consistent.

### Phase 1 — Project Foundation
- Status: COMPLETE
- Files created: `package.json`, `tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`,
  `src/types/shared.ts`, `src/world/terrain.ts`, `src/world/grid.ts`,
  `src/world/generators/rng.ts`, `src/world/generators/randomObstacles.ts`,
  `tests/world/grid.test.ts`, `tests/world/generators/randomObstacles.test.ts`,
  plus `tests/world/generators/rng.test.ts` (testing a deliverable the
  phase already committed to, not scope creep).
- Dependency versions: react/react-dom 18.3.1, @types/react 18.3.31,
  @types/react-dom 18.3.7, @vitejs/plugin-react 4.7.0, typescript 5.9.3,
  vite 5.4.21, vitest 2.1.9.
- Known issue (documented, not fixed): moderate esbuild dev-server
  advisory via `vite` <=6.4.2 (GHSA-67mh-4wv8-2f99); fixing needs a
  `vite@8` major bump, not applied without confirmation. Dev-server only.
- `Grid` API implemented exactly as ARCHITECTURE.md §3 specifies, including
  `equals()`; no leaking accessor exists. `randomObstacles` density is a
  0–1 fraction of Wall cells, both extremes tested.
- Verification: `tsc --noEmit` clean; 3 test files / 39 tests passing;
  `npm run build` succeeds; dev server serves correctly.

### Phase 2 — Canvas Rendering & Grid Interaction
- Status: COMPLETE
- Files created: `src/state/worldStore.ts`, `src/rendering/coordinates.ts`,
  `src/rendering/canvas/theme.ts`, `src/rendering/canvas/gridRenderer.ts`,
  `src/rendering/canvas/renderer.ts`, `src/components/grid/CanvasGrid.tsx`,
  `src/components/grid/useGridInteraction.ts`,
  `src/components/layout/AppShell.tsx`,
  `src/components/controls/TerrainPicker.tsx`,
  `src/components/controls/GenerateButton.tsx`, `src/vite-env.d.ts`,
  `src/index.css`, `tests/rendering/coordinates.test.ts`,
  `tests/state/worldStore.test.ts`.
- Key decisions: explicit tool-selection model for painting (not
  click-to-toggle); "Road (erase)" instead of a separate erase tool;
  default grid 100×100 (ARCHITECTURE.md §16's supported target);
  auto-generate on load via the same seeded generator the Generate button
  uses; fixed density constant (0.22), no UI slider yet; static-layer
  redraw counter gated behind `import.meta.env.DEV`.
- Theme/accessibility note: Grass/Water/Mud fail 3:1 contrast against Road
  on color alone; mitigated with distinct fill patterns per terrain type,
  a partial fix — full audit deferred to Phase 7 (flagged proactively).
- Verification: `tsc --noEmit` clean at both 100×100/200×200; 5 test
  files / 84 tests passing; `npm run build` succeeds; import-boundary
  greps clean (`world/`, `rendering/` still have zero disallowed imports;
  `renderer.ts` has exactly one importer).

### Phase 2 Addendum — Bugs Found in Real-Browser Testing, Fixed
- Status: COMPLETE. Three real-browser-only bugs found and fixed:
  (1) laggy interaction from full 10,000-cell static-layer regeneration on
  every drag pointermove — fixed via a `WorldChange` payload
  (`{kind:"cells"|"full"|"none"}`) so paint/move edits redraw only the
  affected cells; (2) walls misaligned with the cursor — a DPR
  double-scaling bug in the blit step, fixed by resetting the visible
  canvas's transform to identity before `drawImage`; (3) the redraw
  counter's rapid increase during drag was corroborating evidence for bug
  (1), not a separate bug. Verification: `tsc --noEmit` clean, 94/94 tests
  passing (84 + 10 new `WorldChange`-payload tests), `npm run build`
  succeeds. Flagged for Phase 5: `PlaybackController` will want the same
  "what changed" granularity for its own notifications.

### Phase 3 — BFS + DFS
- Status: COMPLETE
- Files created: `src/algorithms/pathfinding/types.ts`,
  `src/algorithms/pathfinding/bfs.ts`, `src/algorithms/pathfinding/dfs.ts`,
  `src/algorithms/shared/neighbors.ts`, `src/state/runStore.ts`,
  `src/rendering/canvas/pathRenderer.ts` (marked TEMPORARY throughout,
  Phase 5 has since replaced its temporary status — see below),
  `src/components/controls/AlgorithmPicker.tsx` (marked TEMPORARY,
  likewise superseded by Phase 5), `tests/algorithms/bfs.test.ts`,
  `tests/algorithms/dfs.test.ts`.
- Key decisions: `pathLength` counts steps/edges (`max(0, path.length-1)`),
  not raw cell count, resolving a real conflict between ARCHITECTURE.md's
  comment and this phase's own start==goal test requirement;
  `nodesExplored` counts VISIT_NODE (dequeue/pop) events; blocked
  start/goal → immediate `pathFound:false`, never silently relocated; DFS
  is iterative (explicit stack) for stack-depth safety at 200×200; the
  algorithm-result overlay used its own cached offscreen layer, mirroring
  the world layer's dirty-flag pattern, specifically so Phase 5 would have
  an isolated seam to swap in playback-index-driven rendering — which is
  exactly what happened.
- Verification: `tsc --noEmit` clean; 7 test files / 121 tests passing;
  `npm run build` succeeds; import-boundary and event-vocabulary greps
  clean (BFS emits `UPDATE_DISTANCE` never `UPDATE_SCORES`; DFS never
  mentions `distance`, uses `order` instead).

### Phase 4 — Dijkstra + A*
- Status: COMPLETE
- Files created: `src/algorithms/shared/priorityQueue.ts`,
  `src/algorithms/pathfinding/heuristics.ts`,
  `src/algorithms/pathfinding/dijkstra.ts`,
  `src/algorithms/pathfinding/astar.ts`, plus
  `src/algorithms/shared/pathReconstruction.ts` (extracted shared
  `reconstructPath`/`computePathMetrics` once BFS/DFS/Dijkstra/A* all
  needed the identical logic — duplication across 4 files, not premature
  abstraction), `tests/algorithms/shared/priorityQueue.test.ts`,
  `tests/algorithms/dijkstra.test.ts`, `tests/algorithms/astar.test.ts`.
- Files modified: `src/state/runStore.ts` (`AlgorithmName` extended to
  include `"dijkstra" | "astar"`), `src/components/controls/AlgorithmPicker.tsx`
  (added Dijkstra/A* options, no heuristic selector — Manhattan is the only
  exposed option).
- Key decisions: lazy-deletion priority queue (simpler than decrease-key,
  correct at this scale); `ADD_TO_FRONTIER` fires exactly once per node on
  first discovery, even though distance/score can update again before
  settling; A* heuristic is unconditionally Manhattan in the MVP;
  admissibility proved analytically (min terrain cost 1, Manhattan is
  exactly the minimum unweighted step count) plus a spot-check test.
- **Flagship demonstration** (100×100, density=0.15, corner-to-corner,
  seed 2024): `bfs nodesExplored=8480 pathLength=198`; `dijkstra
  nodesExplored=8480 pathLength=198`; `astar nodesExplored=6895
  pathLength=198` — A* visibly explores fewer nodes for the identical
  optimal path, confirmed manually before Phase 6 builds on it, per the
  amended non-brittle testing rule.
- Verification: `tsc --noEmit` clean; 10 test files / 162 tests passing;
  `npm run build` succeeds.
- Environment note: sandbox reset mid-phase, recovered from the durable
  `algorithm-playground-phase3.zip` backup in `/mnt/user-data/outputs`; no
  code lost.

### Phase 4 Addendum — Missing Start-Node Distance Event (found during Phase 5)
- Status: COMPLETE. While building Phase 5's `deriveNodeStates` reducer
  and its required test coverage ("hand-built event sequences"), a real
  gap surfaced: `bfs.ts` and `dijkstra.ts` never emitted an event carrying
  the start node's own `distance = 0`. `finalNodeState` was never wrong
  (both files set the start node's `distance: 0` directly in
  `finalNodeState` from the beginning) — but `deriveNodeStates` can only
  reconstruct `NodeState` by replaying `events[]`, and without a
  corresponding event, scrubbing playback to any index before the start
  node's own `VISIT_NODE` would show its distance as `undefined`, even
  though `distance = 0` is known from the very first instant. `astar.ts`
  already did this correctly (`UPDATE_SCORES` for the start node at
  g=0). **Fix**: both `bfs.ts` and `dijkstra.ts` now emit `{ type:
  "UPDATE_DISTANCE", nodeId: start, distance: 0 }` immediately after
  `ADD_TO_FRONTIER` for the start node, mirroring `astar.ts`'s existing
  pattern. No test in `bfs.test.ts`/`dijkstra.test.ts` asserted an exact
  event array, so this required no test changes and introduced no
  regressions — reverified: 162/162 Phase 1–4 tests still pass unchanged.
  Recorded here rather than silently folded into the Phase 5 diff, per
  this file's own rule ("note the deviation and why in that phase's
  section — don't silently diverge") — the deviation is technically
  Phase 4's algorithm code, even though Phase 5's work is what surfaced it.
- **Also discovered, not a bug**: `dfs.ts`'s `order` field (discovery
  order) is set directly on `finalNodeState` with no corresponding
  `AlgorithmEvent` carrying it — replaying events alone can't recover it
  through any existing event type. Resolved without touching `dfs.ts` at
  all: `order` is always exactly "the Nth `VISIT_NODE` event processed so
  far" (0-indexed), which `deriveNodeStates` (Phase 5) reconstructs by
  counting `VISIT_NODE` events during replay. This adds a harmless `order`
  field to BFS/Dijkstra/A*'s derived state too (nothing reads it there);
  not a correctness issue, just noted so a future exact-equality test
  against derived state isn't surprised by it.

### Phase 5 — Playback Controller
- Status: COMPLETE
- Files created: `src/playback/types.ts` (`PlaybackState` + an injectable
  `FrameScheduler` interface), `src/playback/controller.ts`
  (`PlaybackController`), `src/playback/deriveNodeStates.ts`
  (`deriveNodeStates` + `findCurrentNode`), `src/state/playbackStore.ts`
  (`playbackController` singleton + throttled `usePlaybackState()` hook),
  `src/components/controls/PlaybackControls.tsx`,
  `tests/playback/controller.test.ts`, `tests/playback/deriveNodeStates.test.ts`.
- Files modified: `src/rendering/canvas/renderer.ts` (removed the Phase
  3/4 temporary `setAlgorithmResult(finalNodeState)` method entirely;
  replaced with `setPlaybackFrame(events, index)`, which derives the live
  `NodeState` map via `deriveNodeStates` and the current-node highlight via
  `findCurrentNode` on every call), `src/rendering/canvas/pathRenderer.ts`
  (now renders frontier — dashed border, distinct fill — visited, path,
  and a current-node ring, all from the live derived map, not a static
  snapshot; the core `drawOverlayCell` primitive from Phase 3/4 was reused
  unchanged, exactly as that phase's file-level comment anticipated),
  `src/components/controls/AlgorithmPicker.tsx` ("Run" now also calls
  `playbackController.load(result.events)` + `.play()`; temporary-phase
  comments removed since this is now real, permanent behavior),
  `src/components/grid/CanvasGrid.tsx` (subscribes directly to
  `playbackController`, not `runStore`, per ARCHITECTURE.md §7's "Canvas
  subscribes directly, no React re-render" rule), `src/components/layout/AppShell.tsx`
  (wires `PlaybackControls` into a real bottom bar, updates header label).
- **Scheduler injectability (documented deviation from ARCHITECTURE.md
  §7's literal snippet)**: `PlaybackController`'s constructor accepts an
  optional `FrameScheduler` (`requestFrame`/`cancelFrame`/`now`),
  defaulting to real `requestAnimationFrame`/`cancelAnimationFrame`/
  `performance.now()` in production. This project's Vitest config has no
  jsdom, so plain Node has no `requestAnimationFrame` at all — the
  injectable scheduler is what makes "mock/fake timestamps in the test,
  don't rely on real rAF timing" (this phase's own acceptance criterion)
  possible without adding a jsdom dependency this project doesn't
  otherwise need. Every method in ARCHITECTURE.md §7's public API
  (`load`/`play`/`pause`/`reset`/`stepForward`/`stepBackward`/`seek`/
  `setSpeed`/`subscribe`/`getState`) is implemented exactly as specified;
  only the internal timing mechanism is injectable.
- **Fake-scheduler correctness bug found and fixed during test-writing**:
  the first version of the test file's fake scheduler marked a frame
  handle "cancelled" without actually clearing the pending callback, so a
  subsequent `fireFrame()` could still fire a tick the controller had
  legitimately cancelled (e.g. via `pause()`) — this would have silently
  masked real pause/reset bugs rather than catching them. Fixed before
  being relied upon for any assertion; the final `controller.test.ts`
  includes a comment explaining why this matters, not just what the fix
  was.
- **Play-at-end behavior (a minor ambiguity the phase file didn't fully
  spec, resolved with a documented default)**: calling `play()` when
  `index >= events.length` is a no-op, not an automatic restart-from-0.
  The phase file explicitly says Reset "does NOT re-run the algorithm...
  re-running is a separate 'Run' action," and by the same logic, Play at
  the end shouldn't silently loop or restart — Reset is the one explicit
  action for going back to index 0. Tested directly
  (`controller.test.ts`, "play() at the end of the timeline is a no-op").
- **Current-node + frontier visualization added beyond pathRenderer.ts's
  Phase 3/4 minimal styling**: the phase's behavior spec explicitly
  requires "current node, frontier, visited, and path are all derived
  live" — Phase 3/4's `pathRenderer.ts` only drew visited/path (there was
  no "current node" or animating frontier concept yet, since nothing was
  live). Added a dashed-border frontier fill and a red current-node ring
  (via the new `findCurrentNode` helper) so Play visibly shows frontier
  expansion and a moving "current node" marker, not just a growing blob of
  visited cells. Visual language is still deliberately simple/placeholder
  — richer non-color-only encoding (diagonal hatch, icons) is Phase 7/8
  polish, not Phase 5's job.
- **React re-render throttling**: `usePlaybackState()` throttles to
  100ms (10/sec) via a pending-value + `setTimeout` pattern — chosen as a
  round number well under human text-reading perceptibility while still
  feeling live; `CanvasGrid`/`renderer.ts` subscribe to the controller
  directly (unthrottled) since the Canvas overlay needs every tick to
  animate smoothly, per ARCHITECTURE.md §10's split between Canvas
  (direct, every tick) and React (throttled, ~10/sec).
- **`deriveNodeStates` incremental-update optimization**: NOT implemented
  this phase. Full reduction from 0 on every call was used throughout
  (called once per playback notification, i.e. up to ~60/sec while
  playing) — no measured slowness observed in this environment (no
  browser available to profile against ARCHITECTURE.md §16's 200×200
  worst case directly), so per guideline §23 ("do not optimize blindly"),
  this is deferred to Phase 7's performance pass, which already has a
  named action item for exactly this risk (ARCHITECTURE.md §16/§20). Flag
  this explicitly for whoever does Phase 7's manual 200×200 check — if
  scrubbing feels laggy at that grid size, this is the first place to look.
- Verification:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → 12 test files, **200 tests passing** (162 from
    Phases 1–4, unchanged, including the Phase 4 addendum's fix + 38 new:
    25 `controller.test.ts`, 13 `deriveNodeStates.test.ts`)
  - `npm run build` → succeeds
  - Dev server → every new/modified module resolves (HTTP 200, no compile
    errors): `playbackStore.ts`, `playback/controller.ts`,
    `PlaybackControls.tsx`, `pathRenderer.ts`, confirmed via curl
  - Import-boundary greps: `playback/` has zero imports of react/
    components/rendering/state (framework-agnostic, as required);
    `renderer.ts` still has exactly one importer project-wide
    (`CanvasGrid.tsx`); no stale references to the removed
    `setAlgorithmResult` method anywhere in `src/`
  - No React state holds playback index/isPlaying directly — verified by
    inspection: `PlaybackControls` and `CanvasGrid` both read exclusively
    from `playbackController`/`usePlaybackState()`, never `useState` for
    playback fields themselves.
- **What still needs a human in a real browser** (can't be verified
  headlessly): the phase file's own manual acceptance criterion — Run BFS,
  confirm Play animates frontier expansion and path draw at a legible
  pace, Pause freezes it, Step Forward/Backward moves exactly one event,
  Reset returns to empty state without re-computing, Speed slider visibly
  changes pace. Also unverified: actual React re-render frequency of
  `PlaybackControls` during real browser playback (the throttle logic is
  unit-testable in isolation but its real-world rate depends on the
  browser's actual rAF cadence, which this sandbox has no browser to
  measure).
- Known limitations: no keyboard grid-cell navigation yet (Phase 7); no
  Inspector/Metrics UI yet beyond the existing step-counter text in
  `PlaybackControls` (Phase 6); frontier/current-node visuals are
  functional placeholders, not the final accessibility-audited visual
  language (Phase 7/8).
- Decisions relevant to Phase 6: `deriveNodeStates(events, index)` is
  exactly what `NodeInspector` needs for the selected node at the current
  playback index (ARCHITECTURE.md §11) — call it with
  `playbackController.getState()`'s `events`/`index` directly, the same
  way `renderer.ts` already does. `usePlaybackState()` is the throttled
  hook Phase 6's `MetricsPanel` should read `index`/`events.length` from
  for its live "Nodes Explored so far" counter, per this phase's note that
  it must be driven by the same index source of truth as the renderer, not
  a separately-computed value that could drift.

### Post-Phase-5 Bug Fix / Enhancement Pass (user bug report, pre-Phase-6)
- Status: COMPLETE. Three items from a direct user bug report, addressed
  outside the formal phase sequence since none required new architecture —
  Phase 6 (Inspector + Metrics) is still next.
- **Bug: move-start/move-goal showed a "grab" hand cursor instead of a
  crosshair.** `CanvasGrid.tsx`'s cursor logic was inverted from what the
  interaction actually does — dropping start/goal on a wall snaps back
  rather than allowing genuine free-form dragging, so the "grab" hand
  cursor (which implies exactly that free-form dragging) was misleading.
  Fixed: cursor is now `"crosshair"` for every tool, including
  move-start/move-goal. The `useWorldState()` subscription that existed
  solely to re-render this component on tool change (for the old
  per-tool cursor logic) was removed along with it, since the cursor no
  longer varies by tool — nothing else in `CanvasGrid.tsx` needed that
  subscription.
- **Feature: dynamic, user-settable grid size.** Previously the grid was
  fixed at `DEFAULT_GRID_WIDTH`/`DEFAULT_GRID_HEIGHT` (100×100) with no UI
  to change it (Phase 2's own notes flagged this as a manual
  constant-editing exercise, not a real control). Added:
  - `worldStore.resizeGrid(width, height, density?)` — a new mutator,
    documented as a harder reset than `generateRandom`: since
    `NodeId = row * width + col`, changing `width` makes every existing
    NodeId meaningless, so this regenerates a fresh grid at the new
    dimensions (same seed + density, still deterministic/reproducible)
    and recomputes default start/goal from scratch rather than attempting
    to remap old NodeIds — there's no sensible remapping for a dimension
    change.
  - `clampGridDimension()` + exported `MIN_GRID_DIMENSION` (5) /
    `MAX_GRID_DIMENSION` (300) constants — 5 is small enough to be usable
    without start/goal placement colliding; 300 is chosen as comfortably
    past ARCHITECTURE.md §16's 200×200 stress target into territory this
    project has never measured, a deliberately conservative ceiling rather
    than an arbitrary large number.
  - A "Grid size" control (width × height number inputs + "Resize Grid"
    button) added to `GenerateButton.tsx`, alongside the existing seed
    input — same local-state-then-commit pattern as the seed field.
  - `runStore.clearResults()` — new method, and `resizeGrid`'s UI handler
    also calls `playbackController.load([])` after resizing. This is
    necessary, not cosmetic: an old algorithm result's events/
    `finalNodeState` reference NodeIds computed against the *previous*
    width, so replaying them against the new grid via `coordOf()` would
    silently compute wrong (but validly in-range) coordinates rather than
    erroring — a correctness bug, not just stale-looking UI, if left
    unhandled.
  - Explicitly NOT applied to `generateRandom`/`clear()` (same-dimension
    world edits) — Phase 3's original notes already consciously deferred
    that decision ("worth a conscious decision once Phase 5's real
    playback system exists... not silently carried forward indefinitely"),
    and a same-width edit doesn't have the hard NodeId-corruption problem
    a resize does, only the softer "overlay looks stale" issue. Left as a
    separate decision for whoever picks it up, rather than silently
    expanding this bug-fix pass's scope.
  - Tests added directly to `tests/state/worldStore.test.ts`
    (`resizeGrid` and `clampGridDimension` describe blocks): dimension
    change, clamping both directions, start/goal relocation validity on a
    shrunk grid, single "full" change notification (not per-cell), and
    determinism (same seed + dimensions round-trip to an identical grid
    via `Grid.equals()`, consistent with `generateRandom`'s own
    reproducibility guarantee). Since `worldStore` is a module-level
    singleton shared across the whole test file, this new describe block
    restores default dimensions in its own `afterEach` so it doesn't leak
    into other tests in the file that assume `DEFAULT_GRID_WIDTH`/`HEIGHT`.
- **Enhancement: playback speed ceiling raised from 200 to 500 events/sec.**
  `PlaybackControls.tsx`'s speed slider `max` was `200`; changed to `500`
  per direct user request ("make the evolutions speed faster than 200,
  500 should be good enough"). No controller-side change needed —
  `PlaybackController.setSpeed()` already accepted any positive value;
  only the slider's UI ceiling was limiting it.
- Verification: `tsc --noEmit` clean; `npx vitest run` → 12 test files,
  **207 tests passing** (200 from Phases 1–5 unchanged + 7 new
  `resizeGrid`/`clampGridDimension` tests); `npm run build` succeeds;
  every modified/new-behavior file (`CanvasGrid.tsx`, `worldStore.ts`,
  `runStore.ts`, `GenerateButton.tsx`, `PlaybackControls.tsx`) confirmed
  resolving via a dev server with no compile errors.
- Known limitation carried forward: resizing while an algorithm is mid-
  playback clears that playback (by design, per the NodeId-corruption
  reasoning above) — there's no "are you sure" confirmation before this
  happens. Minor UX polish, not correctness; worth revisiting during
  Phase 8's polish pass if it comes up again.

### Post-Phase-5 Bug Fix Pass 2 (grid crop + playback slowness, pre-Phase-6)
- Status: COMPLETE. Two more items from direct user follow-up on the
  previous bug-fix pass.
- **Bug: resizing the grid just cropped it instead of scaling.**
  `renderer.ts`'s `metrics` (which encodes cell size, computed from grid
  width/height + canvas CSS size) was only ever recomputed inside
  `updateSize()`, called on container/window resize — never when the
  world's grid *dimensions* changed via `worldStore.resizeGrid()`. So
  after a resize, `metrics` kept using the OLD width/height: for a larger
  new grid this made `cellSize` too big for the new grid to fit in the
  same canvas area, so only the top-left portion was visible (cropped);
  for a smaller grid it left dead space. **Fix**: added
  `syncMetricsToGridDimensions()`, called at the top of the renderer's own
  `frame()` loop (which already runs continuously) — cheap (two integer
  comparisons) on every frame, and on the rare frame where
  `metrics.gridWidth/gridHeight` no longer matches the live grid's
  dimensions, recomputes `metrics` from the last known CSS size (now
  cached in `lastCssWidth`/`lastCssHeight`, set in `updateSize`) and
  forces a full redraw. This makes the fix reactive to *any* dimension
  change regardless of what triggered it, not just a call from
  `GenerateButton.tsx` specifically.
- **Complaint: playback still felt slow even at the raised 500 events/sec
  ceiling.** Root cause was not the configured speed itself — investigated
  and confirmed `PlaybackController`'s index genuinely advances at the
  correct rate. The actual bottleneck: `renderer.setPlaybackFrame()` was
  calling the pure `deriveNodeStates(events, index)`, which replays
  **every event from 0** on **every single call** — and it's called once
  per playback notification, i.e. up to the browser's real rAF rate while
  playing. For a long run (thousands of events on a default 100×100 grid),
  this meant each animation frame did more work than the last as `index`
  grew, a classic O(n²)-over-the-course-of-playback shape that gets worse
  precisely when speed is turned up (more index advancement per frame,
  same full-replay cost per frame). This was already flagged as a known
  risk in `ARCHITECTURE.md` §16/§20 and explicitly deferred to Phase 7 in
  Phase 5's own HANDOFF notes ("if scrubbing feels laggy... this is the
  first place to look") — pulled forward now since a user actually hit it.
  **Fix**: added `createIncrementalNodeStateDeriver()` to
  `deriveNodeStates.ts`, sharing the same per-event `applyEvent` logic as
  the (still-unchanged, still-pure, still used by Phase 6 planning notes
  and its own tests) `deriveNodeStates` function. The incremental version
  caches `(events reference, last index, accumulated state)` and applies
  only the delta since the last call when `events` is the same array and
  the index moved forward — O(delta) instead of O(index) per frame. Falls
  back to a full recompute (still correct, just not the fast path) when
  the index moves backward (step-back/seek/reset) or a new run is loaded
  (different `events` array reference — reliable here since
  `PlaybackController.load()` always installs a fresh array). Wired into
  `renderer.ts` in place of the old `deriveNodeStates` + `findCurrentNode`
  pair (now combined into one `derive()` call returning both).
- Verification: `tsc --noEmit` clean; `npx vitest run` → 12 test files,
  **212 tests passing** (207 previous + 5 new incremental-deriver tests,
  which assert the incremental path produces byte-identical output to the
  pure `deriveNodeStates` at every checked index, both advancing and after
  a backward jump); `npm run build` succeeds.
- **What still needs a human in a real browser**: neither the crop fix nor
  the perceived-speed fix can be fully confirmed without an actual canvas
  and a real rAF cadence — this sandbox has no browser. Manual check to
  run: resize the grid larger and smaller and confirm the full grid is
  always visible and correctly proportioned; run BFS/A* on a large-ish
  generated map at 500 ev/s and confirm the animation keeps pace with the
  configured speed all the way to the end, not just at the start.
- Known limitation carried forward: `pathRenderer.ts`'s overlay draw still
  does three full passes over the current `states` map every frame
  (frontier/visited/path) — proportional to nodes touched so far, not to
  total events, so it's a much smaller cost than the deriveNodeStates
  issue just fixed, but still real work every frame. Left alone this pass
  since it wasn't the reported bottleneck; still fair game for Phase 7's
  formal performance pass if it turns out to matter at 200×200.

### Phase 6 — Inspector + Metrics
- Status: COMPLETE
- Files created: `src/state/uiStore.ts` (`selectedNodeId` + `useUIState()`,
  the same framework-agnostic-store-plus-hook pattern as `worldStore`/
  `runStore`/`playbackStore`), `src/components/inspector/fieldDescriptors.ts`
  (declarative per-algorithm field lists), `src/components/inspector/NodeInspector.tsx`,
  `src/components/metrics/MetricsPanel.tsx`, `tests/components/fieldDescriptors.test.ts`.
- Files modified: `src/state/worldStore.ts` (`Tool` union extended with a
  new `{ kind: "inspect" }` variant), `src/components/grid/useGridInteraction.ts`
  (handles the inspect tool: single click sets `uiStore.selectedNodeId`, no
  drag-to-select), `src/components/controls/TerrainPicker.tsx` (new
  "Inspect Cell" toolbar button, same selected/unselected styling as every
  other tool), `src/components/layout/AppShell.tsx` (wires `NodeInspector`
  into the right panel, `MetricsPanel` above `PlaybackControls` in the
  bottom bar, updates header label).
- **Interaction model decision** (the phase file's own open question):
  chose a distinct "Inspect" tool in the existing toolbar, not an
  always-active hover/click. Same reasoning Phase 2 already used for
  paint-vs-move: overloading a bare click across paint/move/select
  meanings would be ambiguous once more than one tool exists, and this
  project already has an established explicit-tool-selection pattern —
  adding a fourth `Tool` variant was the smaller, more consistent change
  than inventing a parallel "selection mode" concept. Selection is
  click-only (no drag-to-select across cells while dragging with Inspect
  active) — `dragRef` is deliberately left unset for the inspect case, so
  `onPointerMove`'s existing early-return naturally gives plain click
  semantics with zero new interaction-hook branches.
- **NodeInspector's data source**: prefers the live playback timeline
  (`deriveNodeStates(events, index)` for the selected node) when the
  currently-loaded playback events belong to the currently-selected
  algorithm's own result (checked via array reference equality, the same
  technique `MetricsPanel` and `AlgorithmPicker`/`renderer.ts` already rely
  on elsewhere in this codebase) — falls back to that algorithm's
  `finalNodeState` otherwise, so selecting a cell right after a run
  completes (or after switching which algorithm is selected without
  re-running) still shows something meaningful instead of blanking out.
  Deliberately uses the PURE `deriveNodeStates`, not the renderer's
  incremental deriver added in the post-Phase-5 perf fix — this is exactly
  the "one-off read of a single node, called at most ~10/sec via the
  throttled `usePlaybackState()` hook" case that function's own doc
  comment identifies as the right fit; the incremental deriver exists
  specifically for the renderer's much higher-frequency, whole-map use.
- **MetricsPanel's live counter**: counts `VISIT_NODE` events up to the
  current playback index directly from `usePlaybackState()` — the same
  `PlaybackController` instance the renderer subscribes to (just via the
  throttled hook instead of a direct subscription), per this phase's own
  acceptance criterion that the counter must be driven by the same index
  source of truth as the renderer, not a separately-computed value that
  could drift. Falls back to the result's own final `nodesExplored` when
  the loaded timeline doesn't belong to the currently-selected algorithm's
  result (same reference-equality check as NodeInspector).
- **No hard-coded field lists duplicated between `fieldDescriptors.ts` and
  `NodeInspector.tsx`**: verified directly — `NodeInspector.tsx` contains
  zero field-name string literals; it only ever calls
  `getFieldDescriptors(selectedAlgorithm)` and maps over whatever comes
  back. Confirmed via grep (no `"State"`/`"Distance"`/`"G Score"`/etc.
  string literals anywhere in `NodeInspector.tsx`).
- **Copy discipline**: no "N times faster" language anywhere in
  `MetricsPanel.tsx` (guideline §16 hard requirement) — execution time is
  shown as a plain millisecond figure, explicitly labeled "browser timing
  — not an algorithmic complexity measure", never compared numerically
  against another algorithm's time.
- Verification:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → 13 test files, **222 tests passing** (212 previous
    + 10 new `fieldDescriptors` tests covering all four algorithms' field
    sets, empty-state "—" rendering, status-label mapping, parent
    coordinate formatting, and terrain/neighbor-count reads against a real
    `Grid`)
  - `npm run build` → succeeds
  - Dev server → every new/modified module resolves (HTTP 200, no compile
    errors): `uiStore.ts`, `fieldDescriptors.ts`, `NodeInspector.tsx`,
    `MetricsPanel.tsx`, `TerrainPicker.tsx`, `useGridInteraction.ts`,
    `AppShell.tsx`, confirmed via curl
  - Import-boundary check: `inspector/`/`metrics/` components only import
    from `state/`, `algorithms/`, `world/`, and `react` — no imports of
    `rendering/`, consistent with ARCHITECTURE.md §9's "components read
    from stores via hooks" rule
- **What still needs a human in a real browser**: the phase file's own
  manual acceptance criterion — select a frontier node with the Inspect
  tool, press Play, watch it transition to Visited with a filled-in
  distance/score at the correct step, confirm the Metrics panel's Nodes
  Explored counter advances in step with the visible frontier animation
  rather than ahead of or behind it. Not verifiable headlessly in this
  sandbox (no browser, no real rAF cadence to observe).
- Known limitations: no keyboard-driven cell selection yet (arrow keys +
  Enter — that's explicitly Phase 7's job, same `uiStore.selectedNodeId`
  path this phase's mouse-click path already uses, so Phase 7 has a
  ready-made target to write to); MetricsPanel doesn't yet show a
  comparison table (that's post-MVP Comparison Mode, per Phase 6's own
  original note in the phase file).
- Decisions relevant to Phase 7: `uiStore.selectedNodeId` is the exact
  piece of state Phase 7's keyboard grid-navigation needs to write to
  (Enter/Space on a focused cell) — no new state plumbing required, only
  a new *way* of calling `uiStore.selectNode()` alongside the existing
  mouse-click path in `useGridInteraction.ts`. The "Inspect" tool concept
  established here also means Phase 7 doesn't need to invent a new
  selection-vs-paint distinction; it inherits this phase's own resolution
  of that ambiguity.

### Phase 7 — Accessibility + Performance
- Status: COMPLETE
- Files created: `docs/performance-notes.md`, `docs/accessibility-notes.md`,
  `tests/rendering/coordinates.perf.test.ts` (loose smoke tests, not a
  strict perf gate, per the phase file's own instruction).
- Files modified: `src/components/controls/GenerateButton.tsx` (Copy Seed
  button via Clipboard API with visible success/failure feedback; split
  the old single "Generate" button into "Use This Seed" vs "New Random
  Seed"), `src/state/uiStore.ts` (new `cursorNodeId` field, separate from
  `selectedNodeId`), `src/components/grid/useGridInteraction.ts` (new
  `onKeyDown`/`onFocus` handlers: arrow keys move the cursor, Enter/Space
  commits it via the existing `selectNode()` path, focus initializes the
  cursor to the start node), `src/components/grid/CanvasGrid.tsx` (canvas
  is now a real Tab stop — `tabIndex`, `role="application"`, descriptive
  `aria-label` — and subscribes to `uiStore` to push the cursor into the
  renderer), `src/rendering/canvas/renderer.ts` (reads
  `prefers-reduced-motion` once at init with a live change listener;
  `setKeyboardCursor()` added to `RendererHandle`; reduced-motion path-
  reveal logic in `setPlaybackFrame`), `src/rendering/canvas/pathRenderer.ts`
  (draws the keyboard cursor as a distinct blue dashed square),
  `src/rendering/canvas/theme.ts` (darkened Grass/Mud/Water/Mountain to
  all clear 3:1 against Road; updated the documented contrast-ratio
  comment block with real recomputed numbers),
  `src/rendering/canvas/gridRenderer.ts` (terrain pattern stroke color
  flipped from dark to light to stay visible against the new dark fills).
- **Interaction model for the keyboard cursor**: a NEW piece of UI state
  (`cursorNodeId`), deliberately kept separate from Phase 6's
  `selectedNodeId` — moving the cursor around to explore the grid with
  arrow keys doesn't change what the Inspector shows until Enter/Space
  explicitly commits it. This means "where the keyboard focus currently
  is" and "what the Inspector is currently showing" can differ, which is
  the same distinction a real file-browser's "focused" vs "selected" item
  makes, and avoids the Inspector's contents flickering through every cell
  the user arrows past.
- **Reduced-motion implementation detail worth flagging for future
  maintainers**: the "reveal path instantly" behavior uses the PURE
  `deriveNodeStates` against the FULL event array, not the renderer's
  incremental cache from the earlier perf fix — deliberately, since
  jumping the incremental cache's internal position forward to
  `events.length` would corrupt it for the next (lower-index,
  still-mid-exploration) frame this same playback run produces, forcing
  an expensive full recompute on every subsequent frame instead of just
  the brief reduced-motion tail segment. Documented in `renderer.ts`
  itself, not just here.
- **Contrast pass tradeoff, explicitly accepted, not hidden**: darkening
  all four non-Road terrain colors to each individually clear 3:1 against
  the shared light Road pushed them closer to each other in luminance —
  their mutual contrast against EACH OTHER dropped to roughly 1.0-1.25:1.
  Distinguishing two non-Road terrains from each other still relies
  primarily on `TERRAIN_PATTERNS` (tufts/dots/waves/peaks), which was
  always the intended mechanism per guideline §24 — achieving strong
  mutual separation AND 3:1-against-Road for all four simultaneously isn't
  possible within one cohesive palette. Recorded in both `theme.ts`'s own
  comment block and `docs/accessibility-notes.md`.
- **Not formally audited, explicitly flagged rather than silently
  skipped**: the playback overlay's semi-transparent frontier/visited/path
  fills (`pathRenderer.ts`) don't have a single well-defined WCAG contrast
  ratio, since they're translucent over a varying terrain background
  underneath. Every overlay state still has a non-color cue (dashed
  border, solid border, ring shape, dashed square) independent of this gap.
- **Real measured performance numbers** (see `docs/performance-notes.md`
  for the full table and methodology): BFS/DFS/Dijkstra/A* all complete in
  under 140ms at 200×200 (Node-measured, not eyeballed). More importantly,
  confirmed with real numbers that the incremental node-state deriver
  added in the post-Phase-5 bug-fix pass was not a marginal improvement:
  simulating the OLD (pure, full-replay-every-call) pattern across BFS's
  full 200×200 timeline took **~135 seconds**; the incremental version
  does the identical work in **~26 milliseconds** — roughly 5,150x faster
  for that specific access pattern. This closes out the exact risk
  flagged in Phase 5's own notes ("if scrubbing feels laggy... this is the
  first place to look") with hard numbers instead of leaving it an open
  question.
- **Known limitation flagged, not fixed this phase**: `pathRenderer.ts`
  still does three full passes over the current node-state map per dirty
  frame (frontier/visited/path) — proportional to nodes touched so far,
  a much smaller cost than the issue above, and not the reported
  bottleneck, so left alone per guideline §23 ("don't optimize blindly").
  Identified as the next place to look if a real-browser check ever finds
  stutter during large-map playback.
- Verification:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → 14 test files, **227 tests passing** (222 previous
    + 5 new performance smoke tests)
  - `npm run build` → succeeds
  - Dev server → every new/modified module resolves (HTTP 200, no compile
    errors): `uiStore.ts`, `renderer.ts`, `pathRenderer.ts`, `theme.ts`,
    `gridRenderer.ts`, `CanvasGrid.tsx`, `useGridInteraction.ts`,
    `GenerateButton.tsx`, confirmed via curl
  - Import-boundary checks: `rendering/` still has zero imports from
    `components/`; `renderer.ts` still has exactly one importer
    (`CanvasGrid.tsx`); no leftover references to the old (pre-contrast-
    fix) terrain hex colors anywhere in the codebase
- **What still needs a human in a real browser** (cannot be verified
  headlessly in this sandbox — no browser available at all): the seed
  round-trip (re-entering a seed reproduces the identical grid, already
  proven at the data layer, just needs a UI sanity check); the full
  keyboard walkthrough end-to-end with real Tab/Arrow/Enter/Space input;
  `prefers-reduced-motion` actually changing renderer behavior when
  toggled at the OS level; actual paint smoothness at 200×200 during Play;
  real device-pixel-ratio behavior on an actual high-DPR display. All
  explicitly listed with specifics in `docs/performance-notes.md` and
  `docs/accessibility-notes.md` rather than silently assumed to be fine.
- Known limitations carried forward: no keyboard-driven tool-selection
  navigation beyond ordinary Tab order (every tool button is still
  individually keyboard-operable, just no arrow-key toolbar pattern);
  overlay-fill contrast against varying terrain backgrounds not formally
  audited (see above).
- Decisions relevant to Phase 8: every accessibility/performance item this
  phase could verify without a browser has been verified; everything it
  couldn't is enumerated precisely in the two new docs files rather than
  left as a vague "needs testing" note — Phase 8's polish pass should work
  through those lists directly. The two docs files themselves
  (`docs/performance-notes.md`, `docs/accessibility-notes.md`) are exactly
  what Phase 8's README work item says to pull from for the "technical
  challenges" and "performance considerations" README sections — no
  need to rediscover this material.

### Phase 8 — Polish, README, Deployment (closes MVP)
- Status: COMPLETE (with two explicitly-flagged exceptions — see below)
- **1. Test audit**: re-read every "Required Test Cases" list from Phases
  3-4 (Phase 5's own acceptance criteria were already self-contained unit
  tests, audited when written) against the actual test files. Confirmed
  via direct extraction of every `it(...)` description in
  `bfs.test.ts`/`dfs.test.ts`/`dijkstra.test.ts`/`astar.test.ts`: every
  required case (valid path, no path, start==goal, blocked start/goal,
  1x1/2x2/200x200 grids, multiple optimal paths, deterministic seeded
  worlds, algorithm-specific cases like DFS's "path can be longer than
  BFS's" and A*'s heuristic-admissibility checks) is present. Nothing
  found missing; no new test cases needed to be added this phase.
- **2. Visual polish pass**: added global interaction states to
  `src/index.css` — restrained hover feedback (`filter: brightness(0.97)`
  on real buttons, not a color/gradient change), a clear
  `:focus-visible` ring (`2px solid #2f6b45`, matching the Start-node
  color already established as this app's "affirmative" accent) on every
  focusable element, and `accent-color` on the speed slider so its
  filled-track color matches the app's palette instead of the browser
  default blue. Audited against requirements §21/§32's explicit avoid-
  list: confirmed no gradients, no glassmorphism, no unnecessary shadows,
  no generic-dashboard card treatment anywhere in the existing components
  — nothing needed removing, only the missing hover/focus states needed
  adding. Confirmed no `outline: none` exists anywhere in the codebase
  (would have silently broken keyboard focus visibility) before adding
  the explicit `:focus-visible` rule.
- **3. README.md**: rewritten at the repo root as the portfolio-facing
  entry point, per requirements §30's exact section list (description +
  pitch, architecture summary linking to — not duplicating —
  `ARCHITECTURE.md`, algorithms implemented, technical challenges pulled
  from actual phase-file "Notes/Decisions" sections, performance
  considerations linking to `docs/performance-notes.md`, lessons learned,
  future roadmap). The PREVIOUS `README.md` (the "Planning Docs Index"
  used to navigate Phases 0-7) is not lost — its essential pointer
  function is preserved via a new "Continuing development" section at the
  bottom of the rewritten README, directing future phase work back to
  `HANDOFF.md`/`ARCHITECTURE.md`/the `PHASE_N_*.md` files, the same
  reading order this project itself was built in.
  - Screenshots/GIF: **not captured** — no real browser exists in this
    sandbox to capture them from. Flagged as a human action item, not
    silently skipped.
- **4. Deployment**: **NOT performed as a live deployment** — this
  sandbox's network access is restricted to package registries and a
  small allowlist of code-hosting domains (see the environment's network
  configuration); no static-hosting provider (Vercel, Netlify, GitHub
  Pages) is reachable from here, and there is no way to actually publish
  a live URL from inside this session. This is a deliberate, stated
  limitation, not an oversight or a silently-skipped step. What WAS done:
  produced a real production build (`npm run build` — 65 modules,
  succeeds cleanly) and verified it serves correctly standalone via
  `npm run preview` (confirmed all three served assets — index.html, the
  JS bundle, the CSS bundle — return HTTP 200). The README includes exact
  deploy commands for Vercel/Netlify/GitHub Pages for whoever has network
  access to actually run them.
- **5. Demo video**: **NOT recorded** — no screen-recording capability
  exists in this sandbox. A full 60-120s, timestamped shot-by-shot script
  is included in the README instead (`## Demo script`), following
  requirements §30's exact script (generate world -> BFS -> A* -> note
  explored-node difference -> playback controls -> Inspector), adjusted
  per Phase 6's own note to end there since Comparison Mode/Game Mode are
  post-MVP and out of scope for this demo.
- **Acceptance checklist** (requirements §31 MVP Definition of Done, each
  verified against the actual current codebase/test suite, not assumed):
  - [x] React + TypeScript + Vite project is running (`npm run dev`/`preview` verified)
  - [x] Main UI is polished (Phase 8's own pass, above; restrained per §21/§32)
  - [x] Interactive grid exists (Phase 2)
  - [x] Start/end nodes can be moved (Phase 2)
  - [x] Walls can be painted/erased (Phase 2)
  - [x] BFS works (Phase 3, 13 tests)
  - [x] DFS works (Phase 3, 14 tests)
  - [x] Dijkstra works (Phase 4, 13 tests)
  - [x] A* works (Phase 4, 20 tests)
  - [x] Algorithms animate step-by-step (Phase 5, real PlaybackController)
  - [x] Pause/resume works (Phase 5)
  - [x] Step-forward works (Phase 5; step-backward also implemented, beyond the literal checklist item)
  - [x] Reset works (Phase 5)
  - [x] Speed control works (Phase 5; ceiling raised to 500 ev/s post-Phase-5 per user request)
  - [x] Algorithm inspector exists (Phase 6, keyboard-navigable since Phase 7)
  - [x] Metrics exist (Phase 6, live nodes-explored counter)
  - [x] Random map generation exists (Phase 1/2, plus user-settable grid size added post-Phase-5)
  - [x] Seeded generation exists (Phase 1; copy/new-seed UX added Phase 7)
  - [x] Unit tests exist for core algorithms (227 tests total, this phase's own audit above)
  - [ ] Production build works — **build itself: yes** (verified above); **deployed live: no**, see item 4 above
  - [ ] Project is deployed — **not completed**, see item 4 above (environment limitation, not skipped work)
  - [x] README is complete (this phase's item 3, above)
- Verification:
  - `npx tsc --noEmit` → 0 errors
  - `npx vitest run` → 14 test files, **227 tests passing** (unchanged
    from Phase 7 — this phase added no new test cases, since its own
    audit found none missing)
  - `npm run build` → succeeds (65 modules, ~185KB JS / ~58KB gzipped)
  - `npm run preview` → verified serving the actual production build
    standalone (index.html + JS + CSS all HTTP 200 via curl)
- **What still needs a human**: an actual live deployment (pick a host,
  run one of the three commands in the README, get a URL) and an actual
  screen-recorded demo video (follow the README's script in a real
  browser). Both are the ONLY two items on the MVP Definition of Done not
  fully closed out by this phase, and both are blocked purely on this
  sandbox's lack of network/recording access, not on any remaining
  engineering work — every prerequisite (working build, working app,
  written script) is done and verified.
- Known limitations: none new this phase beyond what Phases 1-7 already
  documented and carried forward (no keyboard-driven tool-selection
  navigation beyond Tab order; overlay-fill contrast against varying
  terrain not formally audited; Comparison Mode/Game Mode/Sorting all
  explicitly post-MVP).
- Decisions relevant to Phase 9: the MVP is genuinely done except for the
  two environment-blocked items above — Phase 9 (Comparison Mode) can
  proceed on top of a stable, tested, documented foundation. `PathfindingResult`
  objects are already immutable per-run snapshots (ARCHITECTURE.md §4),
  which is exactly what running "the same world through multiple
  algorithms side by side" needs — no architectural changes anticipated
  before Phase 9 can start cleanly.

### Phase 8 Addendum — Real-Screenshot Polish Fixes (found post-Phase-8)
- Status: COMPLETE. Two real, user-visible issues found from the FIRST
  actual screenshots of the running app the user shared (this sandbox
  still has no browser of its own — everything through Phase 8 was
  verified via typecheck/tests/headless build/curl only). Recorded in
  detail since, like the Phase 2 Addendum bugs, neither was catchable by
  any automated check available in this environment.
- **Bug 1 — stale internal phase-number label shown in the shipped UI.**
  `AppShell.tsx`'s header literally rendered `"Phase 6 — Inspector +
  Metrics"` as a permanent subtitle — a leftover from each phase updating
  this string as it was built, never removed once the project moved past
  needing it. This should have been caught during Phase 8's own polish
  pass (explicitly checking for "looks like a school project" per
  requirements §21) but was missed since that pass focused on CSS/
  interaction states rather than re-reading every static string in the
  header. **Fix**: replaced with the product's own tagline ("Learn and
  understand algorithms by watching them think.") — the same one already
  used at the top of `README.md` — rather than any dev/phase-tracking
  text.
- **Bug 2 — Start/Goal markers effectively invisible at default grid
  density.** `drawMarker()`'s radius was purely proportional
  (`cellSize * 0.32`) with no floor. At the default 100x100 grid in a
  ~600px canvas (cellSize ~6px), this produced a ~2px-radius marker —
  visually indistinguishable from a stray pixel, confirmed directly in
  the user's screenshot. **Fix**: `const r = Math.max(3, metrics.cellSize
  * 0.32)` — a 3px minimum radius floor, so Start/Goal (arguably the two
  most important reference points on the entire grid) stay visually
  findable regardless of grid size, while still scaling up proportionally
  on larger cells as before.
- **Not a bug, confirmed from the same screenshots**: the generated world
  shows only Wall (black hatch) and Road (light) terrain, no Grass/Mud/
  Water/Mountain color anywhere. This is correct, existing, documented
  behavior — Phase 1's `randomObstacles.generate()` only ever produces
  Wall or Road (per its own density semantics, recorded in Phase 1's
  HANDOFF entry); Grass/Mud/Water/Mountain are only reachable via manual
  painting with the Terrain Picker. Not a defect, just confirmed correct
  via the screenshot rather than only in code.
- Verification: `npx tsc --noEmit` clean; `npx vitest run` → 227/227
  passing (unchanged — neither fix touches any tested logic, both are
  pure rendering/copy changes); `npm run build` succeeds. No test file
  exercises marker-drawing pixels directly (canvas pixel tests are
  explicitly out of MVP scope per ARCHITECTURE.md §14), so this fix's
  correctness rests on the same visual/manual verification the original
  marker-drawing code always did — the next real-browser screenshot
  should confirm both fixes visually.
- Known limitation, not addressed here: this is now the SECOND time a
  real screenshot/browser surfaced a defect zero automated check in this
  environment could catch (after the Phase 2 Addendum's three bugs). This
  environment's fundamental inability to run a real browser remains the
  single biggest verification gap on this entire project — every phase's
  "what still needs a human" section has said this, and it remains true.

### Phase 8 Addendum 2 — Render Loop Ran Forever, Fixed (found from user report of "app refreshes a lot")
- Status: COMPLETE. User reported the app "refreshes a lot" when changing
  algorithm, generating a new seed, or resizing the world. Traced through
  the actual code (no browser available in this sandbox to observe the
  symptom directly) rather than guessing.
- **Ruled out first, to narrow the search**: confirmed switching the
  selected algorithm touches ZERO world/canvas state (`runStore.selectAlgorithm`
  only updates `selectedAlgorithm`, nothing else) — so any visible
  "refresh" there couldn't be a canvas redraw at all. Also confirmed both
  Inspector/Metrics `<aside>` panels already have `overflowY: "auto"` with
  a fixed-height parent, so their content changing height (e.g. BFS's 5
  Inspector fields vs A*'s 7) cannot reflow the rest of the page — ruled
  out a layout-shift explanation too.
- **The actual bug, found in `renderer.ts`**: the render loop called
  `requestAnimationFrame(frame)` unconditionally at the end of every
  `frame()` call, forever, from the moment the canvas mounted — even when
  absolutely nothing was dirty. Every single frame (60/sec, indefinitely)
  it cleared the ENTIRE visible canvas and re-blitted both offscreen
  layers, regardless of whether the static layer, the algorithm overlay,
  or anything else had actually changed since the last frame. This is
  exactly the class of bug ARCHITECTURE.md §16 warns about ("no React
  state update per animation frame... only redrawn when the world
  actually changes") — except that principle had only ever been applied
  to the STATIC LAYER's own regeneration (correctly gated behind `pending`/
  `algorithmPending` flags since Phase 2/3), never to the outer loop
  deciding whether to run at all. A constant, unthrottled 60fps loop
  running forever in the background is real, continuous main-thread work
  that competes with anything else happening on the page — exactly why
  heavier synchronous actions (regenerating a 100x100+ world, resizing,
  even just the React re-render from switching algorithms) would visibly
  stutter/flicker: they're landing on a main thread that's already busy
  doing unnecessary work 60 times a second, every second, always.
- **Fix**: the loop now idles. A new `frameScheduled` flag gates a single
  pending `requestAnimationFrame` call; `frame()` itself no longer
  reschedules itself. Instead, every method that actually marks something
  dirty — `requestRedraw` (world edits), `updateSize` (container/DPR
  resize), `setPlaybackFrame` (every playback tick), `setKeyboardCursor`
  (focus movement) — calls a new `scheduleFrame()` to wake the loop for
  exactly one more frame. During active Play, this still produces smooth
  continuous animation with no change in behavior, since
  `PlaybackController`'s own internal rAF loop calls `setPlaybackFrame()`
  on every one of its own ticks, and each of those calls re-arms
  `scheduleFrame()` — so the renderer now draws exactly as often as there
  is real work to show, no more, no less, instead of unconditionally
  forever.
- **Honesty about verification**: there is no automated test for this fix
  — it requires a real browser's `requestAnimationFrame`/`Canvas`, which
  this sandboxed environment has never had access to (the same limitation
  recorded in every prior phase's "what still needs a human" section).
  This diagnosis is based on direct code inspection (the unconditional
  `requestAnimationFrame(frame)` call was unambiguous in the source, not
  inferred indirectly) rather than a symptom reproduced and then fixed —
  it is the most concrete, defensible explanation found for the reported
  symptom, not a guaranteed complete fix. Asked the user to re-verify
  after rebuilding.
- Verification: `npx tsc --noEmit` clean; `npx vitest run` → 227/227
  passing (unchanged — no test exercises `renderer.ts` directly, since it
  requires a real Canvas/rAF this environment's Vitest config doesn't
  provide, consistent with every prior renderer.ts change in this
  project); `npm run build` succeeds.
- Known follow-up if the symptom persists after this fix: profile in a
  real browser's Performance panel during the specific reported actions
  (switch algorithm / new seed / resize) to see whether main-thread time
  is still dominated by rendering work, which would point somewhere else
  (e.g. `pathRenderer.ts`'s three-pass overlay loop, already flagged as a
  known, deferred cost in `docs/performance-notes.md`) rather than this
  now-fixed always-on loop.

### Phase 9 — Comparison Mode (post-MVP, not yet detailed)
- Status: NOT PLANNED (create `phases/PHASE_9_COMPARISON_MODE.md` when this
  is picked up, following the same format as Phases 1–8)

---

## Open Questions For The Product Owner

- Confirm Comparison Mode really belongs after Phase 8 (MVP close) rather
  than being pulled forward — see Phase 6 file's note.

---

## Rules For Whoever Continues This Project

- Do not modify `ARCHITECTURE.md`'s interfaces without updating every phase
  file that depends on them and noting the change in this log.
- Do not start a phase's non-goals. Phase 6 should build the Inspector and
  Metrics panel only — no Comparison Mode, no accessibility keyboard-grid
  navigation (that's Phase 7).
- Every phase ends with: build passes, tests pass, no regressions in earlier
  phases' tests, and this file updated.
- If you deviate from a phase file's plan, note the deviation and why in that
  phase's "Notes / Decisions to Record When Done" section — don't silently
  diverge. (See the Phase 4 Addendum above for a concrete example: a gap
  found mid-Phase-5 was fixed and documented against the phase whose code
  it actually belonged to, not silently folded into Phase 5's diff.)
