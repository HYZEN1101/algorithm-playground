import type { Grid } from "../../world/grid";
import { TerrainType } from "../../world/terrain";
import type { NodeId } from "../../types/shared";
import type { CellMetrics } from "../coordinates";
import { gridToPixel, gridToPixelCenter } from "../coordinates";
import {
  CANVAS_BACKGROUND,
  GRID_LINE_COLOR,
  TERRAIN_COLORS,
  TERRAIN_PATTERNS,
  WALL_HATCH_COLOR,
  WALL_HATCH_LINE_WIDTH,
  WALL_HATCH_SPACING,
  START_COLOR,
  GOAL_COLOR,
} from "./theme";

// Below this cell size, per-terrain patterns are skipped — they'd just be
// visual noise at high zoom-out (e.g. a 200x200 grid) and cost real paint
// time for no legibility benefit. Wall's hatch is exempt: walls need to
// stay identifiable at any size since they're the one terrain that changes
// what's passable, and hatch draws cheaply as a couple of clipped lines.
const MIN_CELL_SIZE_FOR_TERRAIN_PATTERN = 10;

/**
 * Draws the full static layer (background, every cell's terrain + pattern,
 * grid lines, start/goal icons) onto the given context. Called only when
 * the world actually changes (renderer.ts gates this behind a dirty flag) —
 * never once per animation frame. See ARCHITECTURE.md §8 and
 * PHASE_2_CANVAS.md's redraw-counter acceptance criterion.
 */
export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  metrics: CellMetrics,
  start: NodeId,
  goal: NodeId,
): void {
  const canvasWidth = metrics.offsetX * 2 + metrics.cellSize * metrics.gridWidth;
  const canvasHeight = metrics.offsetY * 2 + metrics.cellSize * metrics.gridHeight;

  ctx.fillStyle = CANVAS_BACKGROUND;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const id = grid.idOf(row, col);
      drawCell(ctx, grid, id, row, col, metrics);
    }
  }

  drawGridLines(ctx, metrics);
  drawMarker(ctx, start, grid, metrics, START_COLOR, "start");
  drawMarker(ctx, goal, grid, metrics, GOAL_COLOR, "goal");
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  id: NodeId,
  row: number,
  col: number,
  metrics: CellMetrics,
): void {
  const terrain = grid.terrainAt(id);
  const { x, y } = gridToPixel(row, col, metrics);
  const size = metrics.cellSize;

  ctx.fillStyle = TERRAIN_COLORS[terrain];
  ctx.fillRect(x, y, size, size);

  if (terrain === TerrainType.Wall) {
    drawHatchPattern(ctx, x, y, size);
    return;
  }

  if (size >= MIN_CELL_SIZE_FOR_TERRAIN_PATTERN) {
    drawTerrainPattern(ctx, terrain, x, y, size);
  }
}

function drawHatchPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.strokeStyle = WALL_HATCH_COLOR;
  ctx.lineWidth = WALL_HATCH_LINE_WIDTH;
  for (let offset = -size; offset < size * 2; offset += WALL_HATCH_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + size, y + size);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTerrainPattern(
  ctx: CanvasRenderingContext2D,
  terrain: TerrainType,
  x: number,
  y: number,
  size: number,
): void {
  const pattern = TERRAIN_PATTERNS[terrain];
  if (pattern === "none") return;

  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.lineWidth = 1;

  const cx = x + size / 2;
  const cy = y + size / 2;
  const pad = size * 0.22;

  switch (pattern) {
    case "tufts": {
      // Grass: three short vertical dashes
      for (const dx of [-pad, 0, pad]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, y + size - pad);
        ctx.lineTo(cx + dx, y + size - pad - size * 0.3);
        ctx.stroke();
      }
      break;
    }
    case "dots": {
      // Mud: three small speckles
      const r = Math.max(1, size * 0.06);
      for (const [dx, dy] of [
        [-pad, -pad * 0.5],
        [pad * 0.6, pad * 0.3],
        [0, pad],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "waves": {
      // Water: two short horizontal wave strokes
      for (const dy of [-pad * 0.5, pad * 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx - pad, cy + dy);
        ctx.quadraticCurveTo(cx, cy + dy - pad * 0.5, cx + pad, cy + dy);
        ctx.stroke();
      }
      break;
    }
    case "peaks": {
      // Mountain: a small triangle peak
      ctx.beginPath();
      ctx.moveTo(cx, cy - pad);
      ctx.lineTo(cx - pad, cy + pad * 0.6);
      ctx.lineTo(cx + pad, cy + pad * 0.6);
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawGridLines(ctx: CanvasRenderingContext2D, metrics: CellMetrics): void {
  const { cellSize, offsetX, offsetY, gridWidth, gridHeight } = metrics;
  // Grid lines add negligible value and real paint cost once cells are a
  // couple of px; skip them at high zoom-out.
  if (cellSize < 4) return;

  ctx.save();
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 0; col <= gridWidth; col++) {
    const x = offsetX + col * cellSize + 0.5; // +0.5 for crisp 1px lines
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + gridHeight * cellSize);
  }
  for (let row = 0; row <= gridHeight; row++) {
    const y = offsetY + row * cellSize + 0.5;
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + gridWidth * cellSize, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Start is drawn as a filled circle with a ring (an "origin point" shape);
 * goal as a diamond (a distinct silhouette so shape alone — not just color —
 * distinguishes them, per the non-color-only requirement).
 */
function drawMarker(
  ctx: CanvasRenderingContext2D,
  id: NodeId,
  grid: Grid,
  metrics: CellMetrics,
  color: string,
  kind: "start" | "goal",
): void {
  const { row, col } = grid.coordOf(id);
  const { x, y } = gridToPixelCenter(row, col, metrics);
  const r = metrics.cellSize * 0.32;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, metrics.cellSize * 0.06);

  if (kind === "start") {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
