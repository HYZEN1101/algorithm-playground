import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { NodeState } from "../../algorithms/pathfinding/types";
import type { CellMetrics } from "../coordinates";
import { gridToPixel } from "../coordinates";

/**
 * ============================== TEMPORARY ==============================
 * This renders the algorithm result as a static, all-at-once overlay from
 * PathfindingResult.finalNodeState — the whole visited set and final path
 * appear instantly on "Run", nothing is animated or steppable. This is
 * intentional for Phase 3 (see PHASE_3_BFS_DFS.md: "not animated — that's
 * Phase 5").
 *
 * Phase 5 replaces the DATA SOURCE this reads from — instead of a single
 * static `finalNodeState` snapshot, it'll call
 * `deriveNodeStates(events, currentPlaybackIndex)` on every playback tick —
 * but the actual per-cell drawing primitives below (drawOverlayCell) can
 * likely be reused as-is, since they already take a plain
 * `Map<NodeId, NodeState>` and don't know or care whether it came from a
 * static result or a playback-index reduction. Do not build any event-
 * index/play/pause/step logic here — that belongs entirely to Phase 5's
 * PlaybackController + playbackStore, not to this file.
 * =========================================================================
 */

// Deliberately simple, placeholder styling — real visual language
// (diagonal-hatch path fill, frontier dashed borders, etc., per
// ARCHITECTURE.md §8) is a later-phase concern (visual polish is
// explicitly Phase 8's job; non-color-only accessibility encoding for
// algorithm state specifically is part of Phase 7). This just needs to be
// legible enough to "eyeball correctness" per this phase's own acceptance
// criteria.
const VISITED_FILL = "rgba(76, 110, 245, 0.35)";
const PATH_FILL = "rgba(240, 173, 78, 0.75)";
const PATH_BORDER = "rgba(120, 74, 6, 0.9)";

export function drawPathOverlay(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  metrics: CellMetrics,
  finalNodeState: Map<NodeId, NodeState> | null,
): void {
  const canvasWidth = metrics.offsetX * 2 + metrics.cellSize * metrics.gridWidth;
  const canvasHeight = metrics.offsetY * 2 + metrics.cellSize * metrics.gridHeight;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!finalNodeState) return;

  // Visited cells drawn first, so path cells layer visually on top.
  for (const [id, nodeState] of finalNodeState) {
    if (nodeState.status === "visited") {
      drawOverlayCell(ctx, grid, id, metrics, VISITED_FILL);
    }
  }
  for (const [id, nodeState] of finalNodeState) {
    if (nodeState.status === "path") {
      drawOverlayCell(ctx, grid, id, metrics, PATH_FILL, PATH_BORDER);
    }
  }
}

function drawOverlayCell(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  id: NodeId,
  metrics: CellMetrics,
  fill: string,
  border?: string,
): void {
  const { row, col } = grid.coordOf(id);
  const { x, y } = gridToPixel(row, col, metrics);
  const size = metrics.cellSize;

  ctx.fillStyle = fill;
  ctx.fillRect(x, y, size, size);

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  }
}
