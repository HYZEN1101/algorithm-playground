import { describe, it, expect, beforeEach } from "vitest";
import { PlaybackController } from "../../src/playback/controller";
import type { AlgorithmEvent } from "../../src/algorithms/pathfinding/types";
import type { FrameScheduler } from "../../src/playback/types";

/**
 * Fake, fully manual frame scheduler. No real requestAnimationFrame exists
 * in plain Node (no jsdom in this project's Vitest config), and even in a
 * browser, real rAF timing would make these tests flaky/slow. `fireFrame`
 * lets a test advance exactly one scheduled frame with an explicit
 * timestamp, and `now()` is controlled by the test too.
 *
 * IMPORTANT: cancelFrame must actually clear the pending callback, not
 * merely mark the handle "cancelled" — a fake scheduler that forgets this
 * lets a cancelled tick still fire on the next fireFrame() call, which
 * silently masks real pause/reset bugs in the controller instead of
 * catching them. (Found and fixed during this phase's own development —
 * recorded so it isn't reintroduced.)
 */
function createFakeScheduler() {
  let nextHandle = 1;
  let pendingHandle: number | null = null;
  let pendingCallback: ((timestamp: number) => void) | null = null;
  let currentTime = 0;

  const scheduler: FrameScheduler = {
    requestFrame(callback) {
      const handle = nextHandle++;
      pendingHandle = handle;
      pendingCallback = callback;
      return handle;
    },
    cancelFrame(handle) {
      if (handle === pendingHandle) {
        pendingHandle = null;
        pendingCallback = null;
      }
    },
    now() {
      return currentTime;
    },
  };

  return {
    scheduler,
    /** Advances the fake clock and, if a frame is pending, fires it. */
    fireFrame(advanceMs: number): void {
      currentTime += advanceMs;
      const cb = pendingCallback;
      pendingHandle = null;
      pendingCallback = null;
      cb?.(currentTime);
    },
    hasPendingFrame(): boolean {
      return pendingCallback !== null;
    },
    setTime(t: number): void {
      currentTime = t;
    },
  };
}

function makeEvents(n: number): AlgorithmEvent[] {
  const events: AlgorithmEvent[] = [];
  for (let i = 0; i < n; i++) events.push({ type: "VISIT_NODE", nodeId: i });
  return events;
}

describe("PlaybackController", () => {
  let fake: ReturnType<typeof createFakeScheduler>;
  let controller: PlaybackController;

  beforeEach(() => {
    fake = createFakeScheduler();
    controller = new PlaybackController(fake.scheduler);
  });

  describe("load", () => {
    it("sets events and resets index/isPlaying", () => {
      controller.load(makeEvents(5));
      const state = controller.getState();
      expect(state.events).toHaveLength(5);
      expect(state.index).toBe(0);
      expect(state.isPlaying).toBe(false);
    });

    it("stops any in-progress playback", () => {
      controller.load(makeEvents(5));
      controller.play();
      expect(fake.hasPendingFrame()).toBe(true);
      controller.load(makeEvents(3));
      expect(fake.hasPendingFrame()).toBe(false);
      expect(controller.getState().isPlaying).toBe(false);
    });
  });

  describe("play / pause", () => {
    it("play() sets isPlaying and schedules a frame", () => {
      controller.load(makeEvents(5));
      controller.play();
      expect(controller.getState().isPlaying).toBe(true);
      expect(fake.hasPendingFrame()).toBe(true);
    });

    it("play() on empty events is a no-op", () => {
      controller.play();
      expect(controller.getState().isPlaying).toBe(false);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it("play() at the end of the timeline is a no-op (does not restart)", () => {
      controller.load(makeEvents(2));
      controller.seek(2);
      controller.play();
      expect(controller.getState().isPlaying).toBe(false);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it("pause() clears isPlaying and cancels the scheduled frame", () => {
      controller.load(makeEvents(5));
      controller.play();
      controller.pause();
      expect(controller.getState().isPlaying).toBe(false);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it("pause() while not playing is a no-op", () => {
      controller.load(makeEvents(5));
      controller.pause();
      expect(controller.getState().isPlaying).toBe(false);
    });

    it("play() again after pause resumes advancing", () => {
      controller.load(makeEvents(100));
      controller.setSpeed(10); // 10 events/sec
      controller.play();
      fake.fireFrame(500); // 0.5s * 10/s = 5 events
      expect(controller.getState().index).toBe(5);
      controller.pause();
      const pausedIndex = controller.getState().index;
      controller.play();
      fake.fireFrame(500);
      expect(controller.getState().index).toBe(pausedIndex + 5);
    });
  });

  describe("tick / speed-proportional advancement", () => {
    it("advances index proportionally to elapsed time and speed", () => {
      controller.load(makeEvents(1000));
      controller.setSpeed(20); // 20 events/sec
      controller.play();
      fake.fireFrame(1000); // 1s * 20/s = 20 events
      expect(controller.getState().index).toBe(20);
    });

    it("accumulates fractional progress across multiple frames instead of dropping it", () => {
      controller.load(makeEvents(1000));
      controller.setSpeed(10); // 1 event per 100ms
      controller.play();
      fake.fireFrame(60); // 0.6 events accumulated, 0 stepped
      expect(controller.getState().index).toBe(0);
      fake.fireFrame(60); // total 1.2 accumulated -> 1 step, 0.2 remainder kept
      expect(controller.getState().index).toBe(1);
      fake.fireFrame(90); // total remainder 0.2 + 0.9 = 1.1 -> 1 more step
      expect(controller.getState().index).toBe(2);
    });

    it("stops automatically and sets isPlaying=false when the timeline is exhausted", () => {
      controller.load(makeEvents(5));
      controller.setSpeed(100); // fast enough to blow past the end in one frame
      controller.play();
      fake.fireFrame(1000); // 100 events worth of time, only 5 exist
      const state = controller.getState();
      expect(state.index).toBe(5);
      expect(state.isPlaying).toBe(false);
      expect(fake.hasPendingFrame()).toBe(false);
    });

    it("does not advance while isPlaying is false even if a stray tick fires", () => {
      controller.load(makeEvents(5));
      controller.play();
      controller.pause();
      // Nothing pending after pause, so nothing to fire — confirms pause
      // truly cancels rather than merely flagging isPlaying=false while a
      // frame is still in flight.
      expect(fake.hasPendingFrame()).toBe(false);
    });
  });

  describe("stepForward / stepBackward", () => {
    it("stepForward advances exactly one event", () => {
      controller.load(makeEvents(5));
      controller.stepForward();
      expect(controller.getState().index).toBe(1);
      controller.stepForward();
      expect(controller.getState().index).toBe(2);
    });

    it("stepForward at the end is a no-op", () => {
      controller.load(makeEvents(2));
      controller.seek(2);
      controller.stepForward();
      expect(controller.getState().index).toBe(2);
    });

    it("stepBackward decrements exactly one event", () => {
      controller.load(makeEvents(5));
      controller.seek(3);
      controller.stepBackward();
      expect(controller.getState().index).toBe(2);
    });

    it("stepBackward at the start is a no-op", () => {
      controller.load(makeEvents(5));
      controller.stepBackward();
      expect(controller.getState().index).toBe(0);
    });

    it("stepping pauses playback if it was playing", () => {
      controller.load(makeEvents(5));
      controller.play();
      controller.stepForward();
      expect(controller.getState().isPlaying).toBe(false);
      expect(fake.hasPendingFrame()).toBe(false);
    });
  });

  describe("seek", () => {
    it("clamps to [0, events.length]", () => {
      controller.load(makeEvents(5));
      controller.seek(-3);
      expect(controller.getState().index).toBe(0);
      controller.seek(999);
      expect(controller.getState().index).toBe(5);
    });

    it("sets an arbitrary valid index", () => {
      controller.load(makeEvents(10));
      controller.seek(4);
      expect(controller.getState().index).toBe(4);
    });
  });

  describe("reset", () => {
    it("returns index to 0 and stops playback without re-loading events", () => {
      const events = makeEvents(5);
      controller.load(events);
      controller.play();
      fake.fireFrame(10000);
      controller.reset();
      const state = controller.getState();
      expect(state.index).toBe(0);
      expect(state.isPlaying).toBe(false);
      expect(state.events).toBe(events); // same array reference — not re-run
      expect(fake.hasPendingFrame()).toBe(false);
    });
  });

  describe("setSpeed", () => {
    it("updates the speed used by subsequent ticks immediately", () => {
      controller.load(makeEvents(1000));
      controller.play();
      controller.setSpeed(1000); // absurdly fast
      fake.fireFrame(10); // 10ms * 1000/s = 10 events
      expect(controller.getState().index).toBe(10);
    });

    it("rejects non-positive speeds by clamping to a small positive floor", () => {
      controller.setSpeed(-5);
      expect(controller.getState().speed).toBeGreaterThan(0);
    });
  });

  describe("subscribe", () => {
    it("notifies listeners on every state change and unsubscribe stops further notifications", () => {
      const seen: number[] = [];
      const unsubscribe = controller.subscribe((s) => seen.push(s.index));

      controller.load(makeEvents(5));
      controller.stepForward();
      unsubscribe();
      controller.stepForward();

      expect(seen).toEqual([0, 1]); // load's index=0, then stepForward's index=1; nothing after unsubscribe
    });

    it("supports multiple independent subscribers", () => {
      const a: number[] = [];
      const b: number[] = [];
      controller.subscribe((s) => a.push(s.index));
      controller.subscribe((s) => b.push(s.index));

      controller.load(makeEvents(3));
      controller.stepForward();

      expect(a).toEqual([0, 1]);
      expect(b).toEqual([0, 1]);
    });
  });

  describe("getState", () => {
    it("returns the current snapshot", () => {
      controller.load(makeEvents(3));
      controller.seek(2);
      expect(controller.getState()).toEqual({
        events: makeEvents(3),
        index: 2,
        isPlaying: false,
        speed: 10,
      });
    });
  });
});
