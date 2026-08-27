import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  worldStore,
  lineCells,
  clampGridDimension,
  DEFAULT_GRID_WIDTH,
  DEFAULT_GRID_HEIGHT,
  MIN_GRID_DIMENSION,
  MAX_GRID_DIMENSION,
} from "../../src/state/worldStore";
import { TerrainType } from "../../src/world/terrain";
import { Grid } from "../../src/world/grid";

// worldStore is a singleton (matches PlaybackController's pattern in
// ARCHITECTURE.md §7), so tests reset relevant pieces of it explicitly
// rather than constructing a fresh instance per test.
function resetToAllRoad(): void {
  worldStore.clear();
}

describe("worldStore", () => {
  beforeEach(() => {
    resetToAllRoad();
  });

  it("has a grid matching the default dimensions", () => {
    const { grid } = worldStore.getState();
    expect(grid.width).toBe(DEFAULT_GRID_WIDTH);
    expect(grid.height).toBe(DEFAULT_GRID_HEIGHT);
  });

  it("starts with valid, distinct, passable start/goal cells", () => {
    const { grid, start, goal } = worldStore.getState();
    expect(grid.isPassable(start)).toBe(true);
    expect(grid.isPassable(goal)).toBe(true);
    expect(start).not.toBe(goal);
  });

  describe("setActiveTool", () => {
    it("updates the active tool and notifies subscribers", () => {
      let notified = false;
      const unsubscribe = worldStore.subscribe(() => {
        notified = true;
      });
      worldStore.setActiveTool({ kind: "move-start" });
      unsubscribe();
      expect(notified).toBe(true);
      expect(worldStore.getState().activeTool).toEqual({ kind: "move-start" });
    });
  });

  describe("paintCell", () => {
    it("updates the terrain at the given cell", () => {
      const { grid } = worldStore.getState();
      const id = grid.idOf(5, 5);
      worldStore.paintCell(id, TerrainType.Wall);
      expect(worldStore.getState().grid.terrainAt(id)).toBe(TerrainType.Wall);
    });

    it("does not notify subscribers if the terrain is unchanged", () => {
      const { grid } = worldStore.getState();
      const id = grid.idOf(2, 2);
      worldStore.paintCell(id, TerrainType.Road); // already Road after clear()
      let notified = false;
      const unsubscribe = worldStore.subscribe(() => {
        notified = true;
      });
      worldStore.paintCell(id, TerrainType.Road);
      unsubscribe();
      expect(notified).toBe(false);
    });
  });

  describe("paintLine", () => {
    it("paints every cell along a straight horizontal line", () => {
      worldStore.paintLine(3, 1, 3, 5, TerrainType.Wall);
      const { grid } = worldStore.getState();
      for (let col = 1; col <= 5; col++) {
        expect(grid.terrainAt(grid.idOf(3, col))).toBe(TerrainType.Wall);
      }
    });

    it("paints a continuous diagonal line with no gaps", () => {
      worldStore.paintLine(0, 0, 4, 4, TerrainType.Wall);
      const { grid } = worldStore.getState();
      // every step along the diagonal should be painted (a naive
      // "just paint the two endpoints" bug would fail this)
      for (let i = 0; i <= 4; i++) {
        expect(grid.terrainAt(grid.idOf(i, i))).toBe(TerrainType.Wall);
      }
    });

    it("ignores out-of-bounds cells along the line without throwing", () => {
      expect(() => worldStore.paintLine(-2, -2, 2, 2, TerrainType.Wall)).not.toThrow();
    });
  });

  describe("moveStart / moveGoal", () => {
    it("moves start to a passable cell and returns true", () => {
      const { grid } = worldStore.getState();
      const target = grid.idOf(10, 10);
      const result = worldStore.moveStart(target);
      expect(result).toBe(true);
      expect(worldStore.getState().start).toBe(target);
    });

    it("refuses to move start onto a wall (snap-back) and returns false", () => {
      const before = worldStore.getState();
      const wallId = before.grid.idOf(8, 8);
      worldStore.paintCell(wallId, TerrainType.Wall);

      const result = worldStore.moveStart(wallId);
      expect(result).toBe(false);
      expect(worldStore.getState().start).toBe(before.start); // unchanged
    });

    it("moves goal to a passable cell and returns true", () => {
      const { grid } = worldStore.getState();
      const target = grid.idOf(12, 12);
      const result = worldStore.moveGoal(target);
      expect(result).toBe(true);
      expect(worldStore.getState().goal).toBe(target);
    });

    it("refuses to move goal onto a wall (snap-back) and returns false", () => {
      const before = worldStore.getState();
      const wallId = before.grid.idOf(9, 9);
      worldStore.paintCell(wallId, TerrainType.Wall);

      const result = worldStore.moveGoal(wallId);
      expect(result).toBe(false);
      expect(worldStore.getState().goal).toBe(before.goal);
    });
  });

  describe("generateRandom", () => {
    it("is deterministic for the same seed (via Grid.equals())", () => {
      worldStore.generateRandom(777, 0.3);
      const a = worldStore.getState().grid;
      worldStore.generateRandom(777, 0.3);
      const b = worldStore.getState().grid;
      expect(a.equals(b)).toBe(true);
    });

    it("updates the stored seed", () => {
      worldStore.generateRandom(4242, 0.2);
      expect(worldStore.getState().seed).toBe(4242);
    });

    it("relocates start/goal to a passable cell if the generated grid walls them in", () => {
      // Force start onto a specific cell, then generate with density=1 so
      // every cell becomes a wall except we can't guarantee any passable
      // cell exists at all in that extreme case — use a high-but-not-total
      // density instead so relocation has somewhere to go, and directly
      // assert the *result* is always passable (the meaningful contract).
      worldStore.generateRandom(1, 0.9);
      const { grid, start, goal } = worldStore.getState();
      expect(grid.isPassable(start)).toBe(true);
      expect(grid.isPassable(goal)).toBe(true);
    });
  });

  describe("clear", () => {
    it("resets every cell to Road", () => {
      worldStore.paintCell(worldStore.getState().grid.idOf(1, 1), TerrainType.Wall);
      worldStore.clear();
      const { grid } = worldStore.getState();
      for (let row = 0; row < grid.height; row++) {
        for (let col = 0; col < grid.width; col++) {
          expect(grid.terrainAt(grid.idOf(row, col))).toBe(TerrainType.Road);
        }
      }
    });

    it("preserves grid dimensions", () => {
      worldStore.clear();
      const { grid } = worldStore.getState();
      expect(grid.width).toBe(DEFAULT_GRID_WIDTH);
      expect(grid.height).toBe(DEFAULT_GRID_HEIGHT);
    });
  });
});

describe("lineCells", () => {
  it("returns a single cell when start equals end", () => {
    expect(lineCells(3, 3, 3, 3)).toEqual([{ row: 3, col: 3 }]);
  });

  it("produces a contiguous horizontal line", () => {
    const cells = lineCells(0, 0, 0, 3);
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]);
  });

  it("produces a contiguous vertical line", () => {
    const cells = lineCells(0, 0, 3, 0);
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
    ]);
  });

  it("produces a contiguous diagonal line with no gaps", () => {
    const cells = lineCells(0, 0, 3, 3);
    // Every consecutive pair must be adjacent (Chebyshev distance 1) —
    // this is the property that actually matters for gap-free painting.
    for (let i = 1; i < cells.length; i++) {
      const dr = Math.abs(cells[i].row - cells[i - 1].row);
      const dc = Math.abs(cells[i].col - cells[i - 1].col);
      expect(Math.max(dr, dc)).toBe(1);
    }
    expect(cells[0]).toEqual({ row: 0, col: 0 });
    expect(cells[cells.length - 1]).toEqual({ row: 3, col: 3 });
  });

  it("handles a shallow, non-45-degree diagonal without gaps", () => {
    const cells = lineCells(0, 0, 2, 8);
    for (let i = 1; i < cells.length; i++) {
      const dr = Math.abs(cells[i].row - cells[i - 1].row);
      const dc = Math.abs(cells[i].col - cells[i - 1].col);
      expect(Math.max(dr, dc)).toBe(1);
    }
  });
});

describe("worldStore change notifications (drives partial vs full canvas redraws)", () => {
  beforeEach(() => {
    resetToAllRoad();
  });

  function captureChanges(fn: () => void) {
    const changes: unknown[] = [];
    const unsubscribe = worldStore.subscribe((change) => changes.push(change));
    fn();
    unsubscribe();
    return changes;
  }

  it("setActiveTool notifies with kind='none' (no canvas redraw needed)", () => {
    const changes = captureChanges(() => worldStore.setActiveTool({ kind: "move-start" }));
    expect(changes).toEqual([{ kind: "none" }]);
  });

  it("paintCell notifies with kind='cells' containing exactly the painted id", () => {
    const id = worldStore.getState().grid.idOf(4, 4);
    const changes = captureChanges(() => worldStore.paintCell(id, TerrainType.Wall));
    expect(changes).toEqual([{ kind: "cells", ids: [id] }]);
  });

  it("paintCell emits no notification at all when the terrain is unchanged", () => {
    const id = worldStore.getState().grid.idOf(4, 4); // already Road after clear()
    const changes = captureChanges(() => worldStore.paintCell(id, TerrainType.Road));
    expect(changes).toEqual([]);
  });

  it("paintLine notifies with kind='cells' containing exactly the changed ids (not the whole grid)", () => {
    const { grid } = worldStore.getState();
    const changes = captureChanges(() => worldStore.paintLine(0, 0, 0, 4, TerrainType.Wall));
    expect(changes.length).toBe(1);
    const change = changes[0] as { kind: string; ids: number[] };
    expect(change.kind).toBe("cells");
    const expectedIds = [0, 1, 2, 3, 4].map((col) => grid.idOf(0, col));
    expect([...change.ids].sort((a, b) => a - b)).toEqual(expectedIds.sort((a, b) => a - b));
  });

  it("moveStart notifies with kind='cells' containing both the old and new position", () => {
    const before = worldStore.getState();
    const target = before.grid.idOf(15, 15);
    const changes = captureChanges(() => worldStore.moveStart(target));
    expect(changes).toEqual([{ kind: "cells", ids: [before.start, target] }]);
  });

  it("moveGoal notifies with kind='cells' containing both the old and new position", () => {
    const before = worldStore.getState();
    const target = before.grid.idOf(16, 16);
    const changes = captureChanges(() => worldStore.moveGoal(target));
    expect(changes).toEqual([{ kind: "cells", ids: [before.goal, target] }]);
  });

  it("refused moveStart (onto a wall) emits no notification", () => {
    const wallId = worldStore.getState().grid.idOf(7, 7);
    worldStore.paintCell(wallId, TerrainType.Wall);
    const changes = captureChanges(() => worldStore.moveStart(wallId));
    expect(changes).toEqual([]);
  });

  it("generateRandom notifies with kind='full'", () => {
    const changes = captureChanges(() => worldStore.generateRandom(123, 0.2));
    expect(changes).toEqual([{ kind: "full" }]);
  });

  it("clear notifies with kind='full'", () => {
    const changes = captureChanges(() => worldStore.clear());
    expect(changes).toEqual([{ kind: "full" }]);
  });

  it("dragging a line of 50 cells notifies with a single batched 'cells' change, not 50 separate notifications", () => {
    // This is the actual performance property that mattered: one drag
    // gesture spanning many cells must produce ONE notification with all
    // the ids, not one notification per cell — otherwise the renderer
    // would still end up doing many separate (even if individually cheap)
    // redraw passes.
    const changes = captureChanges(() => worldStore.paintLine(0, 0, 0, 49, TerrainType.Wall));
    expect(changes.length).toBe(1);
    const change = changes[0] as { kind: string; ids: number[] };
    expect(change.ids.length).toBe(50);
  });
});

// Sanity check that Grid itself is usable here without any Phase 2 wrapper
// (documents that worldStore's core has no hidden dependency on anything
// beyond Phase 1's Grid).
describe("worldStore's dependency on Grid", () => {
  it("Grid can be constructed and used independently of worldStore", () => {
    const g = new Grid(3, 3);
    expect(g.width).toBe(3);
  });
});

describe("worldStore.resizeGrid (dynamic, user-settable grid size)", () => {
  beforeEach(() => {
    resetToAllRoad();
  });

  // worldStore is a module-level singleton shared across this whole test
  // file — resizing must not leak into later tests that assume
  // DEFAULT_GRID_WIDTH/HEIGHT, so every test in this block restores the
  // default dimensions afterward.
  afterEach(() => {
    worldStore.resizeGrid(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT);
  });

  it("changes the grid's width and height", () => {
    worldStore.resizeGrid(40, 25);
    const { grid } = worldStore.getState();
    expect(grid.width).toBe(40);
    expect(grid.height).toBe(25);
  });

  it("clamps below MIN_GRID_DIMENSION up to the minimum", () => {
    worldStore.resizeGrid(1, 1);
    const { grid } = worldStore.getState();
    expect(grid.width).toBe(MIN_GRID_DIMENSION);
    expect(grid.height).toBe(MIN_GRID_DIMENSION);
  });

  it("clamps above MAX_GRID_DIMENSION down to the maximum", () => {
    worldStore.resizeGrid(10000, 10000);
    const { grid } = worldStore.getState();
    expect(grid.width).toBe(MAX_GRID_DIMENSION);
    expect(grid.height).toBe(MAX_GRID_DIMENSION);
  });

  it("relocates start/goal to valid positions on the new (smaller) grid", () => {
    worldStore.resizeGrid(6, 6);
    const { grid, start, goal } = worldStore.getState();
    expect(grid.isPassable(start)).toBe(true);
    expect(grid.isPassable(goal)).toBe(true);
    expect(start).not.toBe(goal);
    // Both ids must actually be valid coordinates on the NEW grid — the
    // real bug this guards against: reusing an old-width-derived NodeId
    // against a resized grid produces nonsense coordinates via
    // coordOf(id), since row = Math.floor(id / newWidth) silently
    // "succeeds" with a wrong answer instead of throwing.
    const { row: startRow } = grid.coordOf(start);
    const { row: goalRow } = grid.coordOf(goal);
    expect(startRow).toBeLessThan(grid.height);
    expect(goalRow).toBeLessThan(grid.height);
  });

  it("issues a single 'full' change notification, not per-cell notifications", () => {
    const changes: unknown[] = [];
    const unsubscribe = worldStore.subscribe((change) => changes.push(change));
    worldStore.resizeGrid(20, 20);
    unsubscribe();
    expect(changes).toEqual([{ kind: "full" }]);
  });

  it("is deterministic for a fixed seed, matching generateRandom's own reproducibility guarantee", () => {
    worldStore.resizeGrid(30, 30);
    const gridA = worldStore.getState().grid;
    worldStore.resizeGrid(20, 20); // perturb dimensions (seed stays the same)
    worldStore.resizeGrid(30, 30); // back to the original dimensions, same seed
    const gridB = worldStore.getState().grid;
    expect(gridA.equals(gridB)).toBe(true);
  });
});

describe("clampGridDimension", () => {
  it("rounds and clamps into [MIN_GRID_DIMENSION, MAX_GRID_DIMENSION]", () => {
    expect(clampGridDimension(50.6)).toBe(51);
    expect(clampGridDimension(-10)).toBe(MIN_GRID_DIMENSION);
    expect(clampGridDimension(999999)).toBe(MAX_GRID_DIMENSION);
    expect(clampGridDimension(Number.NaN)).toBe(MIN_GRID_DIMENSION);
  });
});
