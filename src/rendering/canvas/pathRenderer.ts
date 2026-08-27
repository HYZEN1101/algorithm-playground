import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { NodeState } from "../../algorithms/pathfinding/types";
import type { CellMetrics } from "../coordinates";
import { gridToPixel } from "../coordinates";

/**
 * Renders the live playback overlay: frontier, visited, path, and the
 * current node, each derived per-frame from `deriveNodeStates(events,
 * index)` (Phase 5) rather than a single static `finalNodeState` snapshot
 * (Phase 3/4's temporary behavior). The drawing primitives themselves
 * (`drawOverlayCell`) are unchanged from Phase 3/4 — they already took a
 * plain `Map<NodeId, NodeState>` and never cared whether it came from a
 * static result or a playback-index reduction, exactly as anticipated.
 *
 * Visual language here is still deliberately simple placeholder styling —
 * ARCHITECTURE.md §8's richer non-color-only encoding (diagonal-hatch path
 * fill, dashed frontier borders as icons/patterns rather than just a
 * lighter fill, etc.) is explicit Phase 7/8 polish work, not Phase 5's.
 * This phase only needs frontier/visited/path/current-node to be visually
 * distinguishable enough to confirm playback animates correctly.
 */
const FRONTIER_FILL = "rgba(120, 170, 255, 0.28)";
const FRONTIER_BORDER = "rgba(37, 99, 235, 0.55)";
const VISITED_FILL = "rgba(76, 110, 245, 0.35)";
const PATH_FILL = "rgba(240, 173, 78, 0.75)";
const PATH_BORDER = "rgba(120, 74, 6, 0.9)";
const CURRENT_NODE_RING = "rgba(220, 38, 38, 0.9)";

export function drawPathOverlay(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  metrics: CellMetrics,
  nodeStates: Map<NodeId, NodeState> | null,
  currentNodeId: NodeId | null = null,
): void {
  const canvasWidth = metrics.offsetX * 2 + metrics.cellSize * metrics.gridWidth;
  const canvasHeight = metrics.offsetY * 2 + metrics.cellSize * metrics.gridHeight;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!nodeStates) return;

  // Draw order matters: frontier under visited under path, so a node that
  // has progressed through multiple statuses always shows its most
  // "advanced" one on top. The current-node ring is drawn last, over
  // everything, since it marks a moment in time rather than a status.
  for (const [id, nodeState] of nodeStates) {
    if (nodeState.status === "frontier") {
      drawOverlayCell(ctx, grid, id, metrics, FRONTIER_FILL, FRONTIER_BORDER, true);
    }
  }
  for (const [id, nodeState] of nodeStates) {
    if (nodeState.status === "visited") {
      drawOverlayCell(ctx, grid, id, metrics, VISITED_FILL);
    }
  }
  for (const [id, nodeState] of nodeStates) {
    if (nodeState.status === "path") {
      drawOverlayCell(ctx, grid, id, metrics, PATH_FILL, PATH_BORDER);
    }
  }

  if (currentNodeId !== null) {
    drawCurrentNodeRing(ctx, grid, currentNodeId, metrics);
  }
}

function drawOverlayCell(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  id: NodeId,
  metrics: CellMetrics,
  fill: string,
  border?: string,
  dashedBorder = false,
): void {
  const { row, col } = grid.coordOf(id);
  const { x, y } = gridToPixel(row, col, metrics);
  const size = metrics.cellSize;

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, size, size);

  if (border) {
    ctx.save();
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(1, size * 0.08);
    if (dashedBorder) ctx.setLineDash([Math.max(2, size * 0.15), Math.max(2, size * 0.1)]);
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.restore();
  }
}

function drawCurrentNodeRing(ctx: CanvasRenderingContext2D, grid: Grid, id: NodeId, metrics: CellMetrics): void {
  const { row, col } = grid.coordOf(id);
  const { x, y } = gridToPixel(row, col, metrics);
  const size = metrics.cellSize;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size * 0.4;

  ctx.save();
  ctx.strokeStyle = CURRENT_NODE_RING;
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
