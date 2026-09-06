# Phase 11 — Chase Mode (playable, Pac-Man-style)

Prerequisite: Phases 1–10 complete. Read `HANDOFF.md`'s Phase 10 entry
(the `buildWalkEvents`/`ALGORITHM_REGISTRY` reuse pattern) and
`ENGINEERING_GUIDELINES.md` §20 before starting.

This is architecturally distinct from Phase 10's Escape scenario, not an
extension of it: Escape is "watch a precomputed path play back." Chase
Mode is the first genuinely **interactive, real-time** mode in this
project — the user controls a character live, while four AI-controlled
"ghosts" (one per pathfinding algorithm) continuously re-plan and chase
them. Decided with the user via direct elicitation before this file was
written:
- **All 4 algorithms run as 4 simultaneous ghosts** (not a single
  configurable ghost) — this is the point: you feel the difference
  between how BFS/DFS/Dijkstra/A* pursue you.
- **Real-time**, not turn-based: the player moves whenever they press an
  arrow key; ghosts re-plan and move on their own fixed timer,
  independent of player input timing.
- **Win condition: survive a time limit.** No pellets/exit/scoring in
  this milestone.

## Explicit Non-Goals for This Phase
No pellets/items, no multiple lives, no difficulty levels, no per-ghost
speed tuning UI, no sound. No changes to any of the four pathfinding
algorithms themselves — ghosts re-run the exact same
`ALGORITHM_REGISTRY[name].run(...)` Phase 9/10 already use, just on a
timer against a moving goal. No shared code with Phase 10's
`buildWalkEvents`/`PlaybackController` path — that machinery replays a
**precomputed, static** timeline; Chase Mode's state changes live, in
response to real-time input and a live re-planning loop, which is a
different enough shape that force-reusing `PlaybackController` would
distort it (see Architecture Decision below).

## Architecture Decision — A New Live Store, Not `PlaybackController`
`PlaybackController` (Phase 5) models scrubbing through an
**already-fully-computed** event array — perfect for Escape and for
watching a single algorithm explore. Chase Mode has no such array: the
world changes in response to live player input and a live ghost-replan
timer, so there is no "index into a timeline" to speak of. Rather than
bend `PlaybackController` to fit, this phase introduces a new, equally
small, framework-agnostic store (`state/chaseStore.ts`, same
hand-rolled-store pattern as every other store in this project —
ARCHITECTURE.md §10) that owns:
- `playerNodeId`, `ghostPositions` (one per algorithm), `status`
  (idle/running/caught/survived), `timeRemainingMs`.
- Its own two timers: a ghost-replan interval and a countdown clock.

Rendering is a new lightweight component (`ChaseView.tsx`), NOT
`createRenderer(...)` — that renderer's whole design (Phase 2/3/5) is
built around a single algorithm's `NodeState` map (frontier/visited/path
status per cell), which has no natural way to represent "5 independently
movable tokens on static terrain." `ChaseView` instead reuses
`drawStaticLayer`/`computeCellMetrics`/`configureCanvasBackingStore`/
`gridToPixelCenter` directly (all already-exported, already-tested
building blocks from `gridRenderer.ts`/`coordinates.ts`) and draws
player/ghost markers as plain circles on top — new composition, zero new
low-level drawing primitives.

## Files to Create
```
src/game/chaseEngine.ts           # pure: computeGhostStep(), computePlayerMove()
src/state/chaseStore.ts           # live game state + the two timers
src/components/game/ChaseView.tsx # main-panel canvas + keyboard input + HUD (timer, status)
src/components/game/ChasePanel.tsx # sidebar: "Start Chase" button, status/result text
tests/game/chaseEngine.test.ts
```

## Files to Modify
```
src/state/uiStore.ts              # REFACTOR: comparisonViewActive/gameViewActive booleans -> a single `mainView: "canvas" | "comparison" | "game" | "chase"` field. Two booleans were already borderline before adding a third; a fourth makes a discriminated enum the honest choice, not premature abstraction. Every existing call site updates ITS OWN call (setComparisonView(true) -> setMainView("comparison")), no behavior change for Phases 9/10.
src/components/comparison/ComparisonPanel.tsx / ComparisonGrid.tsx   # updated to setMainView calls
src/components/game/GamePanel.tsx / GameView.tsx                     # updated to setMainView calls
src/components/layout/AppShell.tsx  # four-way main-panel switch; mounts ChasePanel in the sidebar
```

## Behavior Spec
- **Spawn positions**: player starts at the world's `start` node; all
  four ghosts spawn together at the world's `goal` node, reframed as a
  "ghost den" — reuses the existing Start/Goal concept rather than adding
  new spawn-point UI. (If this reads oddly once Escape/Treasure also use
  `goal`, that's fine — different modes, different narrative framing of
  the same underlying node, consistent with how Phase 10 already
  reframes `goal` as "the exit.")
- **Player movement**: arrow keys (or WASD), one cell per keypress,
  blocked by walls/out-of-bounds (silently no-ops, mirrors the existing
  drag-start/goal "snap back" convention — never crashes, never moves
  through a wall).
- **Ghost replanning**: every fixed interval (400ms), each ghost
  independently calls `computeGhostStep` — a **fresh** algorithm run from
  its current position to the player's **current** position — and moves
  one cell along the freshly computed path. This is real re-planning
  every tick, not a cached pursuit path; a ghost with no path to the
  player (fully walled off) simply doesn't move that tick.
- **Catch detection**: checked immediately after every player move AND
  after every ghost-replan tick — if any ghost's position equals the
  player's position, `status` becomes `"caught"`, timers stop, and which
  algorithm caught the player is recorded (`caughtBy`) for the result
  text ("Caught by the A* ghost after 12.4s").
- **Timer**: a 30-second countdown starts the moment "Start Chase" is
  pressed. Reaching 0 while still `"running"` sets `status: "survived"`
  and stops both timers.
- **HUD**: `ChaseView` shows the countdown and current status; distinct
  colors per ghost (reuse Comparison Mode's existing BFS-blue/DFS-purple/
  Dijkstra-teal/A*-gold palette — same algorithm, same color, everywhere
  in the app, not a new one invented for this mode).

## Acceptance Criteria
- [ ] `computeGhostStep`/`computePlayerMove` are pure, unit tested
      directly against a hand-built `Grid` — including a ghost fully
      walled off from the player (must return its unchanged position,
      never throw), and a player move attempt into a wall/out-of-bounds
      (must return the unchanged position).
- [ ] `src/game/` (including this phase's `chaseEngine.ts`) still has
      zero imports of `react`/`components/`/`rendering/`/`state/` — same
      discipline as Phase 10's `buildWalkEvents.ts`.
- [ ] `mainView` refactor: at most one of CanvasGrid/ComparisonGrid/
      GameView/ChaseView is ever mounted at a time; switching to any one
      of the three alternate views always closes whichever other
      alternate view was open (verified by code review of the single
      `setMainView` implementation — there is exactly one place this
      exclusivity is enforced, not three ad hoc booleans each remembering
      to clear the others).
- [ ] Catch detection covers both triggers (player walks into a ghost;
      a ghost's replan step lands on the player) — not just one.
- [ ] `npm test` / `npm run build` pass, no regressions in Phases 1–10's
      existing tests.

## Notes / Decisions to Record When Done
- Actual ghost-replan interval chosen (400ms proposed above) and whether
  it felt right, or needed tuning, once running.
- Any performance concern found running 4 full algorithm executions
  every 400ms on a 100x100+ grid (should be comfortably fast — a single
  BFS/Dijkstra pass over 10,000 cells is not expensive at human-reaction
  timescales — but record actual behavior, don't just assume).

## Next Phase
None yet planned beyond this. Sorting, maze generators, and
shareable-scenario URLs remain separately-scoped future items per
`README.md`'s roadmap; Chase Mode could also grow pellets/scoring/
difficulty as its own future milestone, tracked here rather than
speculatively built now.
