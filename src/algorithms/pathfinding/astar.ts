import type { NodeId } from "../../types/shared";
import { neighborsOf } from "../shared/neighbors";
import { PriorityQueue } from "../shared/priorityQueue";
import { reconstructPath, computePathMetrics } from "../shared/pathReconstruction";
import { manhattanDistance } from "./heuristics";
import type { AlgorithmEvent, NodeState, PathfindingInput, PathfindingResult } from "./types";

/**
 * A* on weighted terrain. Same lazy-deletion priority queue and
 * ADD_TO_FRONTIER-fires-once-on-first-discovery semantics as dijkstra.ts —
 * see that file's doc comment for the reasoning, which applies identically
 * here.
 *
 * MVP heuristic scope (amendment, logged in HANDOFF.md): always Manhattan,
 * regardless of `input.heuristic`. That field exists on PathfindingInput
 * for future-facing type compatibility (Euclidean/Chebyshev become
 * meaningful once diagonal movement exists) but is NOT consulted here —
 * there is no heuristic choice to make in the MVP, not "Manhattan as a
 * default among options."
 *
 * Admissibility: Manhattan distance never overestimates true remaining
 * cost on this 4-directional grid, because the cheapest possible terrain
 * (Road) costs 1 per step and Manhattan distance is exactly the minimum
 * number of steps ignoring walls/terrain — so true cost >= Manhattan
 * distance * 1 always holds. Spot-checked against a known small grid in
 * astar.test.ts, not just asserted here.
 */
export function astar(input: PathfindingInput): PathfindingResult {
  const { grid, start, goal } = input;
  const startTime = performance.now();

  const events: AlgorithmEvent[] = [];
  const finalNodeState = new Map<NodeId, NodeState>();

  // Blocked start/blocked goal: same documented decision as the other
  // three algorithms — immediate "no path", never silently relocated.
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
    finalNodeState.set(start, { status: "path", g: 0, h: 0, f: 0 });
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

  const goalCoord = grid.coordOf(goal);
  const heuristic = (id: NodeId) => manhattanDistance(grid.coordOf(id), goalCoord);

  const parent = new Map<NodeId, NodeId>();
  const gScore = new Map<NodeId, number>([[start, 0]]);
  const settled = new Set<NodeId>();
  const discovered = new Set<NodeId>([start]);

  const pq = new PriorityQueue<NodeId>();
  const startH = heuristic(start);
  pq.push(start, startH); // f = g(0) + h
  events.push({ type: "ADD_TO_FRONTIER", nodeId: start });
  events.push({ type: "UPDATE_SCORES", nodeId: start, g: 0, h: startH, f: startH });
  finalNodeState.set(start, { status: "frontier", g: 0, h: startH, f: startH });

  let found = false;
  let nodesExplored = 0;

  while (!pq.isEmpty()) {
    const current = pq.pop() as NodeId;
    if (settled.has(current)) continue; // stale lazy-deletion entry

    settled.add(current);
    const currentG = gScore.get(current) ?? 0;
    const currentH = heuristic(current);
    events.push({ type: "REMOVE_FROM_FRONTIER", nodeId: current });
    events.push({ type: "VISIT_NODE", nodeId: current });
    nodesExplored++;
    finalNodeState.set(current, {
      status: "visited",
      g: currentG,
      h: currentH,
      f: currentG + currentH,
      parent: parent.get(current),
    });

    if (current === goal) {
      found = true;
      events.push({ type: "FOUND_GOAL", nodeId: current });
      break;
    }

    for (const neighbor of neighborsOf(grid, current)) {
      if (settled.has(neighbor)) continue;

      const tentativeG = currentG + grid.costOf(neighbor);
      const existingG = gScore.get(neighbor);
      if (existingG !== undefined && tentativeG >= existingG) continue; // no improvement

      gScore.set(neighbor, tentativeG);
      parent.set(neighbor, current);
      const h = heuristic(neighbor);
      const f = tentativeG + h;

      events.push({ type: "SET_PARENT", nodeId: neighbor, parentId: current });
      events.push({ type: "UPDATE_SCORES", nodeId: neighbor, g: tentativeG, h, f });

      if (!discovered.has(neighbor)) {
        discovered.add(neighbor);
        events.push({ type: "ADD_TO_FRONTIER", nodeId: neighbor });
      }
      finalNodeState.set(neighbor, { status: "frontier", g: tentativeG, h, f, parent: current });

      pq.push(neighbor, f);
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
