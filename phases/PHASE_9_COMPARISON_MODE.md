# Phase 9 — Comparison Mode (post-MVP)

Prerequisite: Phases 1–8 complete (MVP closed, per `HANDOFF.md`). Read
`ARCHITECTURE.md` §4 (immutable per-run `PathfindingResult`) and §12
(Metrics architecture) before starting.

## Explicit Non-Goals for This Phase
No synchronized animated side-by-side playback (four canvases ticking in
lockstep). That is a much larger architecture change (multiple concurrent
`PlaybackController` instances, a layout for N canvases, per-canvas
render loops) and is not what requirements §11's flagship demo actually
needs to be convincing — a metrics table plus the existing single-canvas
Run/Play flow already shows "A* explores fewer nodes than BFS for the
identical optimal path," which is the point. Do not build multi-canvas
playback this phase. No Game Mode, no Sorting — still out of scope per
guideline §35.

## Goal
Run all four algorithms against the *same* `Grid` (not regenerated per
algorithm — ARCHITECTURE.md §4/guideline §17) with one click, and show a
side-by-side metrics table: nodes explored, path length, path cost, and
whether each algorithm's cost matches the group's optimal cost. No new
metrics concepts beyond what `PathfindingResult` already carries
(ARCHITECTURE.md §12: comparison is additive, not a new metrics model).

## Files to Create
```
src/algorithms/pathfinding/registry.ts   # shared { label, run } map, extracted from AlgorithmPicker to avoid duplicating it here
src/algorithms/pathfinding/comparisonMetrics.ts  # pure: buildComparisonRows(results), findMostEfficientOptimal(rows)
src/components/comparison/ComparisonPanel.tsx    # "Run All" button + table
tests/algorithms/comparisonMetrics.test.ts
```

## Files to Modify
```
src/components/controls/AlgorithmPicker.tsx  # import the shared ALGORITHMS registry instead of defining its own copy
src/components/layout/AppShell.tsx           # mount ComparisonPanel in the left sidebar, below AlgorithmPicker
```

## Behavior Spec
- "Run All": executes bfs/dfs/dijkstra/astar synchronously against the
  identical `Grid` instance from `worldStore` (same object reference, not
  a fresh `clone()` per algorithm — cloning per-run already happens
  *inside* each algorithm's own input handling if needed; this panel must
  not regenerate or mutate the world). Each result is written into
  `runStore` via `setResult`, exactly like the existing single-Run flow —
  Comparison Mode is additive on top of `runStore`, not a parallel store.
- Table columns: Algorithm, Nodes Explored, Path Length, Path Cost,
  Optimal? (a row is "optimal" if its `pathCost` equals the minimum
  `pathCost` among all `pathFound: true` results this run — computed
  honestly per-run, never hardcoded to exclude DFS or assume BFS/Dijkstra
  win).
- Does not touch `playbackController` — Comparison Mode never plays an
  animation; it's a metrics-only summary table (see non-goal above). The
  existing single "Run" button (loads events into the playback controller
  and animates one algorithm) is unaffected and remains the way to *watch*
  any individual algorithm.
- No claims like "A* is Nx faster" in any copy (guideline §16 hard rule) —
  only concrete counts ("A* explored 6,895 nodes; BFS explored 8,480").

## Acceptance Criteria
- [ ] `buildComparisonRows`/`findMostEfficientOptimal` are pure, unit
      tested against hand-built `PathfindingResult` fixtures, including a
      case where DFS's cost happens to tie the optimal (must be honestly
      reported, not excluded by name).
- [ ] "Run All" passes the *same* `Grid` object reference to all four
      algorithms (test this directly — not four separately-generated
      grids).
- [ ] `algorithms/` still has zero imports from `components/`/`rendering/`/
      `state/`/`react` — `registry.ts` and `comparisonMetrics.ts` both live
      under `algorithms/` and must not import `runStore`'s `AlgorithmName`
      if that still lives in `state/`. Resolution: move `AlgorithmName` to
      `algorithms/pathfinding/types.ts` (the type is fundamentally about
      "which pathfinding algorithm," not about React/store state) and have
      `state/runStore.ts` re-export it, rather than having `algorithms/`
      reach into `state/`.
- [ ] `AlgorithmPicker.tsx` no longer duplicates the `{label, run}` map —
      both it and `ComparisonPanel.tsx` import the one in `registry.ts`.
- [ ] `npm test` / `npm run build` pass, no regressions.

## Notes / Decisions to Record When Done
- Confirm the `AlgorithmName` relocation and why it was necessary (import-
  boundary violation caught during implementation, not anticipated here).
- Any grouping-by-cost edge case found (e.g. no path found by any
  algorithm — table should say so, not divide by zero / show `Infinity`).

## Next Phase
None yet planned — Game Mode, Sorting, maze generators, and shareable-URL
sharing remain future post-MVP phases per `README.md`'s roadmap, each
getting its own phase file when picked up.
