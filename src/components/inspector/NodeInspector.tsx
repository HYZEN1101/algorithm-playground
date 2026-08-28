import type { CSSProperties } from "react";
import { useWorldState } from "../../state/worldStore";
import { useRunState } from "../../state/runStore";
import { useUIState } from "../../state/uiStore";
import { usePlaybackState } from "../../state/playbackStore";
import { deriveNodeStates } from "../../playback/deriveNodeStates";
import { getFieldDescriptors } from "./fieldDescriptors";

/**
 * Shows the currently-selected cell's algorithm-specific internal state
 * (ARCHITECTURE.md §11). Values reflect `deriveNodeStates(events,
 * currentPlaybackIndex)` for the selected node — since this reads through
 * `usePlaybackState()` (throttled to ~10/sec, per Phase 5), it updates
 * live as playback advances without needing the node to be re-selected.
 *
 * Uses the PURE `deriveNodeStates`, not the renderer's incremental
 * deriver — this is exactly the "one-off read of a single node" case that
 * function's own doc comment calls out as the right fit: called at most
 * ~10/sec (React's throttle rate), not once per animation frame, so the
 * O(index) cost here is negligible compared to the renderer's much
 * higher-frequency, much larger (whole-map) use.
 */
export function NodeInspector() {
  const { grid } = useWorldState();
  const { selectedAlgorithm, results } = useRunState();
  const { selectedNodeId } = useUIState();
  const { events, index } = usePlaybackState();

  if (selectedNodeId === null) {
    return (
      <div style={emptyStateStyle}>
        <p style={{ margin: 0 }}>Click a cell (with the Inspect tool active) to inspect it.</p>
      </div>
    );
  }

  const result = results[selectedAlgorithm];
  // Prefer the live playback timeline when one is loaded for the currently
  // selected algorithm (events reference match confirms it's actually this
  // algorithm's own run, not a stale one left over from switching
  // algorithms after a different one finished playing). Otherwise fall
  // back to that algorithm's last finalNodeState, if it has one, so
  // selecting a cell still shows something meaningful right after a run
  // completes and before/without pressing Play again.
  const nodeState =
    result && events === result.events
      ? deriveNodeStates(events, index).get(selectedNodeId)
      : result?.finalNodeState.get(selectedNodeId);

  const { row, col } = grid.coordOf(selectedNodeId);
  const fields = getFieldDescriptors(selectedAlgorithm);

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 4px" }}>
        Inspector
      </h2>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
        Node ({row}, {col})
      </p>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 10 }}>
        {fields.map((field) => (
          <FieldRow key={field.key} label={field.label} value={field.value({ nodeId: selectedNodeId, nodeState, grid })} />
        ))}
      </dl>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ fontSize: 12, color: "#777" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</dd>
    </>
  );
}

const emptyStateStyle: CSSProperties = {
  fontSize: 13,
  color: "#999",
  lineHeight: 1.5,
};
