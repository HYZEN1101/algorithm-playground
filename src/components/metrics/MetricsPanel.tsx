import type { ReactNode } from "react";
import { useRunState } from "../../state/runStore";
import { usePlaybackState } from "../../state/playbackStore";
import type { AlgorithmEvent } from "../../algorithms/pathfinding/types";

/**
 * Algorithm-level metrics (ARCHITECTURE.md §12), explicitly split into two
 * visually distinct groups per guideline §16:
 *   - Primary (bold): Nodes Explored (LIVE, from playback index — not the
 *     final total while a run is mid-playback), Path Length, Path Cost.
 *   - Secondary (small, explicitly labeled): browser execution time.
 * Never claims "N times faster" anywhere in this copy (guideline §16 hard
 * requirement) — only ever states counts side by side.
 */
export function MetricsPanel() {
  const { selectedAlgorithm, results } = useRunState();
  const { events, index } = usePlaybackState();

  const result = results[selectedAlgorithm];

  if (!result) {
    return <div style={{ fontSize: 13, color: "#999", padding: "8px 16px" }}>Run an algorithm to see metrics.</div>;
  }

  // Live nodes-explored count driven by the SAME index source of truth as
  // the renderer (usePlaybackState reads the same PlaybackController the
  // renderer subscribes to directly) — counting VISIT_NODE events up to
  // the current index, not a separately-computed value that could drift
  // from what's visibly happening on the canvas. Only meaningful when the
  // loaded timeline actually belongs to this result (same events
  // reference); otherwise (e.g. a different algorithm's run is currently
  // loaded/playing) fall back to the final total from this result's own
  // last completed run.
  const isLiveForThisResult = events === result.events;
  const nodesExploredSoFar = isLiveForThisResult
    ? countVisitedUpTo(events, index)
    : result.nodesExplored;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "8px 16px", fontSize: 13 }}>
      <MetricGroup>
        <Metric label="Nodes Explored" value={String(nodesExploredSoFar)} />
        <Metric label="Path Length" value={result.pathFound ? String(result.pathLength) : "—"} />
        <Metric label="Path Cost" value={result.pathFound ? String(result.pathCost) : "—"} />
      </MetricGroup>

      <div style={{ marginLeft: "auto", fontSize: 11, color: "#999" }}>
        <span title="Browser execution time — not an algorithmic complexity measure.">
          {result.executionTimeMs.toFixed(2)} ms (browser timing — not an algorithmic complexity measure)
        </span>
      </div>
    </div>
  );
}

function MetricGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 20 }}>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/**
 * Counts VISIT_NODE events up to (not including) `upToIndex` — matches
 * `nodesExplored`'s own documented meaning in
 * `algorithms/pathfinding/types.ts` ("number of nodes actually
 * visited/expanded (VISIT_NODE count), not merely discovered"), applied
 * live instead of read from the final, already-computed total.
 */
function countVisitedUpTo(events: AlgorithmEvent[], upToIndex: number): number {
  const end = Math.max(0, Math.min(upToIndex, events.length));
  let count = 0;
  for (let i = 0; i < end; i++) {
    if (events[i].type === "VISIT_NODE") count++;
  }
  return count;
}
