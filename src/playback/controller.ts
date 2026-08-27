import type { AlgorithmEvent } from "../algorithms/pathfinding/types";
import { browserFrameScheduler, type FrameScheduler, type PlaybackState } from "./types";

/**
 * Framework-agnostic playback engine (ARCHITECTURE.md §7). Owns:
 *   events[], currentIndex, isPlaying, speed
 * and nothing else — no React, no Canvas, no algorithm knowledge beyond
 * the AlgorithmEvent shape it walks over.
 *
 * Speed is expressed in events/second (not "1-10 slider units") so the
 * relationship between a UI slider and perceived pace is linear.
 *
 * Timing uses a delta-time accumulator (not fixed per-frame increments),
 * per ARCHITECTURE.md §20's mitigation for "playback speed feels
 * inconsistent across devices" — frame rate variance doesn't change how
 * many events/second are consumed.
 */
export class PlaybackController {
  private state: PlaybackState;
  private readonly listeners = new Set<(s: PlaybackState) => void>();
  private readonly scheduler: FrameScheduler;
  private frameHandle: number | null = null;
  private lastTickTime = 0;
  private accumulator = 0;

  constructor(scheduler: FrameScheduler = browserFrameScheduler) {
    this.scheduler = scheduler;
    this.state = { events: [], index: 0, isPlaying: false, speed: 10 };
  }

  load(events: AlgorithmEvent[]): void {
    this.stopLoop();
    this.accumulator = 0;
    this.state = { ...this.state, events, index: 0, isPlaying: false };
    this.notify();
  }

  play(): void {
    if (this.state.isPlaying) return;
    if (this.state.events.length === 0) return;
    // Starting play from the very end is a no-op rather than silently
    // restarting from 0 — Reset is the explicit action for that, per this
    // phase's own behavior spec ("Reset ... Does NOT re-run the
    // algorithm ... re-running is a separate 'Run' action").
    if (this.state.index >= this.state.events.length) return;

    this.state = { ...this.state, isPlaying: true };
    this.lastTickTime = this.scheduler.now();
    this.accumulator = 0;
    this.startLoop();
    this.notify();
  }

  pause(): void {
    if (!this.state.isPlaying) return;
    this.stopLoop();
    this.state = { ...this.state, isPlaying: false };
    this.notify();
  }

  reset(): void {
    this.stopLoop();
    this.accumulator = 0;
    this.state = { ...this.state, index: 0, isPlaying: false };
    this.notify();
  }

  stepForward(): void {
    this.pauseIfPlaying();
    if (this.state.index >= this.state.events.length) return;
    this.state = { ...this.state, index: this.state.index + 1 };
    this.notify();
  }

  stepBackward(): void {
    this.pauseIfPlaying();
    if (this.state.index <= 0) return;
    this.state = { ...this.state, index: this.state.index - 1 };
    this.notify();
  }

  seek(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.state.events.length));
    if (clamped === this.state.index) return;
    this.state = { ...this.state, index: clamped };
    this.notify();
  }

  setSpeed(eventsPerSecond: number): void {
    const speed = Math.max(0.1, eventsPerSecond);
    this.state = { ...this.state, speed };
    // No notify() needed strictly for correctness, but UI (the speed
    // slider's own displayed value) reads from state too, so keep it
    // consistent with every other mutator here.
    this.notify();
  }

  subscribe(fn: (s: PlaybackState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): Readonly<PlaybackState> {
    return this.state;
  }

  private pauseIfPlaying(): void {
    if (this.state.isPlaying) {
      this.stopLoop();
      this.state = { ...this.state, isPlaying: false };
      // Notified once below by the caller's own state change, avoiding a
      // double-notify for a single logical action (step pauses AND moves).
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private startLoop(): void {
    if (this.frameHandle !== null) return;
    this.frameHandle = this.scheduler.requestFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.frameHandle !== null) {
      this.scheduler.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  /** Internal rAF callback. Advances index by accumulator, calls listeners. */
  private tick = (timestamp: number): void => {
    if (!this.state.isPlaying) return;

    const deltaSeconds = Math.max(0, (timestamp - this.lastTickTime) / 1000);
    this.lastTickTime = timestamp;
    this.accumulator += deltaSeconds * this.state.speed;

    const steps = Math.floor(this.accumulator);
    if (steps > 0) {
      this.accumulator -= steps;
      const nextIndex = Math.min(this.state.index + steps, this.state.events.length);
      const reachedEnd = nextIndex >= this.state.events.length;
      this.state = { ...this.state, index: nextIndex, isPlaying: !reachedEnd };
      this.notify();
      if (reachedEnd) {
        this.frameHandle = null;
        return; // playback finished naturally; no more frames scheduled
      }
    }

    this.frameHandle = this.scheduler.requestFrame(this.tick);
  };
}
