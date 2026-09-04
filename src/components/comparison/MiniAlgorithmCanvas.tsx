import { useEffect, useRef, useState } from "react";
import { createRenderer, type RendererHandle, type RendererWorldSource } from "../../rendering/canvas/renderer";
import { PlaybackController } from "../../playback/controller";
import { playbackController as globalPlaybackController, usePlaybackState } from "../../state/playbackStore";
import type { Grid } from "../../world/grid";
import type { NodeId } from "../../types/shared";
import type { AlgorithmName, PathfindingResult } from "../../algorithms/pathfinding/types";
import type { PathColor } from "../../rendering/canvas/pathRenderer";
import { ALGORITHM_REGISTRY } from "../../algorithms/pathfinding/registry";

interface MiniAlgorithmCanvasProps {
  algorithm: AlgorithmName;
  grid: Grid;
  start: NodeId;
  goal: NodeId;
  pathColor: PathColor;
  /** Bumped by the parent (ComparisonGrid) to trigger a synchronized
   * replay of all four canvases from index 0, without remounting them. */
  replayToken: number;
}

/**
 * One quadrant of Comparison Mode's 4-up animated view (Phase 9 addendum
 * to PHASE_9_COMPARISON_MODE.md — the original Phase 9 spec explicitly
 * non-goaled this; this component is what that non-goal deferred).
 *
 * Owns its OWN `PlaybackController` and its OWN `createRenderer(...)`
 * instance — neither is a singleton (ARCHITECTURE.md §7/§8 already
 * designed both as factories, not module-level globals), so four of
 * these can run fully independently and simultaneously without stepping
 * on each other or on the single main CanvasGrid's global
 * `playbackController`.
 *
 * The world (grid/start/goal) is fixed for this canvas's lifetime — Run
 * All runs every algorithm against the identical Grid reference
 * (ARCHITECTURE.md §4/guideline §17), and this component never mutates
 * or regenerates it; only `replayToken` re-triggers a run, always against
 * the same grid/start/goal props it was given.
 */
export function MiniAlgorithmCanvas({ algorithm, grid, start, goal, pathColor, replayToken }: MiniAlgorithmCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const controllerRef = useRef<PlaybackController>(new PlaybackController());
  const [result, setResult] = useState<PathfindingResult | null>(null);

  // Renderer lifecycle: create once per mount, destroy on unmount. Static
  // world source (never subscribes to worldStore) since this canvas's
  // world is a frozen snapshot for its whole lifetime, not live-editable.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const worldSource: RendererWorldSource = { getState: () => ({ grid, start, goal }) };
    const renderer = createRenderer(canvas, worldSource, { pathColor });
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

  // Runs the algorithm and (re)starts playback: on first mount, and again
  // whenever the parent bumps replayToken (its "Replay" button) — always
  // against the same grid/start/goal this canvas was given, never a
  // regenerated world. Speed starts synced to whatever the main Speed
  // slider is currently set to (see the sync effect below for keeping it
  // synced live, not just at this starting moment).
  useEffect(() => {
    const { run } = ALGORITHM_REGISTRY[algorithm];
    const runResult = run({ grid, start, goal, diagonals: false });
    setResult(runResult);
    controllerRef.current.setSpeed(globalPlaybackController.getState().speed);
    controllerRef.current.load(runResult.events);
    controllerRef.current.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithm, grid, start, goal, replayToken]);

  // Keeps this mini-canvas's own PlaybackController speed synced to the
  // main Speed slider (which drives the single global playbackController)
  // for the entire time this canvas is mounted — not just at the moment
  // above when the run starts. Without this, moving the slider while the
  // 4-up view is open only affected the (currently hidden) single canvas,
  // which is exactly the desync the user reported. Each mini-canvas still
  // owns its own PlaybackController/index — only the speed value is kept
  // in lockstep, per PHASE_5_PLAYBACK.md's rule that a speed change take
  // effect immediately, not on next play.
  useEffect(() => {
    const syncSpeed = () => {
      controllerRef.current.setSpeed(globalPlaybackController.getState().speed);
    };
    syncSpeed();
    return globalPlaybackController.subscribe(syncSpeed);
  }, []);

  const playback = usePlaybackState(controllerRef.current);
  const total = playback.events.length;
  const progress = Math.min(playback.index, total);
  const done = total > 0 && progress >= total;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        border: "1px solid #e2ddd2",
        borderRadius: 6,
        overflow: "hidden",
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "#faf8f3",
          borderBottom: "1px solid #e2ddd2",
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: pathColor.fill,
              border: `1px solid ${pathColor.border}`,
              display: "inline-block",
            }}
          />
          {ALGORITHM_REGISTRY[algorithm].label}
        </strong>
        <span style={{ fontSize: 11, color: "#888" }}>
          {result === null
            ? "…"
            : done
              ? `${result.pathFound ? `cost ${result.pathCost}` : "no path"} · ${result.nodesExplored} explored`
              : `${progress}/${total} events`}
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}
