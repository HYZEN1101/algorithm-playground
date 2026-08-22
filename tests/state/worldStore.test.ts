import { describe, it, expect, beforeEach } from "vitest";
import { worldStore, lineCells, DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from "../../src/state/worldStore";
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

// Sanity check that Grid itself is usable here without any Phase 2 wrapper
// (documents that worldStore's core has no hidden dependency on anything
// beyond Phase 1's Grid).
describe("worldStore's dependency on Grid", () => {
  it("Grid can be constructed and used independently of worldStore", () => {
    const g = new Grid(3, 3);
    expect(g.width).toBe(3);
  });
});
