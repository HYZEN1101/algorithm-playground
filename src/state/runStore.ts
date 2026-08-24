import { useSyncExternalStore } from "react";
import type { PathfindingResult } from "../algorithms/pathfinding/types";

/**
 * Phase 3 only implements BFS and DFS — deliberately not extending this to
 * "dijkstra" | "astar" yet, even though Phase 4 will need to. Guessing at
 * the exact shape Phase 4 wants isn't this phase's job; Phase 4 extends
 * this type itself when it adds those algorithms.
 */
export type AlgorithmName = "bfs" | "dfs";

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
  };
}

export type RunStore = ReturnType<typeof createRunStore>;

export const runStore: RunStore = createRunStore();

export function useRunState(): RunState {
  return useSyncExternalStore(runStore.subscribe, runStore.getState);
}
