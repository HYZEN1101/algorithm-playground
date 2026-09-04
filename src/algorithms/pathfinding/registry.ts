import { bfs } from "./bfs";
import { dfs } from "./dfs";
import { dijkstra } from "./dijkstra";
import { astar } from "./astar";
import type { AlgorithmName, PathfindingAlgorithm } from "./types";

/**
 * Single source of truth for "which algorithms exist, what do we call
 * them, what function runs them." Extracted in Phase 9 — previously
 * AlgorithmPicker.tsx defined this map itself; ComparisonPanel.tsx needs
 * the identical map (same labels, same run functions, same iteration
 * order) and duplicating it would risk the two drifting apart.
 *
 * Lives under algorithms/ (not components/ or state/) since it only
 * describes algorithm code — no React, no rendering, no store. Iteration
 * order here is also the canonical UI order (bfs, dfs, dijkstra, astar)
 * used by both AlgorithmPicker and ComparisonPanel.
 */
export const ALGORITHM_REGISTRY: Record<AlgorithmName, { label: string; run: PathfindingAlgorithm }> = {
  bfs: { label: "BFS", run: bfs },
  dfs: { label: "DFS", run: dfs },
  dijkstra: { label: "Dijkstra", run: dijkstra },
  astar: { label: "A*", run: astar },
};

export const ALGORITHM_NAMES: AlgorithmName[] = Object.keys(ALGORITHM_REGISTRY) as AlgorithmName[];
