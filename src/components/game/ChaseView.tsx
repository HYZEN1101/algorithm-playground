import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { computeCellMetrics, configureCanvasBackingStore, gridToPixelCenter, type CellMetrics } from "../../rendering/coordinates";
import { drawStaticLayer } from "../../rendering/canvas/gridRenderer";
import { ALGORITHM_COLORS } from "../../rendering/canvas/theme";
import { ALGORITHM_NAMES, ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";
import { chaseStore, useChaseState } from "../../state/chaseStore";
import { uiStore } from "../../state/uiStore";
import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { Direction } from "../../game/chaseEngine";

interface ChaseViewProps {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
};

/**
 * Phase 11 — Chase Mode's canvas. Deliberately NOT createRenderer(...):
 * that renderer models a single algorithm's NodeState overlay
 * (frontier/visited/path), which has no natural way to represent five
 * independently-movable tokens (player + 4 ghosts) on otherwise-static
 * terrain. Instead this reuses the same already-tested lower-level
 * building blocks (`drawStaticLayer`, `computeCellMetrics`,
 * `configureCanvasBackingStore`, `gridToPixelCenter`) and draws
 * plain circle markers on top — see PHASE_11_CHASE_MODE.md's
 * Architecture Decision.
 */
export function ChaseView({ grid, start, goal }: ChaseViewProps) {
  const chase = useChaseState();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CellMetrics | null>(null);
  const dprRef = useRef(1);

  function redraw(): void {
    const canvas = canvasRef.current;
    const terrain = terrainRef.current;
    const metrics = metricsRef.current;
    if (!canvas || !terrain || !metrics) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Blit the cached terrain layer (identity transform — both canvases
    // share the same dpr-scaled backing-store pixel dimensions, same
    // reasoning as renderer.ts's blit step, see its Phase 2 addendum).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(terrain, 0, 0);

    // Markers are drawn in CSS-pixel space, so scale back to the dpr
    // transform before drawing them, same as terrain's own context.
    const dpr = dprRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const radius = metrics.cellSize * 0.32;

    if (chase.ghostPositions) {
      for (const name of ALGORITHM_NAMES) {
        const { row, col } = grid.coordOf(chase.ghostPositions[name]);
        const { x, y } = gridToPixelCenter(row, col, metrics);
        const color = ALGORITHM_COLORS[name];
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color.fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color.border;
        ctx.stroke();
      }
    }

    if (chase.playerNodeId !== null) {
      const { row, col } = grid.coordOf(chase.playerNodeId);
      const { x, y } = gridToPixelCenter(row, col, metrics);
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = "#1c1a17";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  // Terrain layer: drawn once per mount/resize — it doesn't change
  // mid-chase (the world isn't editable while Chase Mode is open).
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (!terrainRef.current) terrainRef.current = document.createElement("canvas");
    const terrain = terrainRef.current;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      configureCanvasBackingStore(canvas, rect.width, rect.height, dpr);
      configureCanvasBackingStore(terrain, rect.width, rect.height, dpr);

      const terrainCtx = terrain.getContext("2d");
      if (!terrainCtx) return;
      terrainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const metrics = computeCellMetrics({
        gridWidth: grid.width,
        gridHeight: grid.height,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      });
      metricsRef.current = metrics;
      drawStaticLayer(terrainCtx, grid, metrics, start, goal);
      redraw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, start, goal]);

  // Redraw markers every time chaseStore notifies (player move, ghost
  // replan tick, clock tick, catch/survive).
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chase]);

  // Keyboard input — only listens while this view is mounted, i.e. only
  // while Chase Mode is the active main view.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      chaseStore.movePlayer(direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleReplay = () => chaseStore.start(grid, start, goal);
  const handleClose = () => {
    chaseStore.stop();
    uiStore.setMainView("canvas");
  };

  const seconds = (chase.timeRemainingMs / 1000).toFixed(1);
  let statusText = "Use arrow keys / WASD to move.";
  if (chase.status === "running") statusText = `Survive! ${seconds}s left — use arrow keys / WASD.`;
  else if (chase.status === "caught" && chase.caughtBy) {
    statusText = `Caught by the ${ALGORITHM_REGISTRY[chase.caughtBy].label} ghost!`;
  } else if (chase.status === "survived") {
    statusText = "You survived the full 30 seconds!";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexShrink: 0 }}>
        <strong style={{ fontSize: 13 }}>Chase Mode — 4 ghosts, 4 algorithms, 1 you</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleReplay} style={buttonStyle}>
            Replay
          </button>
          <button type="button" onClick={handleClose} style={buttonStyle}>
            Close
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#444", marginBottom: 8, minHeight: 16, flexShrink: 0 }}>{statusText}</div>

      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, border: "1px solid #e2ddd2", borderRadius: 6, overflow: "hidden" }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
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
