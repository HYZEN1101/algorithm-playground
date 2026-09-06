import { useWorldState } from "../../state/worldStore";
import { uiStore } from "../../state/uiStore";
import { chaseStore, useChaseState } from "../../state/chaseStore";
import { ALGORITHM_NAMES, ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";
import { ALGORITHM_COLORS } from "../../rendering/canvas/theme";

/**
 * Phase 11 — Chase Mode. "Start Chase" spawns the player at the world's
 * Start node and all four ghosts together at the world's Goal node (the
 * "ghost den"), then opens ChaseView. See chaseStore.ts for the live
 * game loop and PHASE_11_CHASE_MODE.md for the full design.
 */
export function ChasePanel() {
  const { grid, start, goal } = useWorldState();
  const { status, caughtBy, timeRemainingMs } = useChaseState();

  const handleStart = () => {
    chaseStore.start(grid, start, goal);
    uiStore.setMainView("chase");
  };

  let resultText: string | null = null;
  if (status === "caught" && caughtBy) {
    resultText = `Last run: caught by the ${ALGORITHM_REGISTRY[caughtBy].label} ghost.`;
  } else if (status === "survived") {
    resultText = "Last run: you survived the full 30 seconds!";
  }

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Chase Mode
      </h2>

      <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px", lineHeight: 1.5 }}>
        You control the player. All four algorithms chase you at once, one
        ghost each, re-planning live. Survive 30 seconds.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {ALGORITHM_NAMES.map((name) => (
          <span
            key={name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "#555",
              border: "1px solid #e2ddd2",
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ALGORITHM_COLORS[name].fill,
                border: `1px solid ${ALGORITHM_COLORS[name].border}`,
                display: "inline-block",
              }}
            />
            {ALGORITHM_REGISTRY[name].label}
          </span>
        ))}
      </div>

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
        Start Chase
      </button>

      {status === "running" && (
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Running — {(timeRemainingMs / 1000).toFixed(1)}s left.</p>
      )}
      {resultText && <p style={{ fontSize: 12, color: "#666", margin: 0 }}>{resultText}</p>}
    </div>
  );
}
