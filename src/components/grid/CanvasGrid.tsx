import { useEffect, useRef } from "react";
import { createRenderer, type RendererHandle } from "../../rendering/canvas/renderer";
import { worldStore } from "../../state/worldStore";
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

  // Every tool on this grid uses a crosshair cursor for precise cell
  // targeting — including move-start/move-goal, which previously used a
  // "grab" hand cursor (bug: implied free-form dragging, but dropping on
  // a wall snaps back rather than allowing arbitrary drag targets, per
  // Phase 2's behavior spec). Fixed to a single constant since there's
  // currently no tool that needs a different cursor; this is the one
  // place to branch if that ever changes.
  const cursor = "crosshair";

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
