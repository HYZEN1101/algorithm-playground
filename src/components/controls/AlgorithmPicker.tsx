import { useWorldState } from "../../state/worldStore";
import { runStore, useRunState, type AlgorithmName } from "../../state/runStore";
import { bfs } from "../../algorithms/pathfinding/bfs";
import { dfs } from "../../algorithms/pathfinding/dfs";
import { dijkstra } from "../../algorithms/pathfinding/dijkstra";
import { astar } from "../../algorithms/pathfinding/astar";
import type { PathfindingAlgorithm } from "../../algorithms/pathfinding/types";

/**
 * ================================ TEMPORARY (Phase 3/4) ================================
 * This exists purely to validate the algorithm engine end-to-end before
 * Phase 5 builds the real playback system. "Run" here means "execute the
 * algorithm synchronously and show its final state" — no play/pause/step,
 * no speed control, no animation. PHASE_5_PLAYBACK.md supersedes this
 * component with real PlaybackControls; when that happens, "Run" there
 * means "load events into PlaybackController and play" instead.
 *
 * No heuristic selector for A* — per the movement/heuristic scope
 * amendment, Manhattan is the ONLY exposed heuristic in the MVP, so there
 * is no choice to present (not "Manhattan as the default among options").
 * A dropdown with exactly one option would be dead UI.
 * ============================================================================================
 */

const ALGORITHMS: Record<AlgorithmName, { label: string; run: PathfindingAlgorithm }> = {
  bfs: { label: "BFS", run: bfs },
  dfs: { label: "DFS", run: dfs },
  dijkstra: { label: "Dijkstra", run: dijkstra },
  astar: { label: "A*", run: astar },
};

export function AlgorithmPicker() {
  const { selectedAlgorithm, results } = useRunState();
  const { grid, start, goal } = useWorldState();

  const currentResult = results[selectedAlgorithm];

  const handleRun = () => {
    const { run } = ALGORITHMS[selectedAlgorithm];
    const result = run({ grid, start, goal, diagonals: false });
    runStore.setResult(selectedAlgorithm, result);
  };

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Algorithm (temporary — Phase 5 replaces this)
      </h2>

      {(Object.keys(ALGORITHMS) as AlgorithmName[]).map((name) => {
        const selected = name === selectedAlgorithm;
        return (
          <label
            key={name}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 10px",
              marginBottom: 4,
              borderRadius: 6,
              border: selected ? "1px solid #2c2a28" : "1px solid transparent",
              background: selected ? "rgba(44, 42, 40, 0.08)" : "transparent",
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="algorithm"
              checked={selected}
              onChange={() => runStore.selectAlgorithm(name)}
              style={{ marginRight: 8 }}
            />
            {ALGORITHMS[name].label}
          </label>
        );
      })}

      <button
        type="button"
        onClick={handleRun}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginTop: 8,
          marginBottom: 4,
          borderRadius: 6,
          border: "1px solid #2c2a28",
          background: "#2c2a28",
          color: "white",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Run
      </button>

      {currentResult && (
        <p style={{ fontSize: 12, color: "#666", marginTop: 8, lineHeight: 1.5 }}>
          {currentResult.pathFound ? (
            <>
              Path found — {currentResult.pathLength} steps, cost {currentResult.pathCost}.
              <br />
              {currentResult.nodesExplored} nodes explored.
            </>
          ) : (
            <>No path found. {currentResult.nodesExplored} nodes explored.</>
          )}
        </p>
      )}

      {!currentResult && <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>Press Run to see the result.</p>}
    </div>
  );
}
