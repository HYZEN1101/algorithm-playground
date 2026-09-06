import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { createRenderer, type RendererHandle, type RendererWorldSource } from "../../rendering/canvas/renderer";
import { PlaybackController } from "../../playback/controller";
import { playbackController as globalPlaybackController } from "../../state/playbackStore";
import { buildWalkEvents } from "../../game/buildWalkEvents";
import { uiStore } from "../../state/uiStore";
import { gameStore, useGameState } from "../../state/gameStore";
import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";

interface GameViewProps {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
}

/**
 * Phase 10, Milestone 1 (Escape scenario). Same architecture as Phase 9's
 * MiniAlgorithmCanvas — its own PlaybackController + its own
 * createRenderer(...) instance, neither a singleton, so this coexists
 * fine with the main CanvasGrid and Comparison Mode even though only one
 * of them is ever mounted at a time (AppShell's three-way switch).
 *
 * Renders the synthetic "walk" event timeline from buildWalkEvents(path)
 * — deliberately NOT the real algorithm's own exploration events, so
 * Game Mode shows a player walking a resolved route, not a search
 * process (that visualization already belongs to the main Algorithm
 * Playground view).
 */
export function GameView({ grid, start, goal }: GameViewProps) {
  const { path, replayToken } = useGameState();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const controllerRef = useRef<PlaybackController>(new PlaybackController());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const worldSource: RendererWorldSource = { getState: () => ({ grid, start, goal }) };
    const renderer = createRenderer(canvas, worldSource);
    rendererRef.current = renderer;

    const pushFrame = () => {
      const { events, index } = controllerRef.current.getState();
      renderer.setPlaybackFrame(events.length > 0 ? events : null, index);
    };
    pushFrame();
    const unsubscribe = controllerRef.current.subscribe(pushFrame);

    return () => {
      unsubscribe();
      renderer.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      rendererRef.current?.updateSize(rect.width, rect.height, dpr);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // (Re)starts the walk whenever gameStore's path changes or Replay bumps
  // replayToken. Speed starts synced to the shared global Speed slider —
  // same one-slider-drives-the-whole-app rule as Comparison Mode's
  // Addendum 2, kept live via the subscription effect below.
  useEffect(() => {
    if (!path) return;
    const events = buildWalkEvents(path);
    controllerRef.current.setSpeed(globalPlaybackController.getState().speed);
    controllerRef.current.load(events);
    controllerRef.current.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, replayToken]);

  useEffect(() => {
    const syncSpeed = () => controllerRef.current.setSpeed(globalPlaybackController.getState().speed);
    syncSpeed();
    return globalPlaybackController.subscribe(syncSpeed);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexShrink: 0 }}>
        <strong style={{ fontSize: 13 }}>Game Mode — Escape</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => gameStore.replay()} style={buttonStyle}>
            Replay
          </button>
          <button type="button" onClick={() => uiStore.setGameView(false)} style={buttonStyle}>
            Close
          </button>
        </div>
      </div>
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
