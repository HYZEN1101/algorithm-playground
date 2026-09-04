import { useWorldState } from "../../state/worldStore";
import { runStore, useRunState } from "../../state/runStore";
import { playbackController } from "../../state/playbackStore";
import { ALGORITHM_REGISTRY, ALGORITHM_NAMES } from "../../algorithms/pathfinding/registry";

/**
 * "Run" now means what PHASE_5_PLAYBACK.md specifies: execute the selected
 * algorithm synchronously (still fast — a few hundred ms even at 200x200,
 * per Phase 4's manual check), record the result in runStore (still used
 * by the results summary text below and, later, Phase 6's Metrics panel),
 * then load the result's events into the real PlaybackController and
 * start playing from index 0. Play/Pause/Step/Reset/Speed now live in
 * PlaybackControls, not here.
 *
 * No heuristic selector for A* — per the movement/heuristic scope
 * amendment, Manhattan is the ONLY exposed heuristic in the MVP, so there
 * is no choice to present (not "Manhattan as the default among options").
 * A dropdown with exactly one option would be dead UI.
 */

export function AlgorithmPicker() {
  const { selectedAlgorithm, results } = useRunState();
  const { grid, start, goal } = useWorldState();

  const currentResult = results[selectedAlgorithm];

  const handleRun = () => {
    const { run } = ALGORITHM_REGISTRY[selectedAlgorithm];
    const result = run({ grid, start, goal, diagonals: false });
    runStore.setResult(selectedAlgorithm, result);
    playbackController.load(result.events);
    playbackController.play();
  };

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Algorithm
      </h2>

      {ALGORITHM_NAMES.map((name) => {
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
            {ALGORITHM_REGISTRY[name].label}
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
