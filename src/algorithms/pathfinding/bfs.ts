import type { NodeId } from "../../types/shared";
import { neighborsOf } from "../shared/neighbors";
import { reconstructPath, computePathMetrics } from "../shared/pathReconstruction";
import type { AlgorithmEvent, NodeState, PathfindingInput, PathfindingResult } from "./types";

/**
 * Breadth-first search on an unweighted grid (uniform cost per move,
 * regardless of terrain — BFS does not consult Grid.costOf() for its
 * traversal decisions, only for reporting pathCost afterward, which will
 * equal pathLength on any grid since every step costs 1 in BFS's own
 * accounting). Guaranteed shortest path by number of steps.
 */
export function bfs(input: PathfindingInput): PathfindingResult {
  const { grid, start, goal } = input;
  const startTime = performance.now();

  const events: AlgorithmEvent[] = [];
  const finalNodeState = new Map<NodeId, NodeState>();

  // Blocked start/blocked goal (documented decision, per this phase's
  // required test cases): treated as an immediate "no path" result. The
  // start/goal are NEVER silently relocated to a nearby passable cell by
  // the algorithm itself — worldStore already guarantees passable start/
  // goal for anything reachable through the UI (Phase 2's snap-back
  // behavior), so this case only matters for direct/hand-built test inputs,
  // and failing loudly (an empty, not-found result) is more honest than
  // silently moving the request.
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
  const discovered = new Set<NodeId>([start]); // dedupes frontier membership; added the moment a node is enqueued
  const distance = new Map<NodeId, number>([[start, 0]]);

  const queue: NodeId[] = [start];
  let queueHead = 0; // index-based dequeue avoids O(n) Array.shift() cost on large grids

  events.push({ type: "ADD_TO_FRONTIER", nodeId: start });
  // Emit the start node's own distance=0 explicitly (mirrors astar.ts's
  // UPDATE_SCORES-for-start behavior). Without this, deriveNodeStates
  // (Phase 5) would show the start node's distance as undefined at any
  // playback index before the algorithm's own VISIT_NODE event for it,
  // even though distance=0 is known from the very first instant.
  events.push({ type: "UPDATE_DISTANCE", nodeId: start, distance: 0 });
  finalNodeState.set(start, { status: "frontier", distance: 0 });

  let found = false;
  let nodesExplored = 0;

  while (queueHead < queue.length) {
    const current = queue[queueHead++];
    events.push({ type: "REMOVE_FROM_FRONTIER", nodeId: current });
    events.push({ type: "VISIT_NODE", nodeId: current });
    nodesExplored++;
    finalNodeState.set(current, {
      status: "visited",
      distance: distance.get(current),
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
      const neighborDistance = (distance.get(current) ?? 0) + 1;
      distance.set(neighbor, neighborDistance);

      events.push({ type: "SET_PARENT", nodeId: neighbor, parentId: current });
      events.push({ type: "UPDATE_DISTANCE", nodeId: neighbor, distance: neighborDistance });
      events.push({ type: "ADD_TO_FRONTIER", nodeId: neighbor });
      finalNodeState.set(neighbor, { status: "frontier", distance: neighborDistance, parent: current });

      queue.push(neighbor);
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
