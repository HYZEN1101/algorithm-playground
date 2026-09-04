# Algorithm Playground

**Learn and understand algorithms by watching them think.**

An interactive, browser-based playground for classic pathfinding
algorithms. Paint walls and terrain onto a grid, drag the start and goal
around, then watch BFS, DFS, Dijkstra, and A* explore the map step by step
— frontier expanding, current node highlighted, path drawing in — with
full playback control (play/pause/step/reset/speed) and a live Inspector
showing exactly what each algorithm knows about any cell at any moment.

This is the pathfinding MVP described in `algorithm-playground-requirements.md`,
now extended with Comparison Mode (Phase 9): run all four algorithms on
the same map with one click and see nodes-explored/cost/optimal-or-not
side by side. Sorting, Game Mode, Genetic Algorithms, and Reinforcement
Learning remain deliberately out of scope (see
[Future Roadmap](#future-roadmap) below) — the guiding principle throughout
this build has been: **make the pathfinding experience genuinely solid
before adding anything else**, per `ENGINEERING_GUIDELINES.md` §35.

## Running it locally

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm test          # 237 tests, Vitest
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

## Algorithms implemented

| Algorithm | What it demonstrates |
|---|---|
| **Breadth-First Search** | Shortest path on an unweighted grid; explores outward in uniform "rings." |
| **Depth-First Search** | Finds *a* path, not the shortest one — the UI deliberately never calls DFS's result "shortest," and the app includes a hand-built maze test proving DFS's path can be meaningfully longer than BFS's on the identical map. |
| **Dijkstra's Algorithm** | Optimal path under weighted terrain (Road=1, Grass=2, Mud=5, Water=10, Mountain=20, Wall=impassable). |
| **A\*** | Same optimal-cost guarantee as Dijkstra, typically exploring fewer nodes by using a Manhattan-distance heuristic. A flagship demonstration run (100x100 grid, seed 2024) found A* explored 6,895 nodes to Dijkstra's 8,480 for the identical optimal path — recorded in `HANDOFF.md`'s Phase 4 entry, not just claimed here. |

Movement is 4-directional only in this MVP (no diagonals) — a deliberate,
documented scope decision from Phase 0, not an oversight; see
`ARCHITECTURE.md`'s Ambiguities section.

## Comparison Mode

Press **Run All** (left sidebar, below the algorithm picker) to run BFS,
DFS, Dijkstra, and A* against the *identical* grid in one action — no
per-algorithm regeneration. This opens a synchronized 4-up view in the
main panel: four independently-animating mini-canvases, one per algorithm,
each labeled and drawing its final path in a distinct color (BFS blue, DFS
purple, Dijkstra teal, A* gold), all exploring the same map simultaneously
— the same frontier-expanding, path-drawing animation the single-canvas
Run flow already does, just four at once. A metrics table in the sidebar
fills in alongside it: nodes explored, path cost, and whether each result
actually matches the optimal cost found this run ("optimal" is computed
honestly per run, never hardcoded to assume BFS/Dijkstra/A* win and DFS
loses). "Replay" restarts all four in lockstep; "Close" returns to the
single canvas. See `phases/PHASE_9_COMPARISON_MODE.md` for the original
spec and `HANDOFF.md`'s Phase 9 Addendum for how the animated view
followed on afterward.

## Architecture

Five cleanly separated state layers — World, Algorithm, Playback, Render,
UI — with a strict rule that algorithms never know React or Canvas exist.
Full details, interfaces, and the reasoning behind every major decision
(event-timeline execution model, hand-rolled stores instead of a state
library, why diagonal movement is out of scope) live in `ARCHITECTURE.md`;
this README doesn't duplicate it.

```
Algorithm (pure fn) -> AlgorithmEvent[] -> PlaybackController -> Renderer (Canvas)
                                                |
                                                v
                                    Inspector / Metrics (React, throttled)
```

The short version: every algorithm run produces a complete, replayable
timeline of small events (`VISIT_NODE`, `ADD_TO_FRONTIER`,
`UPDATE_DISTANCE`, ...) up front. Playback is just an index into that
array — which is what makes step-back, scrubbing, and a live Inspector
possible without ever re-running the algorithm.

## Project history and technical challenges

This project was built incrementally, phase by phase, with a running
`HANDOFF.md` log recording every decision, deviation, and bug found along
the way — treat it as this project's institutional memory. A few
highlights worth pulling out here:

- **A real performance bug, found and fixed with hard numbers, not
  guesses.** The playback renderer originally re-derived the entire
  visible node-state map from event 0 on every single animation frame. At
  200x200 with a long BFS run, simulating that pattern end-to-end measured
  **~135 seconds**; an incremental version that only applies the delta
  since the last frame does the identical work in **~26 milliseconds** —
  roughly 5,150x faster. Full writeup in `docs/performance-notes.md`.
- **A real rendering bug, only visible on a real scaled display.**
  Automated checks (typecheck, tests, headless build) all run at
  effective DPR=1 and never touch a real `<canvas>`, so a device-pixel-
  ratio double-scaling bug that misaligned wall painting with the cursor
  went undetected until a human tested the actual built app on a retina
  display. Recorded in `HANDOFF.md`'s Phase 2 Addendum, alongside two
  other real-browser-only bugs found the same way — a genuine reminder
  that headless verification and real-browser verification catch
  different classes of problems.
- **A documented ambiguity, resolved and recorded rather than guessed
  at silently**: `pathLength` conflicted between "number of cells in
  path" (an early architecture comment) and a required test case
  (`start == goal` must give `pathLength === 0` despite a one-cell path).
  Resolved in favor of counting steps/edges, documented in both the code
  and `HANDOFF.md`, so a future maintainer doesn't have to rediscover the
  conflict.
- **A formal WCAG AA contrast pass** (Phase 7) found three terrain colors
  failing 3:1 contrast against the base "Road" terrain (Grass at 1.48:1,
  Water at 1.72:1, Mud at 2.54:1) — all three were darkened until they
  clear 3:1, with the accepted tradeoff (lower mutual contrast between the
  darkened terrains themselves) documented rather than hidden, in
  `docs/accessibility-notes.md`.

## Performance considerations

See `docs/performance-notes.md` for the full table of real, Node-measured
timings (algorithm execution, grid construction, event-derivation cost)
and an honest statement of what this environment could and couldn't verify
(no real browser was available during development — see that document for
exactly what still needs a human to confirm in one).

## Accessibility

See `docs/accessibility-notes.md` for the full write-up: keyboard grid
navigation (arrow keys + Enter/Space, via a renderer-drawn focus ring),
`prefers-reduced-motion` support, and the WCAG AA contrast audit above.

## Lessons learned

- **Writing the acceptance criteria into the phase file before writing any
  code** (this project's actual workflow, via `phases/PHASE_N_*.md` files)
  caught real ambiguities early — e.g., Phase 4's non-brittle A*-vs-
  Dijkstra testing rule was decided *before* any Dijkstra/A* code existed,
  which meant the test suite was never tempted to assert a fragile,
  map-dependent "A* always explores fewer nodes" invariant.
- **Separating "what the algorithm did" (events) from "how it looks"
  (rendering) early paid for itself repeatedly** — Phase 5's real playback
  system, Phase 6's Inspector, and Phase 7's reduced-motion path reveal
  all consumed the exact same `AlgorithmEvent[]` timeline Phase 3 defined,
  with zero changes to any algorithm's code.
- **Headless verification (typecheck, unit tests, production build) is
  necessary but not sufficient.** Every real-browser-only bug found during
  this project (DPR scaling, drag-paint lag, grid-resize cropping) passed
  every automated check available in this environment. The honest
  response was to document exactly what still needs human verification in
  a real browser, rather than either skipping it or pretending it had been
  done.

## Deployment

A production build is included at `dist/` (from `npm run build`) and
served locally via `npm run preview` to confirm it works standalone.
**This environment has no network access to any static hosting provider**
(Vercel, Netlify, GitHub Pages, etc. are not reachable from this sandbox),
so an actual live deployment could not be performed as part of this build
— that is a deliberate, honest limitation, not an oversight. To deploy:

```bash
npm run build
# then either:
npx vercel --prod dist          # Vercel
# or drag the dist/ folder into Netlify's web UI
# or: npm i -g gh-pages && npx gh-pages -d dist   # GitHub Pages
```

## Demo script (60-120s)

No screen-recording capability exists in this environment either, so
here's the script to record it, per requirements §30:

1. **(0-15s)** Open the app. Point out the grid, the toolbar, and generate
   a new random map via "New Random Seed."
2. **(15-40s)** Paint a few walls, drag the goal somewhere interesting,
   select BFS, press Run — watch the frontier expand and the path draw in.
3. **(40-65s)** Switch to A*, press Run on the same map. Point out the
   Metrics panel's live "Nodes Explored" counter landing lower than BFS's
   did, for the identical optimal path length/cost.
4. **(65-90s)** Pause mid-run, step forward/backward a few events, click a
   frontier cell with the Inspect tool, show its live G/H/F scores in the
   Inspector.
5. **(90-110s)** Press Run All — four canvases open, each animating a
   different algorithm on the same map in a different color. Point out
   A*'s lower "explored" count next to BFS/Dijkstra in the sidebar table
   for the identical optimal cost. Mention Game Mode as what's next (see
   below).

## Future roadmap

Explicitly deferred, in priority order per `HANDOFF.md` and
`algorithm-playground-requirements.md`:

1. **Game Mode** — the same world/algorithm systems, wrapped in objectives,
   entities (keys, doors, enemies, hazards), and scenarios (Escape,
   Treasure, Dangerous Terrain, Enemy, Multi-target, Limited Resources).
2. **Sorting Playground** — a separate mode (bubble/selection/insertion/
   merge/quick/heap sort), reusing the same event-timeline/playback
   architecture this pathfinding MVP already built.
3. **Maze/cellular-automata generators**, beyond the current random-
   obstacle generator.
4. **Shareable-scenario URLs** (`/play?seed=...&algorithm=...`).
5. Further out: Genetic Algorithm and Reinforcement Learning playgrounds.

None of these have a phase file yet — per this project's own rule
(`Documentation Consistency Fixes — Pre-Phase-1.md` §3), a phase file gets
created when that work is actually picked up, not speculatively in advance.

## Continuing development

This README is the portfolio-facing entry point (requirements §30). If
you're picking this project back up to build the next phase (Game Mode,
Sorting, etc.), start with `HANDOFF.md` instead — it has the exact
current status, a full phase-by-phase log of every decision and deviation,
and points to `ARCHITECTURE.md` (interfaces/folder structure/source of
truth) and the individual `PHASE_N_*.md` files (self-contained specs per
milestone). This is the same order every phase of this project itself was
built in.
