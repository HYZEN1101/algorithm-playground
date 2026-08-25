import type { NodeId } from "../../types/shared";
import { neighborsOf } from "../shared/neighbors";
import { PriorityQueue } from "../shared/priorityQueue";
import { reconstructPath, computePathMetrics } from "../shared/pathReconstruction";
import type { AlgorithmEvent, NodeState, PathfindingInput, PathfindingResult } from "./types";

/**
 * Dijkstra's algorithm on weighted terrain (Grid.costOf per cell). Uses a
 * lazy-deletion priority queue: a node may be pushed more than once (once
 * per relaxation that improves its distance), and stale entries are
 * skipped when popped by checking `settled` — simpler and just as correct
 * as a decrease-key heap, at the cost of the queue sometimes holding more
 * entries than there are nodes. Fine at this grid scale (ARCHITECTURE.md
 * §16's 200x200 stress target).
 *
 * Event semantics: ADD_TO_FRONTIER fires exactly once per node — the first
 * time it's discovered — even though UPDATE_DISTANCE/SET_PARENT can fire
 * again later if a cheaper route to it is found before it's settled. This
 * matches the conceptual meaning of "in the open set" (true continuously
 * from first discovery until settled), not "was just pushed to the heap"
 * (which could be misleading if it fired on every relaxation).
 */
export function dijkstra(input: PathfindingInput): PathfindingResult {
  const { grid, start, goal } = input;
  const startTime = performance.now();

  const events: AlgorithmEvent[] = [];
  const finalNodeState = new Map<NodeId, NodeState>();

  // Blocked start/blocked goal: same documented decision as BFS/DFS —
  // immediate "no path", never silently relocated. See bfs.ts's comment
  // for the full reasoning.
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
    finalNodeState.set(start, { status: "path", distance: 0 });
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
  const dist = new Map<NodeId, number>([[start, 0]]);
  const settled = new Set<NodeId>();
  const discovered = new Set<NodeId>([start]); // first-discovery guard for ADD_TO_FRONTIER, see doc comment above

  const pq = new PriorityQueue<NodeId>();
  pq.push(start, 0);
  events.push({ type: "ADD_TO_FRONTIER", nodeId: start });
  finalNodeState.set(start, { status: "frontier", distance: 0 });

  let found = false;
  let nodesExplored = 0;

  while (!pq.isEmpty()) {
    const current = pq.pop() as NodeId;
    if (settled.has(current)) continue; // stale lazy-deletion entry

    settled.add(current);
    events.push({ type: "REMOVE_FROM_FRONTIER", nodeId: current });
    events.push({ type: "VISIT_NODE", nodeId: current });
    nodesExplored++;
    finalNodeState.set(current, {
      status: "visited",
      distance: dist.get(current),
      parent: parent.get(current),
    });

    if (current === goal) {
      found = true;
      events.push({ type: "FOUND_GOAL", nodeId: current });
      break;
    }

    const currentDist = dist.get(current) ?? 0;
    for (const neighbor of neighborsOf(grid, current)) {
      if (settled.has(neighbor)) continue;

      const tentative = currentDist + grid.costOf(neighbor);
      const existing = dist.get(neighbor);
      if (existing !== undefined && tentative >= existing) continue; // no improvement

      dist.set(neighbor, tentative);
      parent.set(neighbor, current);
      events.push({ type: "SET_PARENT", nodeId: neighbor, parentId: current });
      events.push({ type: "UPDATE_DISTANCE", nodeId: neighbor, distance: tentative });

      if (!discovered.has(neighbor)) {
        discovered.add(neighbor);
        events.push({ type: "ADD_TO_FRONTIER", nodeId: neighbor });
      }
      finalNodeState.set(neighbor, { status: "frontier", distance: tentative, parent: current });

      pq.push(neighbor, tentative);
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
