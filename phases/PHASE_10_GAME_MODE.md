# Phase 10 — Game Mode (Milestone 1: Escape Scenario)

Prerequisite: Phases 1–9 complete (MVP + Comparison Mode, including its
three addenda). Read `ENGINEERING_GUIDELINES.md` §20 and
`algorithm-playground-requirements.md` §12–13 before starting.

## Explicit Non-Goals for This Phase (Milestone 1)
Per `ENGINEERING_GUIDELINES.md` §26 ("never attempt to implement the
entire project in one response") and §35 (MVP priority order), this
milestone is deliberately narrow:

- No entities beyond Player + Exit (no keys, doors, enemies, treasure,
  hazards, checkpoints).
- No Scenario B–F (Treasure, Dangerous Terrain, Enemy, Multi-target,
  Limited Resources) — Scenario A (Escape) only.
- No separate pathfinding implementation for Game Mode — it reuses the
  exact same `ALGORITHM_REGISTRY`/`PathfindingResult` the rest of the app
  already produces (guideline §20's explicit requirement).
- No new Canvas rendering primitives — see the reuse decision below; this
  milestone should need zero changes to `gridRenderer.ts`/`pathRenderer.ts`.

Later milestones (tracked as a "Milestone N" list at the bottom of this
file, extended in place rather than spawning a new phase file per
scenario) add the remaining scenarios/entities once this one is solid.

## Goal
A "Game Mode" view: press "Start Escape" and watch a player token walk,
cell by cell, from Start to the Exit (the existing `goal` node — Game Mode
reframes it narratively, it isn't a new concept) along the path found by
whichever algorithm is currently selected in `AlgorithmPicker`. If no path
exists, say so plainly rather than animating nothing.

## Key Implementation Decision — Reuse, Don't Reimplement
`deriveNodeStates` (Phase 5) already turns a `BUILD_PATH` event per node
into progressive `status: "path"` reveal, and a `VISIT_NODE` event sets
`currentNodeId` (the red ring). A synthetic per-path-node event pair
(`VISIT_NODE` then `BUILD_PATH`, in path order, terminated by `COMPLETE`)
replayed through a fresh `PlaybackController` + `createRenderer(...)` —
the exact same pattern Phase 9's `MiniAlgorithmCanvas` already
established for an independent, simultaneously-running canvas — produces
"player lands on a cell (ring), then it joins the trail (path color)"
with **zero new rendering code**. This is the reuse guideline §20 requires,
not a coincidence of convenience.

## Files to Create
```
src/game/buildWalkEvents.ts       # pure: (path: NodeId[]) -> AlgorithmEvent[], the VISIT_NODE/BUILD_PATH/COMPLETE synthesis above
src/components/game/GameView.tsx  # main-panel canvas, same architecture as MiniAlgorithmCanvas.tsx
src/components/game/GamePanel.tsx # sidebar: "Start Escape" button, status text, Replay
tests/game/buildWalkEvents.test.ts
```

## Files to Modify
```
src/state/uiStore.ts             # gameViewActive boolean; setGameView()/setComparisonView() become mutually exclusive (only one non-CanvasGrid view at a time)
src/components/layout/AppShell.tsx  # three-way main-panel switch: game / comparison / single canvas
```

## Behavior Spec
- "Start Escape": runs the currently-selected algorithm (reuse
  `runStore`'s `selectedAlgorithm` + `ALGORITHM_REGISTRY`, exactly what
  `AlgorithmPicker`'s own "Run" already does) against the live world.
  - If `pathFound`, build walk events from `result.path` and play them in
    `GameView` at the shared global Speed (same sync mechanism as
    Comparison Mode's Addendum 2 — one Speed slider governs the whole
    app, not a separate Game Mode speed).
  - If not `pathFound`, show "No route to the exit." and do not open
    `GameView` / do not animate.
- Opening Game Mode closes Comparison Mode if it was open, and vice versa
  (mutual exclusivity in `uiStore`) — only one alternate main-panel view
  at a time; "Close" returns to the single `CanvasGrid`.
- "Replay" re-plays the same already-computed path from the start (does
  not require re-selecting "Start Escape" or re-running the algorithm)
  unless the world changed underneath it, mirroring
  `ComparisonGrid`'s existing Replay semantics.

## Acceptance Criteria
- [ ] `buildWalkEvents([])` and `buildWalkEvents([singleNode])` (start ==
      goal case) both produce valid, non-crashing event sequences — unit
      tested directly.
- [ ] `buildWalkEvents(path)` produces exactly `2 * path.length + 1`
      events (`VISIT_NODE`+`BUILD_PATH` per node, plus one trailing
      `COMPLETE`), in path order — unit tested.
- [ ] `src/game/` has zero imports of `react`/`components/`/`rendering/`/
      `state/` (same import-boundary discipline as `algorithms/`, since
      `buildWalkEvents` is pure logic, not UI).
- [ ] No-path case shows a clear message and never calls
      `PlaybackController.load([])`/`.play()` on an empty timeline.
- [ ] `npm test` / `npm run build` pass, no regressions.

## Notes / Decisions to Record When Done
- Confirm the VISIT_NODE-then-BUILD_PATH-per-node event synthesis reuse
  decision held up in practice with no renderer changes needed.
- Any narrative/copy decisions made for the "Escape" framing (exit label,
  no-path message wording).

## Milestone Tracker (update in place as milestones complete)
- **Milestone 1 — Escape scenario** (this file's main content): player +
  exit only, single algorithm-driven walk. Status: to be recorded in
  `HANDOFF.md` once implemented.
- **Milestone 2 (future)** — Treasure scenario: minimize movement cost to
  a treasure node, reusing Dijkstra/A*'s existing cost machinery
  unchanged.
- **Milestone 3 (future)** — simple static hazard/enemy avoidance
  (Dangerous Terrain / Enemy scenarios): mark cells as higher-cost or
  impassable-if-adjacent-to-enemy before running the existing algorithms
  — still no new pathfinding code, just world-construction differences.
- **Milestone 4+ (future, not yet scoped)** — keys/doors, multi-target,
  limited resources. Each gets its own acceptance-criteria addition here
  rather than a brand-new phase file, per this file's own numbering.

## Next Phase
None yet beyond this milestone tracker — Sorting, maze generators, and
shareable-scenario URLs remain separately-scoped future phases per
`README.md`'s roadmap.
