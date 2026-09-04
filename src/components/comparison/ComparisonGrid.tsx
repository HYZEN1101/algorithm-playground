import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { AlgorithmName } from "../../algorithms/pathfinding/types";
import { ALGORITHM_NAMES, ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";
import type { PathColor } from "../../rendering/canvas/pathRenderer";
import { MiniAlgorithmCanvas } from "./MiniAlgorithmCanvas";
import { uiStore } from "../../state/uiStore";

/**
 * One distinct path color per algorithm, so the four simultaneous
 * mini-canvases are attributable at a glance without reading labels.
 * Frontier/visited styling is intentionally identical across all four
 * (pathRenderer.ts defaults) — only the final PATH needs a per-algorithm
 * identity. A* keeps the original single-canvas gold, since that's the
 * color this project's screenshots/demo script already associate with it.
 */
const COMPARISON_COLORS: Record<AlgorithmName, PathColor> = {
  bfs: { fill: "rgba(59, 130, 246, 0.65)", border: "rgba(29, 78, 216, 0.9)" }, // blue
  dfs: { fill: "rgba(168, 85, 247, 0.65)", border: "rgba(107, 33, 168, 0.9)" }, // purple
  dijkstra: { fill: "rgba(20, 184, 166, 0.65)", border: "rgba(15, 118, 110, 0.9)" }, // teal
  astar: { fill: "rgba(240, 173, 78, 0.85)", border: "rgba(120, 74, 6, 0.9)" }, // gold
};

interface ComparisonGridProps {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
}

/**
 * Phase 9 addendum — replaces the single CanvasGrid in the main panel
 * with four simultaneous, independently-animating mini-canvases (one per
 * algorithm), each running against the identical grid/start/goal. See
 * MiniAlgorithmCanvas.tsx for why this is architecturally safe (neither
 * PlaybackController nor the renderer were ever singletons).
 */
export function ComparisonGrid({ grid, start, goal }: ComparisonGridProps) {
  const [replayToken, setReplayToken] = useState(0);
  const [finishOrder, setFinishOrder] = useState<AlgorithmName[]>([]);

  // Fresh race every time a new run starts — a world edit (grid/start/
  // goal changing) or a Replay (replayToken bumping) both mean every
  // mini-canvas is about to reload/replay from event 0, so any previous
  // finish order is stale.
  useEffect(() => {
    setFinishOrder([]);
  }, [grid, start, goal, replayToken]);

  const handleFinish = useCallback((algorithm: AlgorithmName) => {
    // Ignore a duplicate report for an algorithm that's already recorded
    // (shouldn't happen — MiniAlgorithmCanvas only reports once per run —
    // but guards against a double-count if that guarantee ever slips).
    setFinishOrder((prev) => (prev.includes(algorithm) ? prev : [...prev, algorithm]));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexShrink: 0 }}>
        <strong style={{ fontSize: 13 }}>Comparison Mode — all four algorithms, same map</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setReplayToken((t) => t + 1)} style={buttonStyle}>
            Replay
          </button>
          <button type="button" onClick={() => uiStore.setComparisonView(false)} style={buttonStyle}>
            Close
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#888", marginBottom: 8, minHeight: 14, flexShrink: 0 }}>
        {finishOrder.length === 0
          ? "Racing…"
          : finishOrder.map((name, i) => `${i + 1}. ${ALGORITHM_REGISTRY[name].label}`).join("   ")}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 10,
        }}
      >
        {ALGORITHM_NAMES.map((name) => (
          <MiniAlgorithmCanvas
            key={name}
            algorithm={name}
            grid={grid}
            start={start}
            goal={goal}
            pathColor={COMPARISON_COLORS[name]}
            replayToken={replayToken}
            position={finishOrder.includes(name) ? finishOrder.indexOf(name) + 1 : undefined}
            onFinish={handleFinish}
          />
        ))}
      </div>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  borderRadius: 5,
  border: "1px solid #2c2a28",
  background: "white",
  color: "#2c2a28",
  cursor: "pointer",
};
