import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { NodeState } from "../../algorithms/pathfinding/types";
import type { AlgorithmName } from "../../state/runStore";
import { TerrainType } from "../../world/terrain";

/**
 * Context a field's `value` function can read from. Deliberately narrow —
 * just enough for every field below, not a grab-bag of "whatever might be
 * useful someday" (guideline §15: "do not display meaningless fields
 * simply to make inspectors look consistent").
 */
export interface FieldContext {
  nodeId: NodeId;
  /** undefined = this node has never been touched by any event (status "unexplored"). */
  nodeState: NodeState | undefined;
  grid: Grid;
}

export interface FieldDescriptor {
  /** Stable key for React list rendering; not shown to the user. */
  key: string;
  label: string;
  value: (ctx: FieldContext) => string;
}

const STATUS_LABELS: Record<NodeState["status"], string> = {
  unexplored: "Unexplored",
  frontier: "Frontier",
  visited: "Visited",
  path: "Path",
};

const TERRAIN_LABELS: Record<TerrainType, string> = {
  [TerrainType.Road]: "Road",
  [TerrainType.Grass]: "Grass",
  [TerrainType.Mud]: "Mud",
  [TerrainType.Water]: "Water",
  [TerrainType.Mountain]: "Mountain",
  [TerrainType.Wall]: "Wall",
};

const EMPTY = "—";

const statusField: FieldDescriptor = {
  key: "status",
  label: "State",
  value: ({ nodeState }) => STATUS_LABELS[nodeState?.status ?? "unexplored"],
};

const distanceField: FieldDescriptor = {
  key: "distance",
  label: "Distance",
  value: ({ nodeState }) => (nodeState?.distance !== undefined ? String(nodeState.distance) : EMPTY),
};

const discoveryOrderField: FieldDescriptor = {
  key: "order",
  label: "Discovery Order",
  value: ({ nodeState }) => (nodeState?.order !== undefined ? String(nodeState.order) : EMPTY),
};

const gScoreField: FieldDescriptor = {
  key: "g",
  label: "G Score",
  value: ({ nodeState }) => (nodeState?.g !== undefined ? String(nodeState.g) : EMPTY),
};

const hScoreField: FieldDescriptor = {
  key: "h",
  label: "H Score",
  value: ({ nodeState }) => (nodeState?.h !== undefined ? String(nodeState.h) : EMPTY),
};

const fScoreField: FieldDescriptor = {
  key: "f",
  label: "F Score",
  value: ({ nodeState }) => (nodeState?.f !== undefined ? String(nodeState.f) : EMPTY),
};

const parentField: FieldDescriptor = {
  key: "parent",
  label: "Parent",
  value: ({ nodeState, grid }) => {
    if (nodeState?.parent === undefined) return EMPTY;
    const { row, col } = grid.coordOf(nodeState.parent);
    return `(${row}, ${col})`;
  },
};

const terrainField: FieldDescriptor = {
  key: "terrain",
  label: "Terrain",
  value: ({ nodeId, grid }) => TERRAIN_LABELS[grid.terrainAt(nodeId)],
};

const neighborCountField: FieldDescriptor = {
  key: "neighborCount",
  label: "Neighbors",
  // MVP is 4-directional only (per the movement-scope amendment) — always
  // pass diagonals=false, matching every algorithm's own neighbor calls.
  value: ({ nodeId, grid }) => String(grid.neighbors(nodeId, false).length),
};

/**
 * Per-algorithm field sets, exactly per ARCHITECTURE.md §11:
 *   BFS: status, distance, parent, terrain, neighbor count
 *   DFS: status, discovery order, parent, terrain, neighbor count
 *   Dijkstra: status, distance, parent, terrain, neighbor count
 *   A*: status, g, h, f, parent, terrain, neighbor count
 * DFS never shows "distance" (it doesn't track it); BFS/Dijkstra never
 * show g/h/f (A*-only fields) — this is what keeps the Inspector from
 * showing meaningless fields per algorithm, without any branching logic
 * living inside NodeInspector.tsx itself.
 */
const FIELD_DESCRIPTORS: Record<AlgorithmName, FieldDescriptor[]> = {
  bfs: [statusField, distanceField, parentField, terrainField, neighborCountField],
  dfs: [statusField, discoveryOrderField, parentField, terrainField, neighborCountField],
  dijkstra: [statusField, distanceField, parentField, terrainField, neighborCountField],
  astar: [statusField, gScoreField, hScoreField, fScoreField, parentField, terrainField, neighborCountField],
};

export function getFieldDescriptors(algorithm: AlgorithmName): FieldDescriptor[] {
  return FIELD_DESCRIPTORS[algorithm];
}
