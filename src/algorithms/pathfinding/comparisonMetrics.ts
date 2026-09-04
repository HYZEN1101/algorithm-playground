import type { AlgorithmName, PathfindingResult } from "./types";

/**
 * One row of the Comparison Mode table. Pure data — no rendering, no
 * React — so it's independently testable per ARCHITECTURE.md §14.
 */
export interface ComparisonRow {
  algorithm: AlgorithmName;
  pathFound: boolean;
  nodesExplored: number;
  pathLength: number;
  pathCost: number;
  /** True iff pathFound and pathCost equals the minimum cost among all pathFound rows this run. */
  isOptimal: boolean;
}

/**
 * Builds one row per algorithm that has a result, grouping "optimal" by
 * pathCost (not pathLength — guideline §8: cost and length are not
 * interchangeable once weighted terrain is involved). Deliberately does
 * NOT hardcode which algorithms can be optimal — if DFS's cost happens to
 * tie the minimum on a given map (e.g. a trivial map with only one
 * possible path), it is honestly reported as optimal too. Rows are
 * returned in ALGORITHM_NAMES order (bfs, dfs, dijkstra, astar) via the
 * order results were provided, not re-sorted by cost.
 */
export function buildComparisonRows(results: Partial<Record<AlgorithmName, PathfindingResult>>): ComparisonRow[] {
  const entries = Object.entries(results) as [AlgorithmName, PathfindingResult][];

  const foundCosts = entries.filter(([, r]) => r.pathFound).map(([, r]) => r.pathCost);
  const minCost = foundCosts.length > 0 ? Math.min(...foundCosts) : null;

  return entries.map(([algorithm, result]) => ({
    algorithm,
    pathFound: result.pathFound,
    nodesExplored: result.nodesExplored,
    pathLength: result.pathLength,
    pathCost: result.pathCost,
    isOptimal: result.pathFound && minCost !== null && result.pathCost === minCost,
  }));
}

/**
 * Among the optimal rows (isOptimal === true), returns the one with the
 * fewest nodesExplored — the "A* usually wins" demonstration, computed
 * honestly rather than assumed. Returns null if no row found a path at
 * all (guideline §37: don't silently divide by zero / assume a winner
 * that doesn't exist).
 */
export function findMostEfficientOptimal(rows: ComparisonRow[]): ComparisonRow | null {
  const optimalRows = rows.filter((r) => r.isOptimal);
  if (optimalRows.length === 0) return null;

  return optimalRows.reduce((best, row) => (row.nodesExplored < best.nodesExplored ? row : best));
}
