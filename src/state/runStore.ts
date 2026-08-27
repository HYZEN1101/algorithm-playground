import { useSyncExternalStore } from "react";
import type { PathfindingResult } from "../algorithms/pathfinding/types";

/**
 * Extended in Phase 4 to include "dijkstra" | "astar" — Phase 3 originally
 * left this as "bfs" | "dfs" only, deliberately not guessing at the shape
 * Phase 4 would want.
 */
export type AlgorithmName = "bfs" | "dfs" | "dijkstra" | "astar";

export interface RunState {
  /** The currently selected algorithm in the temporary AlgorithmPicker UI. */
  selectedAlgorithm: AlgorithmName;
  /** Latest result per algorithm, keyed by name. Undefined until that algorithm has been run at least once. */
  results: Partial<Record<AlgorithmName, PathfindingResult>>;
}

function createRunStore() {
  let state: RunState = {
    selectedAlgorithm: "bfs",
    results: {},
  };

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    getState(): Readonly<RunState> {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    selectAlgorithm(name: AlgorithmName): void {
      state = { ...state, selectedAlgorithm: name };
      notify();
    },

    /** Records a fresh result for the given algorithm (overwrites any previous one). */
    setResult(name: AlgorithmName, result: PathfindingResult): void {
      state = { ...state, results: { ...state.results, [name]: result } };
      notify();
    },

    /**
     * Clears every stored result. Needed when the world changes in a way
     * that makes old results meaningless rather than merely stale — e.g.
     * a grid resize, where `NodeId = row * width + col` means every old
     * result's events/finalNodeState reference cells that don't
     * correspond to the same physical cells (or may not exist at all) on
     * the new grid.
     */
    clearResults(): void {
      state = { ...state, results: {} };
      notify();
    },
  };
}

export type RunStore = ReturnType<typeof createRunStore>;

export const runStore: RunStore = createRunStore();

export function useRunState(): RunState {
  return useSyncExternalStore(runStore.subscribe, runStore.getState);
}
