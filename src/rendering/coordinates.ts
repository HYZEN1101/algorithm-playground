/**
 * Centralizes ALL grid <-> pixel conversion and devicePixelRatio handling.
 * Per ARCHITECTURE.md §8: this is the one and only place this math exists.
 *
 * Design note: all coordinate math here operates in CSS-pixel space (the
 * same space pointer events report via getBoundingClientRect()).
 * devicePixelRatio only affects the canvas's backing-store resolution
 * (configureCanvasBackingStore, below) and the context scale transform
 * applied once in renderer.ts — it never enters the hit-testing math, so
 * pixelToGrid/gridToPixel don't take a dpr parameter. This is why this
 * file's round-trip tests vary canvas/grid sizes rather than DPR directly.
 */

export interface GridViewport {
  gridWidth: number; // cells
  gridHeight: number; // cells
  canvasWidth: number; // CSS px
  canvasHeight: number; // CSS px
}

export interface CellMetrics {
  cellSize: number; // CSS px per cell (cells are square)
  offsetX: number; // CSS px, left padding used to center the grid
  offsetY: number; // CSS px, top padding used to center the grid
  gridWidth: number;
  gridHeight: number;
}

/**
 * Computes square cell size + centering offsets for a grid drawn inside a
 * canvas of the given CSS size. Cells are floored to whole pixels to avoid
 * anti-aliased seams between adjacent cells.
 */
export function computeCellMetrics(viewport: GridViewport): CellMetrics {
  const { gridWidth, gridHeight, canvasWidth, canvasHeight } = viewport;
  const cellSize = Math.max(
    1,
    Math.floor(Math.min(canvasWidth / gridWidth, canvasHeight / gridHeight)),
  );
  const usedWidth = cellSize * gridWidth;
  const usedHeight = cellSize * gridHeight;
  return {
    cellSize,
    offsetX: (canvasWidth - usedWidth) / 2,
    offsetY: (canvasHeight - usedHeight) / 2,
    gridWidth,
    gridHeight,
  };
}

/** Top-left corner of a cell, in CSS px. */
export function gridToPixel(row: number, col: number, metrics: CellMetrics): { x: number; y: number } {
  return {
    x: metrics.offsetX + col * metrics.cellSize,
    y: metrics.offsetY + row * metrics.cellSize,
  };
}

/** Center point of a cell, in CSS px — useful for drawing icons/markers. */
export function gridToPixelCenter(
  row: number,
  col: number,
  metrics: CellMetrics,
): { x: number; y: number } {
  const { x, y } = gridToPixel(row, col, metrics);
  return { x: x + metrics.cellSize / 2, y: y + metrics.cellSize / 2 };
}

/**
 * Converts a CSS-pixel point to a grid cell, or null if the point falls
 * outside the drawn grid area (including the centering padding).
 */
export function pixelToGrid(
  x: number,
  y: number,
  metrics: CellMetrics,
): { row: number; col: number } | null {
  const localX = x - metrics.offsetX;
  const localY = y - metrics.offsetY;
  if (localX < 0 || localY < 0) return null;

  const col = Math.floor(localX / metrics.cellSize);
  const row = Math.floor(localY / metrics.cellSize);
  if (col < 0 || col >= metrics.gridWidth || row < 0 || row >= metrics.gridHeight) {
    return null;
  }
  return { row, col };
}

/**
 * Sizes a canvas's backing store for a crisp render at the given
 * devicePixelRatio while keeping its CSS (layout) size unchanged. Caller is
 * responsible for calling ctx.scale(dpr, dpr) once after resizing so that
 * subsequent draw calls can keep using CSS-pixel coordinates.
 *
 * Not unit tested (requires a real HTMLCanvasElement / DOM) — verified
 * manually per PHASE_2_CANVAS.md's acceptance criteria.
 */
export function configureCanvasBackingStore(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): void {
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
  const backingHeight = Math.max(1, Math.round(cssHeight * dpr));

  // Avoid clearing/resizing the backing store (and losing its contents)
  // when the size hasn't actually changed.
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
}
