import { useSyncExternalStore } from "react";
import { Grid } from "../world/grid";
import type { WorldConfig } from "../world/grid";
import { TerrainType } from "../world/terrain";
import { generate as generateRandomObstacles } from "../world/generators/randomObstacles";
import type { NodeId } from "../types/shared";

// Re-exported per PHASE_1_FOUNDATION.md's handoff note: Phase 1 defined
// WorldConfig in grid.ts and asked Phase 2 to re-export it from here rather
// than duplicate the definition.
export type { WorldConfig };

export const DEFAULT_GRID_WIDTH = 100;
export const DEFAULT_GRID_HEIGHT = 100;
// Not exposed as UI in Phase 2 (no density slider was specified) — fixed
// constant used by the Generate button. Revisit if a later phase adds a
// density control.
const DEFAULT_DENSITY = 0.22;

export type Tool = { kind: "paint"; terrain: TerrainType } | { kind: "move-start" } | { kind: "move-goal" };

/**
 * Describes what changed on a given store update, so subscribers that care
 * about visual cost (the renderer) can redraw only what's necessary instead
 * of the whole grid on every edit. This was added after real-browser
 * testing showed the original "just notify, always full-redraw" design was
 * unusably slow while drag-painting (~10,000-cell redraw per pointermove-
 * driven frame on the default 100x100 grid) — not a premature optimization,
 * a fix for a genuine correctness/usability bug found in manual testing.
 *   - "cells": only these specific cells' visuals need to be repainted
 *     (terrain edits, or start/goal moving — the old AND new cell both need
 *     repainting so the marker visually moves).
 *   - "full": the whole grid was replaced (Generate, Clear) — a full redraw
 *     is unavoidable and appropriate here, this doesn't happen during
 *     rapid interaction.
 *   - "none": state changed but nothing visual needs to be redrawn (e.g.
 *     the active tool) — still notifies React (for cursor styling etc.) but
 *     the renderer does nothing with it.
 */
export type WorldChange = { kind: "cells"; ids: NodeId[] } | { kind: "full" } | { kind: "none" };

export interface WorldState {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
  seed: number;
  activeTool: Tool;
}

function defaultStartGoal(width: number, height: number): { start: NodeId; goal: NodeId } {
  const row = Math.floor(height / 2);
  return {
    start: row * width + 1,
    goal: row * width + (width - 2),
  };
}

/**
 * Finds the nearest passable cell to `fromId` by expanding Chebyshev rings
 * (a small self-contained search, not a pathfinding algorithm — Phase 3+'s
 * BFS/DFS/Dijkstra/A* don't exist yet and this isn't meant to become one).
 * Used only when start/goal end up on a wall after regenerating the world.
 */
function findNearestPassable(grid: Grid, fromId: NodeId): NodeId {
  if (grid.isPassable(fromId)) return fromId;

  const { row: fromRow, col: fromCol } = grid.coordOf(fromId);
  const maxRadius = Math.max(grid.width, grid.height);

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        // Only check the ring boundary, not cells already checked at a
        // smaller radius.
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
        const row = fromRow + dr;
        const col = fromCol + dc;
        if (!grid.inBounds(row, col)) continue;
        const id = grid.idOf(row, col);
        if (grid.isPassable(id)) return id;
      }
    }
  }
  // Every cell was a wall (density=1 edge case) — fall back to the
  // original id; caller (generateRandom) guards against this in practice
  // since density=1 is a valid but extreme input.
  return fromId;
}

/** Bresenham line over grid cells, used to fill gaps during drag-painting. */
export function lineCells(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  let row = fromRow;
  let col = fromCol;
  const dRow = Math.abs(toRow - fromRow);
  const dCol = Math.abs(toCol - fromCol);
  const sRow = fromRow < toRow ? 1 : -1;
  const sCol = fromCol < toCol ? 1 : -1;
  let err = dCol - dRow;

  // Safety bound: a line can never legitimately need more steps than the
  // Chebyshev distance + 1; this just prevents a pathological infinite loop
  // if the arithmetic above is ever wrong for some edge case.
  const maxSteps = dRow + dCol + 2;
  for (let steps = 0; steps <= maxSteps; steps++) {
    cells.push({ row, col });
    if (row === toRow && col === toCol) break;
    const e2 = 2 * err;
    if (e2 > -dRow) {
      err -= dRow;
      col += sCol;
    }
    if (e2 < dCol) {
      err += dCol;
      row += sRow;
    }
  }
  return cells;
}

function createWorldStore() {
  const width = DEFAULT_GRID_WIDTH;
  const height = DEFAULT_GRID_HEIGHT;
  // Time-based, not Math.random() — deliberately avoids the one RNG
  // exception discussion entirely. This is just a friendly-looking arbitrary
  // starting seed for the UI's seed input; it is not used anywhere that
  // needs to be reproducible independent of user action. All actual world
  // generation still goes exclusively through the seeded mulberry32-based
  // generate() function (ARCHITECTURE.md §13).
  const initialSeed = Date.now() % 1_000_000;
  const { start, goal } = defaultStartGoal(width, height);

  let state: WorldState = {
    // Auto-generate on first load rather than an all-Road grid, so the app
    // demonstrates something immediately (still exclusively via the same
    // seeded generate() the Generate button calls — no extra scope).
    grid: generateRandomObstacles(initialSeed, width, height, DEFAULT_DENSITY),
    start,
    goal,
    seed: initialSeed,
    activeTool: { kind: "paint", terrain: TerrainType.Wall },
  };

  const listeners = new Set<(change: WorldChange) => void>();
  const notify = (change: WorldChange) => listeners.forEach((l) => l(change));

  function setState(next: WorldState, change: WorldChange): void {
    state = next;
    notify(change);
  }

  return {
    getState(): Readonly<WorldState> {
      return state;
    },

    subscribe(listener: (change: WorldChange) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setActiveTool(tool: Tool): void {
      setState({ ...state, activeTool: tool }, { kind: "none" });
    },

    /** Paints a single cell. No-op if the cell already has that terrain (avoids redundant notifications). */
    paintCell(id: NodeId, terrain: TerrainType): void {
      if (state.grid.terrainAt(id) === terrain) return;
      // Grid mutates in place (it's not treated as immutable data — only
      // AlgorithmResult snapshots need immutability, per ARCHITECTURE.md
      // §4); we still swap the state object so subscribers are notified.
      state.grid.setTerrain(id, terrain);
      setState({ ...state }, { kind: "cells", ids: [id] });
    },

    /** Paints every cell along the line between two cells, for continuous drag-painting. */
    paintLine(fromRow: number, fromCol: number, toRow: number, toCol: number, terrain: TerrainType): void {
      const cells = lineCells(fromRow, fromCol, toRow, toCol);
      const changedIds: NodeId[] = [];
      for (const { row, col } of cells) {
        if (!state.grid.inBounds(row, col)) continue;
        const id = state.grid.idOf(row, col);
        if (state.grid.terrainAt(id) !== terrain) {
          state.grid.setTerrain(id, terrain);
          changedIds.push(id);
        }
      }
      if (changedIds.length > 0) setState({ ...state }, { kind: "cells", ids: changedIds });
    },

    /**
     * Moves start to `id` if passable. Silently ignored (not applied) if the
     * target is a wall — this IS the "snap back" behavior: the store simply
     * never commits an invalid position, so the last valid one stays
     * displayed. No separate drag-preview state needed.
     */
    moveStart(id: NodeId): boolean {
      if (!state.grid.isPassable(id)) return false;
      const previous = state.start;
      setState({ ...state, start: id }, { kind: "cells", ids: [previous, id] });
      return true;
    },

    moveGoal(id: NodeId): boolean {
      if (!state.grid.isPassable(id)) return false;
      const previous = state.goal;
      setState({ ...state, goal: id }, { kind: "cells", ids: [previous, id] });
      return true;
    },

    /**
     * Replaces the grid via the Phase 1 seeded generator. Preserves
     * start/goal if they're still passable on the new grid; otherwise
     * relocates each to its nearest passable cell.
     */
    generateRandom(seed: number, density: number = DEFAULT_DENSITY): void {
      const grid = generateRandomObstacles(seed, state.grid.width, state.grid.height, density);
      const start = findNearestPassable(grid, state.start);
      const goal = findNearestPassable(grid, state.goal);
      setState({ ...state, grid, start, goal, seed }, { kind: "full" });
    },

    /** Resets to an all-Road grid of the same dimensions. */
    clear(): void {
      const grid = new Grid(state.grid.width, state.grid.height, TerrainType.Road);
      setState({ ...state, grid }, { kind: "full" });
    },
  };
}

export type WorldStore = ReturnType<typeof createWorldStore>;

// Singleton instance shared across the app — matches the pattern
// ARCHITECTURE.md §7 describes for PlaybackController: a plain,
// framework-agnostic object that Canvas can subscribe to directly, plus a
// thin React hook wrapper below.
export const worldStore: WorldStore = createWorldStore();

export function useWorldState(): WorldState {
  return useSyncExternalStore(worldStore.subscribe, worldStore.getState);
}
