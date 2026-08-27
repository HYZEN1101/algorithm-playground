import type { NodeId } from "../types/shared";
import type { AlgorithmEvent, NodeState } from "../algorithms/pathfinding/types";

/**
 * Pure reducer: replays events[0..upToIndex) into a Map<NodeId, NodeState>.
 * This is THE mechanism that makes step-back/scrubbing/Inspector-at-any-
 * index possible without re-running the algorithm (ARCHITECTURE.md §6).
 *
 * Nodes never touched by any event up to this point are simply absent from
 * the returned map — callers treat "absent" as status "unexplored", the
 * same convention `finalNodeState` already uses.
 *
 * `order` (DFS's discovery-order field) is NOT carried by any AlgorithmEvent
 * — DFS's dfs.ts sets it directly on finalNodeState with no dedicated event
 * type for it (a real gap surfaced while building this reducer: replaying
 * events alone cannot recover it any other way). It turns out `order` is
 * always exactly "the Nth VISIT_NODE event processed so far" (0-indexed),
 * which is recoverable purely by counting VISIT_NODE events during the
 * replay — no changes needed to dfs.ts or to AlgorithmEvent's shape. This
 * reducer sets `order` on every VISIT_NODE for every algorithm, not just
 * DFS; it's a harmless extra field for BFS/Dijkstra/A* (matching
 * ARCHITECTURE.md's "no meaningless fields displayed" rule is the
 * Inspector's job in Phase 6, which reads only the fields its per-algorithm
 * descriptor lists — not this reducer's).
 */
/** Reads a node's current entry, defaulting status to "unexplored" if this
 * is the first event ever seen for it (e.g. a hand-built event sequence
 * that updates distance/parent before any ADD_TO_FRONTIER — never happens
 * from the real algorithms, but keeps this reducer total rather than
 * assuming event ordering it doesn't otherwise enforce). */
function ensureEntry(states: Map<NodeId, NodeState>, nodeId: NodeId): NodeState {
  return states.get(nodeId) ?? { status: "unexplored" };
}

export function deriveNodeStates(events: AlgorithmEvent[], upToIndex: number): Map<NodeId, NodeState> {
  const states = new Map<NodeId, NodeState>();
  const end = Math.max(0, Math.min(upToIndex, events.length));
  let visitCount = 0;

  for (let i = 0; i < end; i++) {
    const event = events[i];

    switch (event.type) {
      case "ADD_TO_FRONTIER": {
        const existing = states.get(event.nodeId);
        // Never downgrade an already-visited/path node back to "frontier"
        // — ADD_TO_FRONTIER only fires once, on first discovery
        // (ARCHITECTURE.md's documented Phase 4 event semantics), so this
        // guard is defensive, not load-bearing, but keeps the reducer
        // correct even if that invariant were ever relaxed.
        if (existing?.status === "visited" || existing?.status === "path") break;
        states.set(event.nodeId, { ...existing, status: "frontier" });
        break;
      }

      case "REMOVE_FROM_FRONTIER": {
        // No status change here — every algorithm emits VISIT_NODE
        // immediately after REMOVE_FROM_FRONTIER for the same node, and
        // that's what actually transitions status to "visited". Leaving
        // this as a no-op keeps the reducer a straightforward mirror of
        // each event's own documented meaning (ARCHITECTURE.md §5) rather
        // than inferring behavior from event *ordering* assumptions.
        break;
      }

      case "VISIT_NODE": {
        const existing = states.get(event.nodeId);
        const order = visitCount;
        visitCount++;
        states.set(event.nodeId, { ...existing, status: "visited", order });
        break;
      }

      case "UPDATE_DISTANCE": {
        const existing = ensureEntry(states, event.nodeId);
        states.set(event.nodeId, { ...existing, distance: event.distance });
        break;
      }

      case "UPDATE_SCORES": {
        const existing = ensureEntry(states, event.nodeId);
        states.set(event.nodeId, { ...existing, g: event.g, h: event.h, f: event.f });
        break;
      }

      case "SET_PARENT": {
        const existing = ensureEntry(states, event.nodeId);
        states.set(event.nodeId, { ...existing, parent: event.parentId });
        break;
      }

      case "BUILD_PATH": {
        const existing = states.get(event.nodeId);
        states.set(event.nodeId, { ...existing, status: "path" });
        break;
      }

      case "FOUND_GOAL":
      case "COMPLETE":
        // Carry no per-node state of their own; they exist for the
        // renderer/UI to know "the goal was reached"/"the run is over" as
        // moments in the timeline, not as node attributes.
        break;
    }
  }

  return states;
}

/**
 * Finds the "current node" at a given playback index — the node whose
 * VISIT_NODE event is the most recent one at or before `upToIndex`. Used
 * by the renderer to draw a distinct current-node highlight (guideline
 * §14: "current node pulses"). Returns null before the first VISIT_NODE
 * event or once the timeline has run past the last event with nothing
 * left to highlight distinctly (still returns the last-visited node in
 * that case — there's always a "most recently visited" node once any
 * VISIT_NODE has occurred).
 */
export function findCurrentNode(events: AlgorithmEvent[], upToIndex: number): NodeId | null {
  const end = Math.max(0, Math.min(upToIndex, events.length));
  for (let i = end - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "VISIT_NODE") return event.nodeId;
  }
  return null;
}
