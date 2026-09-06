import { useSyncExternalStore } from "react";
import type { NodeId } from "../types/shared";

/**
 * Which alternate view (if any) occupies the main panel instead of the
 * single CanvasGrid. Refactored from two separate booleans
 * (`comparisonViewActive`/`gameViewActive`) into one discriminated field
 * when Phase 11 added a third alternate view (Chase Mode) — two booleans
 * each remembering to clear the other was already a little fragile;
 * three would have meant N*(N-1) manual exclusivity checks scattered
 * across setters. A single field with one setter (`setMainView`) makes
 * "exactly one view at a time" true by construction, not by convention.
 */
export type MainView = "canvas" | "comparison" | "game" | "chase";

/**
 * UI state (ARCHITECTURE.md §1's fifth layer): "what is the user currently
 * viewing/configuring". This is genuinely UI state, not World/Algorithm/
 * Playback state: none of these fields affect the simulation, any
 * algorithm run, or playback itself — only what's currently displayed.
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
  /** Which alternate main-panel view is showing. See `MainView` above. */
  mainView: MainView;
}

function createUIStore() {
  let state: UIState = { selectedNodeId: null, cursorNodeId: null, mainView: "canvas" };
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

    /**
     * The single place main-panel-view exclusivity is enforced — setting
     * any view replaces whichever one was showing before, so it is
     * structurally impossible for two alternate views to be active at
     * once (Phase 11 acceptance criterion).
     */
    setMainView(view: MainView): void {
      if (state.mainView === view) return;
      state = { ...state, mainView: view };
      notify();
    },
  };
}

export type UIStore = ReturnType<typeof createUIStore>;

export const uiStore: UIStore = createUIStore();

export function useUIState(): UIState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.getState);
}
