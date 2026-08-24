import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";

/**
 * MVP: only "manhattan" is ever selectable in any UI (per the movement/
 * heuristic scope amendment logged in HANDOFF.md). This type exists now,
 * ahead of Phase 4, purely so PathfindingInput's shape matches
 * ARCHITECTURE.md §5 exactly — no heuristic logic is implemented in Phase
 * 3, and BFS/DFS both ignore this field entirely (it's meaningful for A*
 * only, which doesn't exist until Phase 4).
 */
export type HeuristicName = "manhattan" | "euclidean" | "chebyshev";

export interface PathfindingInput {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
  diagonals: boolean; // MVP: always false. BFS/DFS never read this — see algorithms/shared/neighbors.ts.
  heuristic?: HeuristicName; // A* only (Phase 4), ignored by BFS/DFS.
}

/**
 * Event architecture rule (load-bearing, ARCHITECTURE.md §5): every variant
 * here describes a computational state transition, never a rendering
 * instruction. No MAKE_NODE_BLUE, no MOVE_GLOWING_DOT — color/pulsing/glow
 * are entirely the rendering layer's job, derived from these events.
 */
export type AlgorithmEvent =
  | { type: "ADD_TO_FRONTIER"; nodeId: NodeId }
  | { type: "REMOVE_FROM_FRONTIER"; nodeId: NodeId }
  | { type: "VISIT_NODE"; nodeId: NodeId }
  | { type: "UPDATE_DISTANCE"; nodeId: NodeId; distance: number } // BFS, Dijkstra
  | { type: "UPDATE_SCORES"; nodeId: NodeId; g: number; h: number; f: number } // A* only
  | { type: "SET_PARENT"; nodeId: NodeId; parentId: NodeId }
  | { type: "FOUND_GOAL"; nodeId: NodeId }
  | { type: "BUILD_PATH"; nodeId: NodeId } // one event per node, emitted in path order
  | { type: "COMPLETE" };

/**
 * Per-algorithm field usage (ARCHITECTURE.md §11, confirmed in this phase's
 * acceptance criteria): BFS uses distance + parent; DFS uses order + parent
 * (never distance — DFS doesn't track it); A-star and Dijkstra come in
 * Phase 4.
 */
export interface NodeState {
  status: "unexplored" | "frontier" | "visited" | "path";
  distance?: number; // BFS/Dijkstra
  g?: number;
  h?: number;
  f?: number; // A*
  parent?: NodeId;
  order?: number; // DFS: discovery order
}

export interface PathfindingResult {
  pathFound: boolean;
  path: NodeId[]; // empty if no path
  pathLength: number; // number of STEPS/edges in the path (see bfs.ts's doc comment for why this isn't path.length)
  pathCost: number; // sum of terrain costs entered along the path; equals pathLength on uniform-cost grids
  nodesExplored: number; // number of nodes actually visited/expanded (VISIT_NODE count), not merely discovered
  events: AlgorithmEvent[];
  finalNodeState: Map<NodeId, NodeState>;
  executionTimeMs: number; // wall-clock of the algorithm call — "browser timing", not an algorithmic complexity measure
}

export type PathfindingAlgorithm = (input: PathfindingInput) => PathfindingResult;
