import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import { computeCellMetrics, configureCanvasBackingStore, type CellMetrics } from "../coordinates";
import { drawStaticLayer } from "./gridRenderer";

export interface RendererWorldSource {
  getState(): { grid: Grid; start: NodeId; goal: NodeId };
}

export interface RendererHandle {
  /** Marks the static layer dirty; call after any world edit. */
  requestRedraw(): void;
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
  let dirty = true; // draw once on first frame
  let rafHandle: number | null = null;
  let destroyed = false;

  function regenerateStaticLayer(): void {
    if (!metrics) return;
    const { grid, start, goal } = world.getState();
    drawStaticLayer(offscreenCtx!, grid, metrics, start, goal);

    if (import.meta.env.DEV) {
      window.__algorithmPlaygroundStaticRedrawCount = (window.__algorithmPlaygroundStaticRedrawCount ?? 0) + 1;
    }
  }

  function frame(): void {
    if (destroyed) return;

    if (dirty && metrics) {
      regenerateStaticLayer();
      dirty = false;
    }

    // Cheap every-frame blit of the cached static layer. This is the hook
    // future phases (dynamic frontier/path overlays) will draw on top of,
    // on top of this same blit, each frame — see PHASE_5_PLAYBACK.md.
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (metrics) {
      ctx!.drawImage(offscreen, 0, 0);
    }

    rafHandle = requestAnimationFrame(frame);
  }

  rafHandle = requestAnimationFrame(frame);

  return {
    requestRedraw(): void {
      dirty = true;
    },

    updateSize(cssWidth: number, cssHeight: number, nextDpr: number): void {
      dpr = nextDpr;
      configureCanvasBackingStore(canvas, cssWidth, cssHeight, dpr);
      configureCanvasBackingStore(offscreen, cssWidth, cssHeight, dpr);
      offscreenCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { grid } = world.getState();
      metrics = computeCellMetrics({
        gridWidth: grid.width,
        gridHeight: grid.height,
        canvasWidth: cssWidth,
        canvasHeight: cssHeight,
      });
      dirty = true;
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
