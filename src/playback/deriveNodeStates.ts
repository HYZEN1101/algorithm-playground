import type { NodeId } from "../types/shared";
import type { AlgorithmEvent, NodeState } from "../algorithms/pathfinding/types";

/** Reads a node's current entry, defaulting status to "unexplored" if this
 * is the first event ever seen for it (e.g. a hand-built event sequence
 * that updates distance/parent before any ADD_TO_FRONTIER — never happens
 * from the real algorithms, but keeps this reducer total rather than
 * assuming event ordering it doesn't otherwise enforce). */
function ensureEntry(states: Map<NodeId, NodeState>, nodeId: NodeId): NodeState {
  return states.get(nodeId) ?? { status: "unexplored" };
}

/**
 * Applies a single event to `states` in place. Shared by both the pure
 * `deriveNodeStates` (always replays from 0) and
 * `createIncrementalNodeStateDeriver` (replays only the delta since the
 * last call) below, so the two can never drift apart in behavior.
 * `visitCounter` is a mutable `{ count }` box rather than a plain number
 * so callers can persist it across many `applyEvent` calls without this
 * function needing to return anything.
 */
function applyEvent(states: Map<NodeId, NodeState>, event: AlgorithmEvent, visitCounter: { count: number }): void {
  switch (event.type) {
    case "ADD_TO_FRONTIER": {
      const existing = states.get(event.nodeId);
      // Never downgrade an already-visited/path node back to "frontier"
      // — ADD_TO_FRONTIER only fires once, on first discovery
      // (ARCHITECTURE.md's documented Phase 4 event semantics), so this
      // guard is defensive, not load-bearing, but keeps the reducer
      // correct even if that invariant were ever relaxed.
      if (existing?.status === "visited" || existing?.status === "path") return;
      states.set(event.nodeId, { ...existing, status: "frontier" });
      return;
    }

    case "REMOVE_FROM_FRONTIER":
      // No status change here — every algorithm emits VISIT_NODE
      // immediately after REMOVE_FROM_FRONTIER for the same node, and
      // that's what actually transitions status to "visited". Leaving
      // this as a no-op keeps the reducer a straightforward mirror of
      // each event's own documented meaning (ARCHITECTURE.md §5) rather
      // than inferring behavior from event *ordering* assumptions.
      return;

    case "VISIT_NODE": {
      const existing = states.get(event.nodeId);
      const order = visitCounter.count;
      visitCounter.count++;
      states.set(event.nodeId, { ...existing, status: "visited", order });
      return;
    }

    case "UPDATE_DISTANCE": {
      const existing = ensureEntry(states, event.nodeId);
      states.set(event.nodeId, { ...existing, distance: event.distance });
      return;
    }

    case "UPDATE_SCORES": {
      const existing = ensureEntry(states, event.nodeId);
      states.set(event.nodeId, { ...existing, g: event.g, h: event.h, f: event.f });
      return;
    }

    case "SET_PARENT": {
      const existing = ensureEntry(states, event.nodeId);
      states.set(event.nodeId, { ...existing, parent: event.parentId });
      return;
    }

    case "BUILD_PATH": {
      const existing = states.get(event.nodeId);
      states.set(event.nodeId, { ...existing, status: "path" });
      return;
    }

    case "FOUND_GOAL":
    case "COMPLETE":
      // Carry no per-node state of their own; they exist for the
      // renderer/UI to know "the goal was reached"/"the run is over" as
      // moments in the timeline, not as node attributes.
      return;
  }
}

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
 * type for it. It turns out `order` is always exactly "the Nth VISIT_NODE
 * event processed so far" (0-indexed), which is recoverable purely by
 * counting VISIT_NODE events during the replay — no changes needed to
 * dfs.ts or to AlgorithmEvent's shape. This sets `order` on every
 * VISIT_NODE for every algorithm, not just DFS; harmless extra field for
 * BFS/Dijkstra/A* (Phase 6's Inspector reads only the fields its
 * per-algorithm descriptor lists, not this reducer's full output).
 *
 * Always O(upToIndex) — recomputes from scratch every call. This is
 * exactly right for one-off reads (e.g. Phase 6's Inspector reading a
 * single selected node at the current index) but is the wrong tool for a
 * renderer calling it every animation frame during Play, where upToIndex
 * grows by a handful of events per call: see
 * `createIncrementalNodeStateDeriver` below for that case.
 */
export function deriveNodeStates(events: AlgorithmEvent[], upToIndex: number): Map<NodeId, NodeState> {
  const states = new Map<NodeId, NodeState>();
  const visitCounter = { count: 0 };
  const end = Math.max(0, Math.min(upToIndex, events.length));

  for (let i = 0; i < end; i++) {
    applyEvent(states, events[i], visitCounter);
  }

  return states;
}

/**
 * Finds the "current node" at a given playback index — the node whose
 * VISIT_NODE event is the most recent one at or before `upToIndex`. Used
 * by the renderer to draw a distinct current-node highlight (guideline
 * §14: "current node pulses"). Returns null before the first VISIT_NODE
 * event.
 */
export function findCurrentNode(events: AlgorithmEvent[], upToIndex: number): NodeId | null {
  const end = Math.max(0, Math.min(upToIndex, events.length));
  for (let i = end - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "VISIT_NODE") return event.nodeId;
  }
  return null;
}

export interface DerivedFrame {
  states: Map<NodeId, NodeState>;
  currentNodeId: NodeId | null;
}

/**
 * Stateful, incremental counterpart to `deriveNodeStates` +
 * `findCurrentNode`, built for the renderer's actual access pattern: many
 * calls per second, each one advancing `upToIndex` by only a handful of
 * events (during Play, `upToIndex` grows roughly `speed / frameRate`
 * events per call).
 *
 * The pure `deriveNodeStates` recomputes from event 0 every single call —
 * fine for a one-off read, but for a long-running algorithm result (tens
 * of thousands of events on a large grid) replaying the *entire* timeline
 * on *every animation frame* is real, avoidable O(n) work repeated dozens
 * of times per second, and was the concrete cause of playback feeling
 * sluggish even at a nominally fast configured speed — the configured
 * events/sec advances the index correctly, but rendering that frame kept
 * getting slower as the index grew, since each frame did more work than
 * the last. This was flagged as a Phase 7 risk in ARCHITECTURE.md §16/§20
 * and Phase 5's own notes ("deferred... if scrubbing feels laggy... this
 * is the first place to look") — pulled forward here once a user actually
 * hit it, rather than waiting for the formal performance-pass phase.
 *
 * This deriver caches the last `(events reference, index, resulting
 * state)` and, when the new call's `events` is the *same array reference*
 * and `upToIndex` is *greater than or equal to* the cached index, applies
 * only the events in between — O(delta) instead of O(upToIndex). On any
 * other transition (a new run loaded, or the index moving backward via
 * step-back/seek/reset) it falls back to a full recompute from scratch,
 * which is both correct and still cheap relative to the common case that
 * matters (advancing forward while playing).
 *
 * The returned `states` map is the SAME mutable object across calls, not
 * a fresh copy — intentional, since the copy itself would cost O(states
 * touched so far), working against the whole point of this optimization.
 * Callers must treat it as a read-only snapshot valid only until the next
 * `derive()` call; the renderer (this deriver's only consumer) already
 * does exactly that — read synchronously, draw, discard.
 */
export function createIncrementalNodeStateDeriver() {
  let cachedEvents: AlgorithmEvent[] | null = null;
  let cachedIndex = 0;
  let states = new Map<NodeId, NodeState>();
  const visitCounter = { count: 0 };
  let currentNodeId: NodeId | null = null;

  function resetCache(events: AlgorithmEvent[]): void {
    cachedEvents = events;
    cachedIndex = 0;
    states = new Map<NodeId, NodeState>();
    visitCounter.count = 0;
    currentNodeId = null;
  }

  return {
    derive(events: AlgorithmEvent[], upToIndex: number): DerivedFrame {
      const end = Math.max(0, Math.min(upToIndex, events.length));

      if (events !== cachedEvents || end < cachedIndex) {
        resetCache(events);
      }

      for (let i = cachedIndex; i < end; i++) {
        const event = events[i];
        applyEvent(states, event, visitCounter);
        if (event.type === "VISIT_NODE") currentNodeId = event.nodeId;
      }
      cachedIndex = end;

      return { states, currentNodeId };
    },
  };
}
