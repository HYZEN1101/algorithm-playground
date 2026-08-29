import { useSyncExternalStore } from "react";
import type { NodeId } from "../types/shared";

/**
 * UI state (ARCHITECTURE.md §1's fifth layer): "what is the user currently
 * viewing/configuring". `selectedNodeId` is the one piece of UI state
 * Phase 6 needs — which cell the Inspector is currently showing. This is
 * genuinely UI state, not World/Algorithm/Playback state: it doesn't
 * affect the simulation, the algorithm, or playback itself, only what a
 * side panel currently displays.
 */
export interface UIState {
  selectedNodeId: NodeId | null;
  /**
   * Keyboard focus cursor position (Phase 7) — distinct from
   * `selectedNodeId`. Arrow keys move the cursor around the grid; Enter/
   * Space commits the cursor's current position as the Inspector
   * selection (the same `selectNode` path mouse click already uses, per
   * PHASE_7_ACCESSIBILITY_PERFORMANCE.md's behavior spec). Kept separate
   * from `selectedNodeId` so moving the cursor around to explore doesn't
   * change what the Inspector shows until the user explicitly commits.
   */
  cursorNodeId: NodeId | null;
}

function createUIStore() {
  let state: UIState = { selectedNodeId: null, cursorNodeId: null };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    getState(): Readonly<UIState> {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    selectNode(nodeId: NodeId | null): void {
      if (state.selectedNodeId === nodeId) return;
      state = { ...state, selectedNodeId: nodeId };
      notify();
    },

    clearSelection(): void {
      if (state.selectedNodeId === null) return;
      state = { ...state, selectedNodeId: null };
      notify();
    },

    setCursor(nodeId: NodeId | null): void {
      if (state.cursorNodeId === nodeId) return;
      state = { ...state, cursorNodeId: nodeId };
      notify();
    },
  };
}

export type UIStore = ReturnType<typeof createUIStore>;

export const uiStore: UIStore = createUIStore();

export function useUIState(): UIState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.getState);
}
