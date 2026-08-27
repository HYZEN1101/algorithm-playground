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

**Active phase:** Post-Phase-5 bug fix / enhancement pass — COMPLETE.
**Next phase to start:** Phase 6 — Inspector + Metrics Panel (`phases/PHASE_6_INSPECTOR_METRICS.md`).
**Blocking issues:** none.
**Repo state:** working Vite + React + TypeScript + Vitest project. All four
MVP pathfinding algorithms (BFS, DFS, Dijkstra, A*) are implemented and
tested. The real `PlaybackController`-driven playback system from Phase 5
is in place (Play/Pause/Step/Reset/Speed, animated frontier/visited/
current-node/path overlay). Since Phase 5 closed out, three user-reported
items were fixed: the move-start/move-goal cursor now correctly shows a
crosshair instead of a grab hand; grid size is now user-settable (5–300 per
side) via a new "Resize Grid" control, instead of being fixed at the
100×100 default; and the playback speed slider's ceiling was raised from
200 to 500 events/sec. 207/207 tests passing (200 from Phases 1–5,
unchanged, + 7 new for the grid-resize feature).

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

### Phase 6 — Inspector + Metrics
- Status: NOT STARTED

### Phase 7 — Accessibility + Performance
- Status: NOT STARTED

### Phase 8 — Polish, README, Deployment (closes MVP)
- Status: NOT STARTED

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
