import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import { computeCellMetrics, configureCanvasBackingStore, type CellMetrics } from "../coordinates";
import { drawStaticLayer, drawCells } from "./gridRenderer";

export interface RendererWorldSource {
  getState(): { grid: Grid; start: NodeId; goal: NodeId };
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
export function createRenderer(canvas: HTMLCanvasElement, world: RendererWorldSource): RendererHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to acquire 2D rendering context for the grid canvas");
  }

  // Offscreen buffer holding the static layer, regenerated only when dirty.
  const offscreen = document.createElement("canvas");
  const offscreenCtx = offscreen.getContext("2d");
  if (!offscreenCtx) {
    throw new Error("Failed to acquire 2D rendering context for the offscreen buffer");
  }

  let metrics: CellMetrics | null = null;
  let dpr = 1;
  // "full" | Set<NodeId> (specific cells pending) | null (nothing pending).
  // A "full" pending redraw absorbs any subsequently-requested cell ids —
  // no need to track both.
  let pending: "full" | Set<NodeId> | null = "full"; // draw once on first frame
  let rafHandle: number | null = null;
  let destroyed = false;

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

  function frame(): void {
    if (destroyed) return;

    if (pending === "full") {
      drawFull();
      pending = null;
    } else if (pending !== null) {
      drawPartial(pending);
      pending = null;
    }

    // Blit the cached static layer onto the visible canvas. Both canvases
    // share IDENTICAL backing-store pixel dimensions (both sized via
    // configureCanvasBackingStore with the same cssWidth/cssHeight/dpr in
    // updateSize below), so this must be a plain 1:1 physical-pixel copy —
    // no transform/scale here. (Previously this ran under a dpr-scaled
    // ctx transform, which double-applied the dpr scale on top of the
    // offscreen buffer's own already-dpr-scaled pixel size, rendering
    // everything dpr² too large and misaligned with pointer hit-testing —
    // that was the "walls never line up with the cursor" bug found in
    // manual testing on a scaled display. Fixed by resetting to identity
    // before the blit.)
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    if (metrics) {
      ctx!.drawImage(offscreen, 0, 0);
    }

    rafHandle = requestAnimationFrame(frame);
  }

  rafHandle = requestAnimationFrame(frame);

  return {
    requestRedraw(change?: RenderChange): void {
      if (!change || change.kind === "full") {
        pending = "full";
        return;
      }
      if (change.kind === "none") return;

      // change.kind === "cells"
      if (pending === "full") return; // a full redraw already supersedes this
      if (pending === null) pending = new Set<NodeId>();
      for (const id of change.ids) pending.add(id);
    },

    updateSize(cssWidth: number, cssHeight: number, nextDpr: number): void {
      dpr = nextDpr;
      configureCanvasBackingStore(canvas, cssWidth, cssHeight, dpr);
      configureCanvasBackingStore(offscreen, cssWidth, cssHeight, dpr);
      // The OFFSCREEN buffer's context does need the dpr-scaled transform:
      // drawStaticLayer/drawCells draw in CSS-pixel-space coordinates, and
      // this transform is what maps those onto the offscreen canvas's
      // larger (dpr-scaled) physical pixel buffer. This is unrelated to —
      // and unaffected by — the blit fix above, which is about how that
      // already-correct offscreen buffer gets copied onto the visible one.
      offscreenCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { grid } = world.getState();
      metrics = computeCellMetrics({
        gridWidth: grid.width,
        gridHeight: grid.height,
        canvasWidth: cssWidth,
        canvasHeight: cssHeight,
      });
      pending = "full";
    },

    destroy(): void {
      destroyed = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    },

    getMetrics(): CellMetrics | null {
      return metrics;
    },
  };
}
