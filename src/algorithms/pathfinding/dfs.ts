import type { NodeId } from "../../types/shared";
import { neighborsOf } from "../shared/neighbors";
import { reconstructPath, computePathMetrics } from "../shared/pathReconstruction";
import type { AlgorithmEvent, NodeState, PathfindingInput, PathfindingResult } from "./types";

/**
 * Depth-first search on the grid. Finds *a* valid path, never claimed or
 * labeled as shortest anywhere (guideline requirement — DFS's UI framing
 * must never say "shortest path"; enforced at the UI layer once
 * AlgorithmPicker/results text exist, not here, but noted since this is
 * where the behavior originates). Iterative (explicit stack), not
 * recursive — a 200x200 grid can have up to 40,000 nodes, well past a
 * comfortable native recursion depth in most JS engines.
 *
 * Traversal order follows Grid.neighbors' fixed direction order (up, down,
 * left, right — see world/grid.ts's NEIGHBOR_DELTAS_4), which is what gives
 * DFS its characteristic directional bias and demonstrably-non-shortest
 * paths on suitable maps (see dfs.test.ts's "longer than BFS" case).
 */
export function dfs(input: PathfindingInput): PathfindingResult {
  const { grid, start, goal } = input;
  const startTime = performance.now();

  const events: AlgorithmEvent[] = [];
  const finalNodeState = new Map<NodeId, NodeState>();

  // Blocked start/blocked goal: same documented decision as BFS — immediate
  // "no path", never silently relocated. See bfs.ts's comment for the full
  // reasoning.
  if (!grid.isPassable(start) || !grid.isPassable(goal)) {
    events.push({ type: "COMPLETE" });
    return {
      pathFound: false,
      path: [],
      pathLength: 0,
      pathCost: 0,
      nodesExplored: 0,
      events,
      finalNodeState,
      executionTimeMs: performance.now() - startTime,
    };
  }

  if (start === goal) {
    events.push({ type: "VISIT_NODE", nodeId: start });
    events.push({ type: "FOUND_GOAL", nodeId: start });
    events.push({ type: "BUILD_PATH", nodeId: start });
    events.push({ type: "COMPLETE" });
    finalNodeState.set(start, { status: "path", order: 0 });
    return {
      pathFound: true,
      path: [start],
      pathLength: 0,
      pathCost: 0,
      nodesExplored: 1,
      events,
      finalNodeState,
      executionTimeMs: performance.now() - startTime,
    };
  }

  const parent = new Map<NodeId, NodeId>();
  // A node is added to `discovered` the moment it's pushed onto the stack,
  // preventing duplicate stack entries for the same cell (same dedup
  // strategy as bfs.ts, just applied to a stack instead of a queue).
  const discovered = new Set<NodeId>([start]);

  const stack: NodeId[] = [start];
  events.push({ type: "ADD_TO_FRONTIER", nodeId: start });
  finalNodeState.set(start, { status: "frontier" });

  let found = false;
  let nodesExplored = 0;
  let discoveryOrder = 0;

  while (stack.length > 0) {
    const current = stack.pop() as NodeId;
    events.push({ type: "REMOVE_FROM_FRONTIER", nodeId: current });
    events.push({ type: "VISIT_NODE", nodeId: current });
    const order = discoveryOrder++;
    nodesExplored++;
    finalNodeState.set(current, {
      status: "visited",
      order,
      parent: parent.get(current),
    });

    if (current === goal) {
      found = true;
      events.push({ type: "FOUND_GOAL", nodeId: current });
      break;
    }

    for (const neighbor of neighborsOf(grid, current)) {
      if (discovered.has(neighbor)) continue;
      discovered.add(neighbor);
      parent.set(neighbor, current);

      events.push({ type: "SET_PARENT", nodeId: neighbor, parentId: current });
      events.push({ type: "ADD_TO_FRONTIER", nodeId: neighbor });
      finalNodeState.set(neighbor, { status: "frontier", parent: current });

      stack.push(neighbor);
    }
  }

  let path: NodeId[] = [];
  if (found) {
    path = reconstructPath(parent, start, goal);
    for (const nodeId of path) {
      events.push({ type: "BUILD_PATH", nodeId });
      const existing = finalNodeState.get(nodeId);
      finalNodeState.set(nodeId, { ...existing, status: "path" } as NodeState);
    }
  }
  events.push({ type: "COMPLETE" });

  const { pathLength, pathCost } = computePathMetrics(path, (id) => grid.costOf(id));

  return {
    pathFound: found,
    path,
    pathLength,
    pathCost,
    nodesExplored,
    events,
    finalNodeState,
    executionTimeMs: performance.now() - startTime,
  };
}
