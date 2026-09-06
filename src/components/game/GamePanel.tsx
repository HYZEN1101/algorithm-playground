import { useWorldState } from "../../state/worldStore";
import { useRunState } from "../../state/runStore";
import { ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";
import { uiStore, useUIState } from "../../state/uiStore";
import { gameStore, useGameState } from "../../state/gameStore";

/**
 * Phase 10, Milestone 1 (Escape scenario). Reuses the currently-selected
 * algorithm from AlgorithmPicker/runStore — Game Mode never implements
 * its own pathfinding (guideline §20). "Start Escape" runs that algorithm
 * against the live world and, if a path exists, hands it to gameStore and
 * opens GameView; otherwise reports "no route" plainly rather than
 * animating nothing.
 */
export function GamePanel() {
  const { grid, start, goal } = useWorldState();
  const { selectedAlgorithm } = useRunState();
  const { mainView } = useUIState();
  const { path, noRoute } = useGameState();

  const handleStart = () => {
    const { run } = ALGORITHM_REGISTRY[selectedAlgorithm];
    const result = run({ grid, start, goal, diagonals: false });
    if (result.pathFound) {
      gameStore.startEscape(result.path);
      uiStore.setMainView("game");
    } else {
      gameStore.reportNoRoute();
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Game Mode
      </h2>

      <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px", lineHeight: 1.5 }}>
        Scenario: Escape — the {ALGORITHM_REGISTRY[selectedAlgorithm].label} agent tries to reach the exit.
      </p>

      <button
        type="button"
        onClick={handleStart}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 8,
          borderRadius: 6,
          border: "1px solid #2c2a28",
          background: "white",
          color: "#2c2a28",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Start Escape
      </button>

      {noRoute && (
        <p style={{ fontSize: 12, color: "#b91c1c", margin: "0 0 8px" }}>No route to the exit — the player is trapped.</p>
      )}

      {path && mainView !== "game" && (
        <button
          type="button"
          onClick={() => uiStore.setMainView("game")}
          style={{
            width: "100%",
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "white",
            color: "#2c2a28",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Reopen Escape view
        </button>
      )}
    </div>
  );
}
