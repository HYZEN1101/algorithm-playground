import type { Grid } from "../world/grid";
import type { NodeId } from "../types/shared";
import type { AlgorithmName } from "../algorithms/pathfinding/types";
import { ALGORITHM_REGISTRY } from "../algorithms/pathfinding/registry";

/**
 * One ghost's move for a single replan tick. Re-runs the ghost's
 * algorithm FRESH, from its current position to the player's CURRENT
 * position, then takes the first step of that freshly computed path —
 * genuine re-planning every tick against a moving goal, not a cached
 * pursuit route. No changes to any algorithm itself (guideline §20):
 * this just calls the same `ALGORITHM_REGISTRY[name].run(...)` Phase 9/10
 * already use, repeatedly.
 *
 * Returns the ghost's unchanged position if it's already on the player's
 * cell (nothing to do — catch detection is the caller's job) or if no
 * path exists at all (fully walled off) — never throws, never picks an
 * arbitrary fallback move.
 */
export function computeGhostStep(grid: Grid, ghostPos: NodeId, playerPos: NodeId, algorithm: AlgorithmName): NodeId {
  if (ghostPos === playerPos) return ghostPos;

  const { run } = ALGORITHM_REGISTRY[algorithm];
  const result = run({ grid, start: ghostPos, goal: playerPos, diagonals: false });

  if (result.pathFound && result.path.length > 1) {
    return result.path[1];
  }

  return ghostPos;
}

export type Direction = "up" | "down" | "left" | "right";

const DIRECTION_DELTA: Record<Direction, { dRow: number; dCol: number }> = {
  up: { dRow: -1, dCol: 0 },
  down: { dRow: 1, dCol: 0 },
  left: { dRow: 0, dCol: -1 },
  right: { dRow: 0, dCol: 1 },
};

/**
 * Attempts to move the player one cell in the given direction. Returns
 * the player's UNCHANGED position if the move is blocked (out of bounds
 * or a Wall) — mirrors the existing "snap back" convention used
 * elsewhere in this project (worldStore's drag-start/goal behavior)
 * rather than throwing or silently doing nothing distinguishably from a
 * successful no-op move.
 */
export function computePlayerMove(grid: Grid, playerPos: NodeId, direction: Direction): NodeId {
  const { row, col } = grid.coordOf(playerPos);
  const { dRow, dCol } = DIRECTION_DELTA[direction];
  const newRow = row + dRow;
  const newCol = col + dCol;

  if (!grid.inBounds(newRow, newCol)) return playerPos;

  const newId = grid.idOf(newRow, newCol);
  if (!grid.isPassable(newId)) return playerPos;

  return newId;
}
