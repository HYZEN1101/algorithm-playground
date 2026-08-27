import { useEffect, useRef } from "react";
import { createRenderer, type RendererHandle } from "../../rendering/canvas/renderer";
import { worldStore, useWorldState } from "../../state/worldStore";
import { playbackController } from "../../state/playbackStore";
import { useGridInteraction } from "./useGridInteraction";

/**
 * The one and only component allowed to import renderer.ts (ARCHITECTURE.md
 * §20 risk table — enforced by convention/code review, not tooling, for the
 * MVP). Everything else that needs grid visuals goes through worldStore.
 */
export function CanvasGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RendererHandle | null>(null);

  // Subscribing via useWorldState() here is NOT what drives the canvas
  // redraw (that would violate "no React re-render per animation frame" —
  // see ARCHITECTURE.md §1/§16). It's used only so this component
  // re-renders when the active tool changes, for the cursor style below.
  // The actual pixel redraw is driven by renderer.requestRedraw(), called
  // from the *separate* raw (non-React) store subscription in the effect.
  const { activeTool } = useWorldState();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createRenderer(canvas, worldStore);
    rendererRef.current = renderer;

    const unsubscribeWorld = worldStore.subscribe((change) => {
      renderer.requestRedraw(change);
    });

    // Canvas subscribes directly to the PlaybackController (ARCHITECTURE.md
    // §7: "Canvas subscribes directly, no React re-render"), NOT through
    // the throttled usePlaybackState() hook — the renderer needs every
    // tick (up to 60/sec while playing) to animate frontier expansion and
    // path drawing smoothly; only React-visible text (PlaybackControls'
    // step counter) goes through the throttled hook.
    const pushPlaybackFrame = () => {
      const { events, index } = playbackController.getState();
      renderer.setPlaybackFrame(events.length > 0 ? events : null, index);
    };
    pushPlaybackFrame();
    const unsubscribePlayback = playbackController.subscribe(pushPlaybackFrame);

    return () => {
      unsubscribeWorld();
      unsubscribePlayback();
      renderer.destroy();
      rendererRef.current = null;
    };
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

  const pointerHandlers = useGridInteraction(canvasRef, rendererRef);

  const cursor = activeTool.kind === "move-start" || activeTool.kind === "move-goal" ? "grab" : "crosshair";

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", cursor, touchAction: "none" }}
        {...pointerHandlers}
      />
    </div>
  );
}
