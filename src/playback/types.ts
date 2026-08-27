import type { AlgorithmEvent } from "../algorithms/pathfinding/types";

/**
 * Exact shape from ARCHITECTURE.md §7. This is Playback State (one of the
 * five normative state layers in ARCHITECTURE.md §1) — it lives in
 * PlaybackController's plain object, never in React state.
 */
export interface PlaybackState {
  events: AlgorithmEvent[];
  index: number; // current position, 0..events.length
  isPlaying: boolean;
  speed: number; // events per second
}

/**
 * Framework-agnostic frame scheduling, injected into PlaybackController so
 * it's testable in plain Node (no requestAnimationFrame / no jsdom) with
 * fake timestamps, per PHASE_5_PLAYBACK.md's acceptance criteria ("mock/
 * fake timestamps in the test, don't rely on real rAF timing"). This is a
 * deliberate, documented deviation from ARCHITECTURE.md §7's literal
 * snippet (which shows `tick` as a plain private method with no scheduler
 * abstraction) — the public API surface (load/play/pause/reset/
 * stepForward/stepBackward/seek/setSpeed/subscribe/getState) is
 * implemented exactly as specified; only the internal timing mechanism is
 * injectable, and it defaults to the real browser APIs in production.
 */
export interface FrameScheduler {
  requestFrame(callback: (timestamp: number) => void): number;
  cancelFrame(handle: number): void;
  now(): number;
}

export const browserFrameScheduler: FrameScheduler = {
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  now: () => performance.now(),
};
