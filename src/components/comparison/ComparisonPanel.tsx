import { useWorldState } from "../../state/worldStore";
import { runStore, useRunState } from "../../state/runStore";
import { ALGORITHM_REGISTRY, ALGORITHM_NAMES } from "../../algorithms/pathfinding/registry";
import { buildComparisonRows, findMostEfficientOptimal } from "../../algorithms/pathfinding/comparisonMetrics";

/**
 * Phase 9 — Comparison Mode. Metrics-only: runs all four algorithms
 * against the SAME Grid instance (no per-algorithm regeneration, per
 * ARCHITECTURE.md §4/guideline §17) and shows a side-by-side table. Does
 * NOT touch playbackController — this never animates; the existing
 * single "Run" button in AlgorithmPicker is still how you watch one
 * algorithm step through its events. See PHASE_9_COMPARISON_MODE.md for
 * the explicit non-goal (no synchronized multi-canvas playback).
 */
export function ComparisonPanel() {
  const { results } = useRunState();
  const { grid, start, goal } = useWorldState();

  const rows = buildComparisonRows(results);
  const winner = findMostEfficientOptimal(rows);

  const handleRunAll = () => {
    // Same `grid` object reference passed to every algorithm — not a
    // clone per algorithm — so all four run against the identical world.
    for (const name of ALGORITHM_NAMES) {
      const { run } = ALGORITHM_REGISTRY[name];
      const result = run({ grid, start, goal, diagonals: false });
      runStore.setResult(name, result);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Compare
      </h2>

      <button
        type="button"
        onClick={handleRunAll}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 10,
          borderRadius: 6,
          border: "1px solid #2c2a28",
          background: "white",
          color: "#2c2a28",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Run All
      </button>

      {rows.length === 0 && <p style={{ fontSize: 12, color: "#999" }}>Run All to compare all four algorithms on the current map.</p>}

      {rows.length > 0 && (
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "2px 4px 4px 0" }}>Algo</th>
              <th style={{ padding: "2px 4px 4px 0" }}>Explored</th>
              <th style={{ padding: "2px 4px 4px 0" }}>Cost</th>
              <th style={{ padding: "2px 0 4px 0" }}>Optimal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.algorithm} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "3px 4px 3px 0", fontWeight: row === winner ? 700 : 400 }}>
                  {ALGORITHM_REGISTRY[row.algorithm].label}
                </td>
                <td style={{ padding: "3px 4px 3px 0" }}>{row.pathFound ? row.nodesExplored : "—"}</td>
                <td style={{ padding: "3px 4px 3px 0" }}>{row.pathFound ? row.pathCost : "—"}</td>
                <td style={{ padding: "3px 0 3px 0" }}>{row.pathFound ? (row.isOptimal ? "yes" : "no") : "no path"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {winner && (
        <p style={{ fontSize: 11, color: "#666", marginTop: 8, lineHeight: 1.5 }}>
          {ALGORITHM_REGISTRY[winner.algorithm].label} explored the fewest nodes ({winner.nodesExplored}) among
          algorithms that found an optimal-cost path on this map.
        </p>
      )}
    </div>
  );
}
