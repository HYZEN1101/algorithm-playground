import { useSyncExternalStore } from "react";
import type { NodeId } from "../types/shared";

/**
 * Phase 10 (Game Mode) session state: the path the player token is
 * currently walking, from the last "Start Escape" / algorithm re-run.
 * Deliberately its own small store (same hand-rolled pattern as
 * worldStore/runStore/uiStore/playbackStore — ARCHITECTURE.md §10) rather
 * than folded into `uiStore`: a computed path is closer to "derived
 * algorithm output for this session" than to literal UI chrome state, so
 * it gets its own home, the same way `runStore` holds algorithm results
 * rather than living in `uiStore` too.
 */
export interface GameState {
  /** The path currently being walked/about to be walked, or null before any run or after a no-path result. */
  path: NodeId[] | null;
  /** True if the most recent "Start Escape" attempt found no route to the exit. */
  noRoute: boolean;
  /** Bumped by "Replay" to restart GameView's animation from event 0 without recomputing the path. */
  replayToken: number;
}

function createGameStore() {
  let state: GameState = { path: null, noRoute: false, replayToken: 0 };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    getState(): Readonly<GameState> {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Records a freshly-found path and bumps replayToken so GameView (re)starts its walk animation from the beginning. */
    startEscape(path: NodeId[]): void {
      state = { path, noRoute: false, replayToken: state.replayToken + 1 };
      notify();
    },

    /** Records that the most recent attempt found no route — clears any previous path so a stale trail can't linger. */
    reportNoRoute(): void {
      state = { path: null, noRoute: true, replayToken: state.replayToken };
      notify();
    },

    /** Re-plays the currently-recorded path from the start; a no-op if nothing has been run yet. */
    replay(): void {
      if (!state.path) return;
      state = { ...state, replayToken: state.replayToken + 1 };
      notify();
    },
  };
}

export type GameStore = ReturnType<typeof createGameStore>;

export const gameStore: GameStore = createGameStore();

export function useGameState(): GameState {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getState);
}
