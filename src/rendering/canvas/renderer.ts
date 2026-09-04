import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { AlgorithmEvent, NodeState } from "../../algorithms/pathfinding/types";
import { computeCellMetrics, configureCanvasBackingStore, type CellMetrics } from "../coordinates";
import { drawStaticLayer, drawCells } from "./gridRenderer";
import { drawPathOverlay, type PathColor } from "./pathRenderer";
import { createIncrementalNodeStateDeriver, deriveNodeStates } from "../../playback/deriveNodeStates";

export interface RendererWorldSource {
  getState(): { grid: Grid; start: NodeId; goal: NodeId };
}

/**
 * Optional per-renderer configuration. `pathColor` lets Comparison Mode's
 * four simultaneous mini-canvases (Phase 9 addendum) each show a
 * distinct, algorithm-attributable path color while sharing identical
 * frontier/visited styling — the single main CanvasGrid omits this and
 * keeps the original default path color unchanged.
 */
export interface RendererOptions {
  pathColor?: PathColor;
}

/**
 * Deliberately NOT importing WorldChange from state/worldStore.ts — kept
 * structurally identical instead, so renderer.ts has no dependency on
 * state/ (matches the MetricsSource pattern in useGridInteraction.ts).
 * CanvasGrid.tsx passes worldStore's WorldChange values straight through;
 * TS structural typing accepts them without any conversion.
 */
export type RenderChange = { kind: "cells"; ids: NodeId[] } | { kind: "full" } | { kind: "none" };

export interface RendererHandle {
  /** Marks the static layer dirty; call after any world edit. Omit the
   * argument (or pass "full") to force a full redraw, e.g. on first mount. */
  requestRedraw(change?: RenderChange): void;
  /** Call on resize (container/window resize, DPR change). */
  updateSize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Cancels the rAF loop. Must be called on unmount. */
  destroy(): void;
  /** Current metrics, for interaction code that needs to hit-test. Null before first size update. */
  getMetrics(): CellMetrics | null;
  /**
   * Real playback-index-driven rendering (Phase 5). Replaces Phase 3/4's
   * `setAlgorithmResult(finalNodeState)`, which showed one static
   * snapshot with no index. Call this every time the PlaybackController
   * notifies (every rAF tick while playing, plus every step/seek/reset) —
   * the renderer derives the visible NodeState map via
   * `deriveNodeStates(events, index)` and marks the overlay dirty for the
   * next frame. Pass `null` to clear the overlay entirely (e.g. no
   * algorithm has been run yet).
   */
  setPlaybackFrame(events: AlgorithmEvent[] | null, index: number): void;

  /**
   * Sets the keyboard-navigation focus cursor position (Phase 7,
   * ARCHITECTURE.md §17 — "a hidden, visually-synced focus ring drawn by
   * the renderer, since individual cells aren't DOM nodes"). Pass `null`
   * when the canvas doesn't have keyboard focus / no cursor is active.
   */
  setKeyboardCursor(nodeId: NodeId | null): void;
}

// Gated behind import.meta.env.DEV per PHASE_2_CANVAS.md's acceptance
// criteria ("gate it behind import.meta.env.DEV" rather than leaving a
// permanent counter or deleting the instrumentation outright). Check via
// the browser console: window.__algorithmPlaygroundStaticRedrawCount
// Increments on BOTH full and partial (cells-only) static-layer touches —
// the thing this instruments is "did the static layer get touched while
// idle" (should be no), not "was it specifically a full-grid redraw."
declare global {
  interface Window {
    __algorithmPlaygroundStaticRedrawCount?: number;
  }
}

/**
 * Creates the renderer for a single <canvas>. Framework-agnostic — takes a
 * canvas element and a plain (non-React) world data source, never imports
 * React. CanvasGrid.tsx is the only component allowed to construct this.
 */
export function createRenderer(canvas: HTMLCanvasElement, world: RendererWorldSource, options: RendererOptions = {}): RendererHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D rendering context for the grid canvas");
  }

  // Offscreen buffer holding the static WORLD layer (terrain/walls/start/
  // goal), regenerated only when dirty.
  const offscreen = document.createElement("canvas");
  const offscreenCtx = offscreen.getContext("2d");
  if (!offscreenCtx) {
    throw new Error("Failed to acquire 2D rendering context for the offscreen buffer");
  }

  // Separate offscreen buffer for the TEMPORARY algorithm-result overlay
  // (Phase 3). Kept as its own cached layer — not baked into the world
  // layer above — so world edits and algorithm runs redraw independently,
  // and so Phase 5 can swap out how this specific layer gets populated
  // without touching gridRenderer.ts at all.
  const algorithmOffscreen = document.createElement("canvas");
  const algorithmOffscreenCtx = algorithmOffscreen.getContext("2d");
  if (!algorithmOffscreenCtx) {
    throw new Error("Failed to acquire 2D rendering context for the algorithm overlay buffer");
  }

  let metrics: CellMetrics | null = null;
  let dpr = 1;
  // Last known CSS size passed to updateSize() — kept so metrics can be
  // recomputed reactively when the world's grid *dimensions* change
  // (worldStore.resizeGrid) without requiring a container/window resize
  // event to also fire. Without this, resizing the grid left `metrics`
  // stale (still reflecting the OLD width/height), so cellSize was
  // computed for the wrong grid shape — a bigger new grid would overflow
  // the canvas and appear "cropped" to its top-left corner; a smaller one
  // would leave dead space. (Found via user bug report post-Phase-5.)
  let lastCssWidth: number | null = null;
  let lastCssHeight: number | null = null;
  // "full" | Set<NodeId> (specific cells pending) | null (nothing pending).
  // A "full" pending redraw absorbs any subsequently-requested cell ids —
  // no need to track both.
  let pending: "full" | Set<NodeId> | null = "full"; // draw once on first frame
  let currentNodeState: Map<NodeId, NodeState> | null = null;
  let currentNodeId: NodeId | null = null;
  let algorithmPending = true; // draw once on first frame (clears the overlay to empty)
  // Incremental, not the pure deriveNodeStates — this gets called once per
  // playback notify (up to the real device's rAF rate while playing), and
  // recomputing the full event timeline from scratch on every call is
  // exactly the "sluggish at high speed" cost this exists to avoid. See
  // createIncrementalNodeStateDeriver's own doc comment for the reasoning.
  const nodeStateDeriver = createIncrementalNodeStateDeriver();
  let keyboardCursorId: NodeId | null = null;

  // prefers-reduced-motion, read once at init and kept live via a change
  // listener (ARCHITECTURE.md §17: "read once at renderer init"). Guarded
  // for environments without `window`/`matchMedia` (this project's Vitest
  // config has no jsdom, so nothing here currently runs under test, but
  // renderer.ts has no other reason to assume a browser-shaped global
  // beyond `document`/canvas, which it already requires unconditionally).
  let reducedMotion = false;
  let reducedMotionQuery: MediaQueryList | null = null;
  const handleReducedMotionChange = () => {
    reducedMotion = reducedMotionQuery!.matches;
    algorithmPending = true; // re-derive the overlay under the new preference immediately
  };
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = reducedMotionQuery.matches;
    reducedMotionQuery.addEventListener?.("change", handleReducedMotionChange);
  }

  let rafHandle: number | null = null;
  let destroyed = false;
  // The render loop now idles instead of running forever: `frameScheduled`
  // gates a single pending requestAnimationFrame call, and only the
  // methods below that actually mark something dirty (requestRedraw,
  // updateSize, setPlaybackFrame, setKeyboardCursor) call scheduleFrame()
  // to wake it back up. Previously `frame()` unconditionally called
  // `requestAnimationFrame(frame)` at its own end, forever, from the
  // moment the canvas mounted — clearing and re-blitting the ENTIRE
  // visible canvas 60 times a second even while completely idle, with
  // nothing on screen changing at all. That's real, continuous, wasted
  // main-thread work competing with anything else happening on the page
  // (switching algorithms, regenerating a large world, resizing), which
  // is very likely why those specific actions felt like "the app
  // refreshes a lot" — a background loop burning CPU nonstop makes any
  // simultaneous heavier work visibly janky. (Found via direct user
  // report post-Phase-8; there is no automated test for this fix, since
  // it requires a real browser's rAF/Canvas, which this environment
  // doesn't have — see HANDOFF.md.)
  let frameScheduled = false;

  function scheduleFrame(): void {
    if (frameScheduled || destroyed) return;
    frameScheduled = true;
    rafHandle = requestAnimationFrame(runFrame);
  }

  function runFrame(): void {
    frameScheduled = false;
    if (destroyed) return;
    frame();
    // Note: no automatic reschedule here. During active playback,
    // PlaybackController's OWN rAF loop calls setPlaybackFrame() on every
    // tick, and setPlaybackFrame() calls scheduleFrame() itself — so
    // playback animation continues at exactly the pace playback ticks
    // arrive, not a separate always-on loop racing ahead of it.
  }

  function touchStaticLayer(): void {
    if (import.meta.env.DEV) {
      window.__algorithmPlaygroundStaticRedrawCount = (window.__algorithmPlaygroundStaticRedrawCount ?? 0) + 1;
    }
  }

  function drawFull(): void {
    if (!metrics) return;
    const { grid, start, goal } = world.getState();
    drawStaticLayer(offscreenCtx!, grid, metrics, start, goal);
    touchStaticLayer();
  }

  function drawPartial(ids: Set<NodeId>): void {
    if (!metrics) return;
    const { grid, start, goal } = world.getState();
    drawCells(offscreenCtx!, grid, ids, metrics, start, goal);
    touchStaticLayer();
  }

  function drawAlgorithmOverlay(): void {
    if (!metrics) return;
    const { grid } = world.getState();
    drawPathOverlay(algorithmOffscreenCtx!, grid, metrics, currentNodeState, currentNodeId, keyboardCursorId, options.pathColor);
  }

  /**
   * Recomputes `metrics` if the world's grid dimensions have drifted from
   * what `metrics` was last computed for — the reactive fix for the
   * "resize crops the grid" bug. Cheap (two integer comparisons) so it's
   * safe to call unconditionally every frame; only does real work
   * (computeCellMetrics + forcing a full redraw) on the rare frame right
   * after a dimension change actually happens.
   */
  function syncMetricsToGridDimensions(): void {
    if (metrics === null || lastCssWidth === null || lastCssHeight === null) return;
    const { grid } = world.getState();
    if (metrics.gridWidth === grid.width && metrics.gridHeight === grid.height) return;

    metrics = computeCellMetrics({
      gridWidth: grid.width,
      gridHeight: grid.height,
      canvasWidth: lastCssWidth,
      canvasHeight: lastCssHeight,
    });
    pending = "full";
    algorithmPending = true;
  }

  function frame(): void {
    if (destroyed) return;

    syncMetricsToGridDimensions();

    if (pending === "full") {
      drawFull();
      pending = null;
    } else if (pending !== null) {
      drawPartial(pending);
      pending = null;
    }

    if (algorithmPending) {
      drawAlgorithmOverlay();
      algorithmPending = false;
    }

    // Blit both cached layers onto the visible canvas. Both offscreen
    // buffers share IDENTICAL backing-store pixel dimensions to the visible
    // canvas (all three sized via configureCanvasBackingStore with the same
    // cssWidth/cssHeight/dpr in updateSize below), so this must be a plain
    // 1:1 physical-pixel copy — no transform/scale here. (Previously this
    // ran under a dpr-scaled ctx transform, which double-applied the dpr
    // scale on top of the offscreen buffer's own already-dpr-scaled pixel
    // size, rendering everything dpr² too large and misaligned with
    // pointer hit-testing — that was the "walls never line up with the
    // cursor" bug found in manual testing on a scaled display. Fixed by
    // resetting to identity before the blit.)
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    if (metrics) {
      ctx!.drawImage(offscreen, 0, 0);
      ctx!.drawImage(algorithmOffscreen, 0, 0); // overlay on top of terrain/walls
    }
  }

  scheduleFrame(); // initial paint on mount

  return {
    requestRedraw(change?: RenderChange): void {
      if (!change || change.kind === "full") {
        pending = "full";
        scheduleFrame();
        return;
      }
      if (change.kind === "none") return;

      // change.kind === "cells"
      if (pending === "full") return; // a full redraw already supersedes this
      if (pending === null) pending = new Set<NodeId>();
      for (const id of change.ids) pending.add(id);
      scheduleFrame();
    },

    updateSize(cssWidth: number, cssHeight: number, nextDpr: number): void {
      dpr = nextDpr;
      lastCssWidth = cssWidth;
      lastCssHeight = cssHeight;
      configureCanvasBackingStore(canvas, cssWidth, cssHeight, dpr);
      configureCanvasBackingStore(offscreen, cssWidth, cssHeight, dpr);
      configureCanvasBackingStore(algorithmOffscreen, cssWidth, cssHeight, dpr);
      // The OFFSCREEN buffers' contexts do need the dpr-scaled transform:
      // drawStaticLayer/drawCells/drawPathOverlay all draw in CSS-pixel-
      // space coordinates, and this transform is what maps those onto each
      // offscreen canvas's larger (dpr-scaled) physical pixel buffer. This
      // is unrelated to — and unaffected by — the blit fix above, which is
      // about how those already-correct offscreen buffers get copied onto
      // the visible one.
      offscreenCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      algorithmOffscreenCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { grid } = world.getState();
      metrics = computeCellMetrics({
        gridWidth: grid.width,
        gridHeight: grid.height,
        canvasWidth: cssWidth,
        canvasHeight: cssHeight,
      });
      pending = "full";
      algorithmPending = true;
      scheduleFrame();
    },

    destroy(): void {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      frameScheduled = false;
      reducedMotionQuery?.removeEventListener?.("change", handleReducedMotionChange);
    },

    getMetrics(): CellMetrics | null {
      return metrics;
    },

    setPlaybackFrame(events: AlgorithmEvent[] | null, index: number): void {
      if (!events || events.length === 0) {
        currentNodeState = null;
        currentNodeId = null;
      } else {
        const frame = nodeStateDeriver.derive(events, index);

        if (reducedMotion && hasAnyPathStatus(frame.states)) {
          // Reduced motion (ARCHITECTURE.md §17 / guideline §14): once
          // path construction has begun, reveal the whole path instantly
          // rather than watching it trickle in one BUILD_PATH event at a
          // time as normal playback advances through the timeline's tail.
          // Deliberately uses the PURE deriveNodeStates against the full
          // timeline here, NOT the incremental cache above — jumping the
          // incremental cache's internal index forward to events.length
          // would corrupt it for this same playback's next (lower, still
          // mid-exploration) index, forcing an expensive full recompute
          // on every subsequent frame instead of only during this rare,
          // short-lived reduced-motion tail segment.
          currentNodeState = deriveNodeStates(events, events.length);
          // Nothing left to highlight as "in progress" once the path is
          // fully resolved — matches "disable node pulse" in spirit, even
          // though this codebase never implemented a literal continuous
          // pulse animation to begin with (see docs/accessibility-notes.md).
          currentNodeId = null;
        } else {
          currentNodeState = frame.states;
          currentNodeId = frame.currentNodeId;
        }
      }
      algorithmPending = true;
      scheduleFrame();
    },

    setKeyboardCursor(nodeId: NodeId | null): void {
      if (keyboardCursorId === nodeId) return;
      keyboardCursorId = nodeId;
      algorithmPending = true;
      scheduleFrame();
    },
  };
}

/** True if any node in `states` currently has status "path". */
function hasAnyPathStatus(states: Map<NodeId, NodeState>): boolean {
  for (const state of states.values()) {
    if (state.status === "path") return true;
  }
  return false;
}
