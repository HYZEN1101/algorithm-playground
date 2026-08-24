import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";

/**
 * Centralizes the MVP's "diagonals always false" decision in one place
 * (ARCHITECTURE.md §4/§5), so bfs.ts/dfs.ts/dijkstra.ts/astar.ts never need
 * to know or repeat that detail — they just call neighborsOf(grid, id).
 * Grid.neighbors() already does the actual bounds/passability filtering;
 * this wrapper adds nothing beyond pinning that one argument.
 */
export function neighborsOf(grid: Grid, id: NodeId): NodeId[] {
  return grid.neighbors(id, false);
}
