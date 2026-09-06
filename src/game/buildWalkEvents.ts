import type { NodeId } from "../types/shared";
import type { AlgorithmEvent } from "../algorithms/pathfinding/types";

/**
 * Turns a found path into a synthetic AlgorithmEvent timeline that,
 * replayed through the EXISTING PlaybackController + deriveNodeStates
 * (Phase 5) + renderer (Phase 2/3), animates as "a player walking the
 * path" with zero new rendering code — see PHASE_10_GAME_MODE.md's "Key
 * Implementation Decision."
 *
 * For each node in path order: a VISIT_NODE event (deriveNodeStates sets
 * this as the current node — the ring — and status "visited"), then a
 * BUILD_PATH event for the SAME node (upgrades it to status "path" — the
 * trail color). Played back one pair at a time, this reads as "the player
 * lands on a cell, then it joins the trail behind them" — reusing
 * deriveNodeStates' existing semantics for both event types unchanged.
 *
 * Terminated by a single COMPLETE event, matching every real algorithm's
 * own event stream shape (ARCHITECTURE.md §5).
 *
 * This lives under game/ — pure logic, no React/Canvas/store — so Game
 * Mode never needs a separate pathfinding-adjacent implementation per
 * guideline §20, and so it can be unit tested exactly like
 * algorithms/shared/pathReconstruction.ts already is.
 */
export function buildWalkEvents(path: NodeId[]): AlgorithmEvent[] {
  const events: AlgorithmEvent[] = [];

  for (const nodeId of path) {
    events.push({ type: "VISIT_NODE", nodeId });
    events.push({ type: "BUILD_PATH", nodeId });
  }

  events.push({ type: "COMPLETE" });

  return events;
}
