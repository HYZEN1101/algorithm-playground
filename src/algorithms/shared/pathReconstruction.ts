import type { NodeId } from "../../types/shared";

/**
 * Extracted from bfs.ts/dfs.ts (Phase 3) now that dijkstra.ts/astar.ts
 * (Phase 4) need the identical logic — a third and fourth consumer of the
 * same ~10-line function is duplication, not premature abstraction, so
 * this now lives in shared/ alongside neighbors.ts and priorityQueue.ts
 * for the same reason.
 */
export function reconstructPath(parent: Map<NodeId, NodeId>, start: NodeId, goal: NodeId): NodeId[] {
  const path: NodeId[] = [goal];
  let current = goal;
  while (current !== start) {
    const prev = parent.get(current);
    if (prev === undefined) break; // defensive; shouldn't happen when goal was actually found
    path.push(prev);
    current = prev;
  }
  path.reverse();
  return path;
}

/**
 * pathLength vs path.length — documented decision (originally made in
 * bfs.ts, ARCHITECTURE.md §5's own comment describes pathLength as "number
 * of cells in path", but Phase 3's required test cases explicitly state
 * start==goal must produce `pathLength === 0` even though `path = [start]`
 * (one cell). Those two statements conflict for the start==goal case
 * specifically. Resolved in favor of the explicit test requirement:
 * pathLength counts STEPS (edges traversed), i.e. `max(0, path.length -
 * 1)`, not raw cell count. This also makes pathLength and pathCost
 * consistent with each other (both count "cost of moving", not "cells
 * occupied") and generalizes correctly for every other case (a 2-cell path
 * is 1 step, matching intuition). Applies identically to all four
 * algorithms — this is a PathfindingResult-level convention, not an
 * algorithm-specific choice.
 */
export function computePathMetrics(
  path: NodeId[],
  costOf: (id: NodeId) => number,
): { pathLength: number; pathCost: number } {
  const pathLength = Math.max(0, path.length - 1);
  let pathCost = 0;
  for (let i = 1; i < path.length; i++) {
    pathCost += costOf(path[i]);
  }
  return { pathLength, pathCost };
}
