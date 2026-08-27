import { useEffect, useRef, useState } from "react";
import { PlaybackController } from "../playback/controller";
import type { PlaybackState } from "../playback/types";

/**
 * A single shared PlaybackController instance for the whole app (matches
 * ARCHITECTURE.md §7/§10: framework-agnostic, subscribed to directly by
 * Canvas, wrapped by a throttled hook for React). Not itself a React
 * store — components/renderer that need every tick subscribe to
 * `playbackController.subscribe()` directly; only text-based UI
 * (PlaybackControls, step counter) goes through the throttled hook below.
 */
export const playbackController = new PlaybackController();

// Throttle React-visible updates to ~10/sec. The controller can notify up
// to 60/sec while playing (once per rAF tick) — re-rendering React text at
// that rate would violate ARCHITECTURE.md §16 ("no React state update per
// animation frame"). 100ms was chosen as a round number well under the
// "text changing" perceptibility threshold (a human can't usefully read
// numbers changing faster than ~10/sec anyway) while still feeling live.
const THROTTLE_MS = 100;

export function usePlaybackState(): PlaybackState {
  const [snapshot, setSnapshot] = useState<PlaybackState>(playbackController.getState());
  const pendingRef = useRef<PlaybackState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlushRef = useRef(0);

  useEffect(() => {
    // Catch up in case state changed between this hook's first render and
    // the subscription below being installed.
    setSnapshot(playbackController.getState());

    const flush = () => {
      timeoutRef.current = null;
      if (pendingRef.current) {
        setSnapshot(pendingRef.current);
        pendingRef.current = null;
        lastFlushRef.current = Date.now();
      }
    };

    const unsubscribe = playbackController.subscribe((state) => {
      pendingRef.current = state;
      const elapsed = Date.now() - lastFlushRef.current;
      if (elapsed >= THROTTLE_MS) {
        flush();
      } else if (timeoutRef.current === null) {
        timeoutRef.current = setTimeout(flush, THROTTLE_MS - elapsed);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  return snapshot;
}
