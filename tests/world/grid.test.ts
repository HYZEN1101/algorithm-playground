import { describe, it, expect } from "vitest";
import { Grid } from "../../src/world/grid";
import { TerrainType, TERRAIN_COST } from "../../src/world/terrain";

describe("Grid", () => {
  describe("dimensions", () => {
    it("stores width and height", () => {
      const g = new Grid(5, 3);
      expect(g.width).toBe(5);
      expect(g.height).toBe(3);
    });

    it("throws on non-positive or non-integer dimensions", () => {
      expect(() => new Grid(0, 5)).toThrow();
      expect(() => new Grid(5, 0)).toThrow();
      expect(() => new Grid(-1, 5)).toThrow();
      expect(() => new Grid(2.5, 5)).toThrow();
    });

    it("defaults every cell to Road when no fill is given", () => {
      const g = new Grid(3, 3);
      for (let id = 0; id < 9; id++) {
        expect(g.terrainAt(id)).toBe(TerrainType.Road);
      }
    });

    it("respects a custom fill terrain", () => {
      const g = new Grid(2, 2, TerrainType.Grass);
      expect(g.terrainAt(g.idOf(1, 1))).toBe(TerrainType.Grass);
    });
  });

  describe("coordinate / node ID conversion", () => {
    it("idOf and coordOf round-trip for every cell", () => {
      const g = new Grid(10, 7);
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 10; col++) {
          const id = g.idOf(row, col);
          expect(g.coordOf(id)).toEqual({ row, col });
        }
      }
    });

    it("uses row-major layout: id = row * width + col", () => {
      const g = new Grid(4, 4);
      expect(g.idOf(0, 0)).toBe(0);
      expect(g.idOf(0, 3)).toBe(3);
      expect(g.idOf(1, 0)).toBe(4);
      expect(g.idOf(2, 2)).toBe(10);
    });
  });

  describe("bounds behavior", () => {
    it("inBounds is true within range and false outside", () => {
      const g = new Grid(3, 3);
      expect(g.inBounds(0, 0)).toBe(true);
      expect(g.inBounds(2, 2)).toBe(true);
      expect(g.inBounds(-1, 0)).toBe(false);
      expect(g.inBounds(0, -1)).toBe(false);
      expect(g.inBounds(3, 0)).toBe(false);
      expect(g.inBounds(0, 3)).toBe(false);
    });

    it("terrainAt/setTerrain throw on an out-of-range NodeId", () => {
      const g = new Grid(3, 3);
      expect(() => g.terrainAt(-1)).toThrow();
      expect(() => g.terrainAt(9)).toThrow();
      expect(() => g.setTerrain(9, TerrainType.Wall)).toThrow();
      expect(() => g.setTerrain(-1, TerrainType.Wall)).toThrow();
    });
  });

  describe("terrain read/write", () => {
    it("setTerrain updates exactly the targeted cell", () => {
      const g = new Grid(3, 3);
      const target = g.idOf(1, 2);
      g.setTerrain(target, TerrainType.Water);

      expect(g.terrainAt(target)).toBe(TerrainType.Water);
      // spot-check a neighboring cell was left untouched
      expect(g.terrainAt(g.idOf(1, 1))).toBe(TerrainType.Road);
    });
  });

  describe("isPassable / costOf", () => {
    it("reflects TERRAIN_COST for non-wall terrain", () => {
      const g = new Grid(1, 1, TerrainType.Mountain);
      const id = g.idOf(0, 0);
      expect(g.isPassable(id)).toBe(true);
      expect(g.costOf(id)).toBe(TERRAIN_COST[TerrainType.Mountain]);
    });

    it("treats Wall as non-traversable (isPassable=false), not merely expensive", () => {
      const g = new Grid(1, 1, TerrainType.Wall);
      const id = g.idOf(0, 0);
      expect(g.isPassable(id)).toBe(false);
      expect(g.costOf(id)).toBe(Infinity);
    });
  });

  describe("neighbors", () => {
    it("returns all 4 in-bounds passable neighbors from an interior cell", () => {
      const g = new Grid(3, 3);
      const center = g.idOf(1, 1);
      const result = [...g.neighbors(center, false)].sort((a, b) => a - b);
      const expected = [g.idOf(0, 1), g.idOf(1, 0), g.idOf(1, 2), g.idOf(2, 1)].sort(
        (a, b) => a - b,
      );
      expect(result).toEqual(expected);
    });

    it("excludes out-of-bounds neighbors at the top-left corner", () => {
      const g = new Grid(3, 3);
      const corner = g.idOf(0, 0);
      const result = [...g.neighbors(corner, false)].sort((a, b) => a - b);
      const expected = [g.idOf(0, 1), g.idOf(1, 0)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("excludes out-of-bounds neighbors at the top-right corner", () => {
      const g = new Grid(3, 3);
      const corner = g.idOf(0, 2);
      const result = [...g.neighbors(corner, false)].sort((a, b) => a - b);
      const expected = [g.idOf(0, 1), g.idOf(1, 2)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("excludes out-of-bounds neighbors at the bottom-left corner", () => {
      const g = new Grid(3, 3);
      const corner = g.idOf(2, 0);
      const result = [...g.neighbors(corner, false)].sort((a, b) => a - b);
      const expected = [g.idOf(1, 0), g.idOf(2, 1)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("excludes out-of-bounds neighbors at the bottom-right corner", () => {
      const g = new Grid(3, 3);
      const corner = g.idOf(2, 2);
      const result = [...g.neighbors(corner, false)].sort((a, b) => a - b);
      const expected = [g.idOf(1, 2), g.idOf(2, 1)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("excludes out-of-bounds neighbors along a non-corner edge cell", () => {
      const g = new Grid(3, 3);
      const edge = g.idOf(0, 1); // top edge, not a corner
      const result = [...g.neighbors(edge, false)].sort((a, b) => a - b);
      const expected = [g.idOf(0, 0), g.idOf(0, 2), g.idOf(1, 1)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("excludes wall neighbors even when they are in bounds", () => {
      const g = new Grid(3, 3);
      const center = g.idOf(1, 1);
      g.setTerrain(g.idOf(0, 1), TerrainType.Wall);
      const result = [...g.neighbors(center, false)].sort((a, b) => a - b);
      const expected = [g.idOf(1, 0), g.idOf(1, 2), g.idOf(2, 1)].sort((a, b) => a - b);
      expect(result).toEqual(expected);
    });

    it("includes diagonal neighbors only when diagonals=true", () => {
      const g = new Grid(3, 3);
      const center = g.idOf(1, 1);
      expect(g.neighbors(center, false).length).toBe(4);
      expect(g.neighbors(center, true).length).toBe(8);
    });

    it("on a 1x1 grid, a cell has no neighbors regardless of diagonals", () => {
      const g = new Grid(1, 1);
      const only = g.idOf(0, 0);
      expect(g.neighbors(only, false)).toEqual([]);
      expect(g.neighbors(only, true)).toEqual([]);
    });
  });

  describe("clone", () => {
    it("produces a grid equal to the original", () => {
      const g = new Grid(4, 4);
      g.setTerrain(g.idOf(2, 2), TerrainType.Water);
      const copy = g.clone();
      expect(copy.equals(g)).toBe(true);
    });

    it("is independent: mutating the clone does not affect the original", () => {
      const g = new Grid(4, 4);
      const copy = g.clone();
      copy.setTerrain(copy.idOf(0, 0), TerrainType.Wall);

      expect(copy.equals(g)).toBe(false);
      expect(g.terrainAt(g.idOf(0, 0))).toBe(TerrainType.Road);
    });
  });

  describe("equals", () => {
    it("returns true for two grids with identical dimensions and terrain", () => {
      const a = new Grid(5, 5);
      const b = new Grid(5, 5);
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when terrain differs", () => {
      const a = new Grid(5, 5);
      const b = new Grid(5, 5);
      b.setTerrain(b.idOf(0, 0), TerrainType.Wall);
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when dimensions differ", () => {
      const a = new Grid(5, 5);
      const b = new Grid(5, 6);
      expect(a.equals(b)).toBe(false);
    });

    it("is reflexive", () => {
      const a = new Grid(3, 3, TerrainType.Grass);
      expect(a.equals(a)).toBe(true);
    });
  });
});
