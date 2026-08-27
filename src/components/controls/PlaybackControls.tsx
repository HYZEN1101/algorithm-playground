import type { CSSProperties } from "react";
import { playbackController, usePlaybackState } from "../../state/playbackStore";

/**
 * Real playback controls (Phase 5), per ARCHITECTURE.md §7/§9 and
 * guideline §13. All buttons/slider are real <button>/<input type="range">
 * elements, keyboard-reachable, per ARCHITECTURE.md §17 — this phase
 * doesn't add grid-keyboard-navigation (that's Phase 7) but these controls
 * are already keyboard-accessible for free by being real form elements.
 *
 * Reads state ONLY through the throttled usePlaybackState() hook — never
 * holds index/isPlaying in React state directly (ARCHITECTURE.md §16's
 * "React state may only ever hold UI state" rule; here, this component
 * holds no state of its own at all, it's a pure read+dispatch view over
 * the controller).
 */
export function PlaybackControls() {
  const { index, events, isPlaying, speed } = usePlaybackState();
  const hasEvents = events.length > 0;
  const atEnd = index >= events.length && hasEvents;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px" }}>
      <button
        type="button"
        onClick={() => playbackController.stepBackward()}
        disabled={!hasEvents || index === 0}
        aria-label="Step backward"
        style={buttonStyle}
      >
        ◀ Step
      </button>

      <button
        type="button"
        onClick={() => (isPlaying ? playbackController.pause() : playbackController.play())}
        disabled={!hasEvents || atEnd}
        aria-label={isPlaying ? "Pause" : "Play"}
        style={{ ...buttonStyle, minWidth: 64, fontWeight: 700 }}
      >
        {isPlaying ? "❚❚ Pause" : "▶ Play"}
      </button>

      <button
        type="button"
        onClick={() => playbackController.stepForward()}
        disabled={!hasEvents || atEnd}
        aria-label="Step forward"
        style={buttonStyle}
      >
        Step ▶
      </button>

      <button
        type="button"
        onClick={() => playbackController.reset()}
        disabled={!hasEvents}
        aria-label="Reset playback"
        style={buttonStyle}
      >
        ⟳ Reset
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
        <label htmlFor="playback-speed" style={{ fontSize: 12, color: "#666" }}>
          Speed
        </label>
        <input
          id="playback-speed"
          type="range"
          min={1}
          max={200}
          step={1}
          value={speed}
          onChange={(e) => playbackController.setSpeed(Number(e.target.value))}
          aria-label="Playback speed, events per second"
          style={{ width: 120 }}
        />
        <span style={{ fontSize: 12, color: "#666", minWidth: 70 }}>{speed.toFixed(0)} ev/s</span>
      </div>

      <span style={{ fontSize: 12, color: "#999", marginLeft: "auto" }}>
        {hasEvents ? `Step ${Math.min(index, events.length)} / ${events.length}` : "Press Run to load an algorithm"}
      </span>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #2c2a28",
  background: "white",
  color: "#2c2a28",
  fontSize: 13,
  cursor: "pointer",
};
