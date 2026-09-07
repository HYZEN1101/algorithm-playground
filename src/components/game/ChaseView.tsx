import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { computeCellMetrics, configureCanvasBackingStore, gridToPixelCenter, type CellMetrics } from "../../rendering/coordinates";
import { drawStaticLayer } from "../../rendering/canvas/gridRenderer";
import { ALGORITHM_COLORS } from "../../rendering/canvas/theme";
import { ALGORITHM_NAMES, ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";
import {
  chaseStore,
  useChaseState,
  GHOST_REPLAN_INTERVAL_MS,
  PLAYER_MOVE_INTERVAL_MS,
} from "../../state/chaseStore";
import { uiStore } from "../../state/uiStore";
import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { AlgorithmName } from "../../algorithms/pathfinding/types";
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
 * A single entity's (player or ghost) sub-cell animation: it is visually
 * gliding from `fromNodeId`'s pixel center to `toNodeId`'s pixel center,
 * starting at `startTime`, over `durationMs`. This is Render State
 * (ARCHITECTURE.md §1's fifth layer — "interpolated/derived visual data,
 * read every animation frame") layered on top of chaseStore's Playback-
 * analogous logical state (which only ever holds discrete NodeIds,
 * ticking on its own fixed timers) — the same separation this project
 * already uses everywhere else, applied here for the first time to
 * continuous rather than discrete-step motion.
 */
interface EntityAnim {
  fromNodeId: NodeId;
  toNodeId: NodeId;
  startTime: number;
  durationMs: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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
 *
 * Motion is smooth (Phase 11 Addendum): chaseStore's logical positions
 * still update in discrete cell-sized jumps on fixed timers (400ms per
 * ghost replan, `PLAYER_MOVE_INTERVAL_MS` per player step), but a
 * persistent requestAnimationFrame loop here interpolates each entity's
 * drawn pixel position between its last two logical positions over that
 * same duration, so the player and all four ghosts visibly glide rather
 * than snap.
 */
export function ChaseView({ grid, start, goal }: ChaseViewProps) {
  const chase = useChaseState();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<CellMetrics | null>(null);
  const dprRef = useRef(1);

  const playerAnimRef = useRef<EntityAnim | null>(null);
  const ghostAnimRef = useRef<Partial<Record<AlgorithmName, EntityAnim>>>({});

  function cellCenter(nodeId: NodeId, metrics: CellMetrics): { x: number; y: number } {
    const { row, col } = grid.coordOf(nodeId);
    return gridToPixelCenter(row, col, metrics);
  }

  function currentPixel(anim: EntityAnim | undefined | null, restingNodeId: NodeId | null, metrics: CellMetrics): { x: number; y: number } | null {
    if (!anim) return restingNodeId !== null ? cellCenter(restingNodeId, metrics) : null;
    const t = Math.min(1, (performance.now() - anim.startTime) / anim.durationMs);
    const from = cellCenter(anim.fromNodeId, metrics);
    const to = cellCenter(anim.toNodeId, metrics);
    return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
  }

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

    // Read chaseStore fresh every frame (not the `chase` value closed
    // over from the last React render) — this loop runs independently
    // of React's render cycle, so it must not rely on a stale snapshot.
    const liveChase = chaseStore.getState();

    if (liveChase.ghostPositions) {
      for (const name of ALGORITHM_NAMES) {
        const pixel = currentPixel(ghostAnimRef.current[name], liveChase.ghostPositions[name], metrics);
        if (!pixel) continue;
        const color = ALGORITHM_COLORS[name];
        ctx.beginPath();
        ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color.fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color.border;
        ctx.stroke();
      }
    }

    const playerPixel = currentPixel(playerAnimRef.current, liveChase.playerNodeId, metrics);
    if (playerPixel) {
      ctx.beginPath();
      ctx.arc(playerPixel.x, playerPixel.y, radius * 1.15, 0, Math.PI * 2);
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

  // Whenever chaseStore's LOGICAL position for the player or any ghost
  // actually changes, (re)start that entity's glide animation from
  // wherever it was resting to the new position. Deliberately does NOT
  // fire on every chaseStore notification (the countdown clock ticks
  // every 100ms without moving anything) — only on a genuine NodeId
  // change, so an in-flight glide is never interrupted/restarted by an
  // unrelated update.
  useEffect(() => {
    if (chase.playerNodeId !== null) {
      const prevAnim = playerAnimRef.current;
      const restingNodeId = prevAnim ? prevAnim.toNodeId : chase.playerNodeId;
      if (restingNodeId !== chase.playerNodeId) {
        playerAnimRef.current = {
          fromNodeId: restingNodeId,
          toNodeId: chase.playerNodeId,
          startTime: performance.now(),
          durationMs: PLAYER_MOVE_INTERVAL_MS,
        };
      }
    } else {
      playerAnimRef.current = null;
    }

    if (chase.ghostPositions) {
      for (const name of ALGORITHM_NAMES) {
        const newPos = chase.ghostPositions[name];
        const prevAnim = ghostAnimRef.current[name];
        const restingNodeId = prevAnim ? prevAnim.toNodeId : newPos;
        if (restingNodeId !== newPos) {
          ghostAnimRef.current[name] = {
            fromNodeId: restingNodeId,
            toNodeId: newPos,
            startTime: performance.now(),
            durationMs: GHOST_REPLAN_INTERVAL_MS,
          };
        }
      }
    } else {
      ghostAnimRef.current = {};
    }
  }, [chase]);

  // Persistent render loop, independent of React's render cycle — redraws
  // every animation frame using whatever the CURRENT interpolated
  // position is, for the component's whole mounted lifetime.
  useEffect(() => {
    let active = true;
    let rafId: number;

    const frame = () => {
      if (!active) return;
      redraw();
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard input: tracks HELD directions rather than moving on every
  // keydown — actual movement happens on chaseStore's own fixed
  // PLAYER_MOVE_INTERVAL_MS timer, so speed is constant no matter how
  // fast or slow the player presses keys (see chaseStore.ts's Addendum
  // note — this replaced immediate per-keydown movement, which let
  // button-mashing outrun the ghosts).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      chaseStore.setDirectionHeld(direction);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      chaseStore.clearDirectionHeld(direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
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
