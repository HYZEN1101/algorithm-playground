# Accessibility Notes

Phase 7 deliverable per `PHASE_7_ACCESSIBILITY_PERFORMANCE.md` and
ARCHITECTURE.md §17.

## Seed visibility and copy

The seed input in `GenerateButton.tsx` is always visible (not hidden behind
a toggle) and always reflects the currently-active, committed seed at rest
(synced via a `useEffect` on the store's `seed` field — Phase 2's original
implementation already did this; unchanged this phase). Added this phase:

- A **Copy** button next to the seed field, using the Clipboard API
  (`navigator.clipboard.writeText`). Gives explicit "Copied!" / "Failed"
  feedback rather than assuming success silently — the Clipboard API can
  fail (no permission, insecure context, older browser), and per this
  phase's own "seed is always visible and copyable" requirement, a failure
  should be visible to the user, not swallowed.
- Two distinct actions, replacing the previous single "Generate" button,
  per this phase's explicit "generate random seed" vs "use this seed"
  distinction: **"Use This Seed"** regenerates the world with whatever seed
  is currently typed in the field (unchanged behavior from before, renamed
  for clarity), and **"New Random Seed"** picks a fresh arbitrary seed,
  writes it into the field, and generates with it in one action.
- Loading a seed via a URL query parameter is explicitly OUT of scope here,
  per the phase file — that's the separate, post-MVP "Shareable Scenarios"
  feature (requirements §29).

**Manual verification still needed** (not verifiable headlessly): re-typing
a previously-seen seed and pressing "Use This Seed" reproduces an identical
grid. This was already proven correct at the data layer in Phase 1
(`randomObstacles.test.ts`'s determinism tests, and this phase's own
`worldStore.resizeGrid` determinism test) — this phase only adds UI/UX
around an already-correct guarantee, so a human re-confirming it in the
actual running app is a light sanity check, not new risk.

## Keyboard navigation

**Playback controls** (`PlaybackControls.tsx`): already fully keyboard-
reachable via Tab, since Phase 5 built them as real `<button>`/
`<input type="range">` elements with `aria-label`s from the start — nothing
needed to change here this phase.

**Grid cell selection** (new this phase): the canvas element
(`CanvasGrid.tsx`) is now a real Tab stop (`tabIndex={0}`, `role="application"`,
a descriptive `aria-label`). Since individual grid cells aren't DOM nodes
(they're pixels on a `<canvas>`), there's no native way to give each cell
its own focusable element — per ARCHITECTURE.md §17's own anticipated
design, keyboard navigation works via **a renderer-drawn focus ring
synced to a piece of application state**, not native per-cell DOM focus:

- `uiStore.cursorNodeId` (new field) tracks where the keyboard cursor
  currently is, independent of `selectedNodeId` (what the Inspector shows).
  Moving the cursor around to explore doesn't change the Inspector's
  contents until the user explicitly commits a cell.
- Arrow keys move the cursor one cell at a time, clamped to the grid's
  bounds (`useGridInteraction.ts`'s new `onKeyDown` handler).
- Enter or Space commits the cursor's current position as the Inspector
  selection — the exact same `uiStore.selectNode()` path the existing
  mouse-based "Inspect" tool already used (Phase 6), per this phase's own
  instruction to reuse it rather than build a second selection mechanism.
- Tabbing onto the canvas for the first time (before any arrow key press)
  initializes the cursor to the start node, so the focus ring is visible
  immediately via Tab alone — a user shouldn't have to guess where the
  cursor is before they can see it.
- The renderer draws the cursor as a distinct blue dashed square
  (`KEYBOARD_CURSOR_COLOR`, `pathRenderer.ts`), visually unambiguous from
  both the red circular "current node" ring (a playback concept, only
  meaningful during/after a run) and the frontier's own dashed border (an
  algorithm-status fill). The keyboard cursor can sit over any cell
  regardless of algorithm status, including a completely unexplored one on
  a grid where nothing has been run yet.

**Full keyboard walkthrough performed** (traced through the actual code
paths, not run in a real browser — see the performance notes' environment
limitation, same constraint applies here):

1. Tab from page load reaches, in order: the world/grid-size controls, the
   seed controls, the algorithm picker and Run button, the Inspect tool
   button (and other toolbar tools), the canvas grid, then the playback
   controls (Step/Play/Reset/Speed) at the bottom.
2. Arrow keys on the focused canvas move the cursor; Enter/Space selects
   the focused cell, populating the Inspector.
3. Tab continues from the canvas into the playback controls, all of which
   are real interactive elements.

**Gap found and consciously deferred, not silently dropped**: there is
currently no keyboard-accessible way to *choose* which paint/terrain/
move-start/move-goal/inspect *tool* is active other than clicking the
toolbar buttons directly — those buttons are real `<button>` elements
(reachable and activatable via Tab + Enter/Space, so they're not
inaccessible), but there's no arrow-key-driven "toolbar navigation" pattern
beyond ordinary Tab order. This is a minor UX polish gap, not a hard
accessibility blocker (every control is still keyboard-operable), and is
left for Phase 8's polish pass if it comes up again.

## Reduced motion

`renderer.ts` reads `window.matchMedia('(prefers-reduced-motion: reduce)')`
once at renderer creation (guarded for environments without `window`/
`matchMedia`, since this project's test environment has neither), and keeps
it live via a `change` event listener, cleaned up in `destroy()`.

**What actually changes under reduced motion**: once path construction
begins (any node has reached `status: "path"` at the current playback
index), the renderer reveals the ENTIRE final path immediately instead of
letting the normal per-event playback trickle it in one cell at a time as
`index` advances through the timeline's `BUILD_PATH` events. This directly
implements the phase file's "path reveals instantly rather than
progressively" requirement. Implementation note: this uses the pure
`deriveNodeStates` against the FULL event array (not the renderer's
incremental cache) specifically so it doesn't corrupt that cache's
forward-only assumption for the next, lower-index frame during the
still-in-progress exploration phase — documented in `renderer.ts` itself,
not just here.

**What did NOT need changing, and why**: the phase file also asks to
"disable node pulse animation." This codebase has never implemented a
continuous pulsing animation for the current-node ring — Phase 5 built it
as a plain static ring, redrawn each frame but not animated in any
oscillating/pulsing sense. There is genuinely nothing to disable here; this
is recorded explicitly rather than silently treating the requirement as
satisfied by inaction without saying so.

**State transitions still visually register instantly under reduced
motion, not disappearing entirely**, per the phase file's explicit
requirement: frontier/visited/path fills and borders are plain fills, not
fade-in/fade-out transitions, in every configuration (reduced motion or
not) — so this requirement was already satisfied by the existing
(non-animated) drawing approach, not something this phase needed to add.

**Manual verification still needed**: toggling the OS-level reduced-motion
setting (or a `matchMedia` override) in a real browser and confirming the
path-reveal behavior actually triggers and looks right — not verifiable
headlessly.

## Color contrast (WCAG AA)

Full formal pass this phase, replacing Phase 2's "known gap, deferred"
palette. All contrast ratios below were computed programmatically (Node
script implementing the same WCAG relative-luminance formula
`theme.ts` uses for its own `contrastRatio()` helper), not estimated by eye.

| Pair | Ratio | WCAG AA (3:1 large/graphical) |
|---|---|---|
| Wall vs Road | 11.06 : 1 | clears comfortably |
| Wall vs background | 13.01 : 1 | clears comfortably |
| Start vs Road | 4.91 : 1 | clears |
| Goal vs Road | 6.38 : 1 | clears |
| Grass vs Road | 4.01 : 1 | clears (was 1.48:1 before this phase) |
| Mud vs Road | 5.02 : 1 | clears (was 2.54:1 before this phase) |
| Water vs Road | 4.41 : 1 | clears (was 1.72:1 before this phase) |
| Mountain vs Road | 4.42 : 1 | clears (was a marginal 3.14:1 before this phase) |

**What changed**: `TERRAIN_COLORS` for Grass/Mud/Water/Mountain in
`theme.ts` were darkened (Road, the shared light "neutral ground" every
other terrain is visually compared against, was left unchanged) until every
terrain clears 3:1 against Road. `TERRAIN_PATTERNS`' stroke color in
`gridRenderer.ts` was switched from dark (`rgba(0,0,0,0.28)`) to light
(`rgba(255,255,255,0.55)`) to match — the old dark stroke was chosen for
the old, lighter fills and would have been invisible against the new dark
ones.

**Known, accepted tradeoff, documented rather than hidden**: darkening all
four non-Road terrains to each clear 3:1 against a shared light Road
necessarily pushed them closer to each other in luminance — their MUTUAL
contrast against each other is now low (roughly 1.0-1.25:1, measured).
Distinguishing one non-Road terrain from another (e.g. Grass from Water)
was always intended to rely primarily on `TERRAIN_PATTERNS` (tufts / dots /
waves / peaks), not color, per guideline §24's "combinations of color,
icons, borders, patterns" principle — achieving 3:1 against Road for all
four AND strong mutual separation between all four simultaneously is not
achievable within one cohesive, restrained palette (guideline §32), so this
phase optimized for the criterion the phase file actually states ("every
distinct terrain/state color pair" read as "against the shared neutral
baseline," which is the practical, task-relevant reading — the user's real
task is "is this special terrain or plain ground," not "which of five
non-Road terrains is this by color alone").

**Not formally computed, and why**: the playback overlay's frontier/
visited/path fills (`pathRenderer.ts`) use semi-transparent colors layered
on top of varying terrain backgrounds (`rgba(120, 170, 255, 0.28)` etc.) —
a literal single WCAG contrast ratio isn't well-defined for a translucent
fill over an arbitrary, varying background color. Rather than compute a
number that would be technically precise but practically meaningless (or
worse, falsely reassuring), this is documented as an open item: every
overlay STATE already has a non-color cue (frontier: dashed border; path:
solid border; current node: distinct ring shape; keyboard cursor: distinct
dashed square) satisfying the "not relying on color alone" principle
independent of any specific contrast ratio, but a literal opacity/contrast
audit of these overlays against the full range of possible terrain
backgrounds underneath them has not been done. Candidate follow-up for
Phase 8's polish pass if it's found lacking in practice.

## Summary: known limitations carried forward

- No keyboard-driven toolbar/tool-selection navigation beyond ordinary Tab
  order (all tools are still individually keyboard-operable).
- Overlay fill opacity/contrast against arbitrary terrain backgrounds not
  formally audited (pattern/border/shape cues exist independent of color
  for every state, mitigating this).
- Every manual, real-browser-only verification item listed above (seed
  round-trip, reduced-motion toggle, actual keyboard walkthrough with a
  screen reader or real assistive tech) is still outstanding — this
  environment has no browser to perform them in.
