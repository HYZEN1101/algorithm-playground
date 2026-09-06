import { describe, it, expect } from "vitest";
import { Grid } from "../../src/world/grid";
import { TerrainType } from "../../src/world/terrain";
import { computeGhostStep, computePlayerMove } from "../../src/game/chaseEngine";

describe("computeGhostStep", () => {
  it("moves the ghost one cell closer to the player on an open grid", () => {
    const grid = new Grid(5, 5, TerrainType.Road);
    const ghostPos = grid.idOf(0, 0);
    const playerPos = grid.idOf(0, 4);

    const next = computeGhostStep(grid, ghostPos, playerPos, "bfs");

    // Should be an immediate neighbor of the ghost's starting cell, and
    // strictly closer (by Manhattan distance) to the player than before.
    expect(grid.neighbors(ghostPos, false)).toContain(next);
    const distBefore = Math.abs(0 - 0) + Math.abs(0 - 4);
    const { row, col } = grid.coordOf(next);
    const distAfter = Math.abs(row - 0) + Math.abs(col - 4);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("returns the ghost's unchanged position when it is already on the player's cell", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    const pos = grid.idOf(1, 1);
    expect(computeGhostStep(grid, pos, pos, "astar")).toBe(pos);
  });

  it("returns the ghost's unchanged position when fully walled off from the player (never throws)", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    // Wall off the middle row entirely, splitting the grid top/bottom.
    grid.setTerrain(grid.idOf(1, 0), TerrainType.Wall);
    grid.setTerrain(grid.idOf(1, 1), TerrainType.Wall);
    grid.setTerrain(grid.idOf(1, 2), TerrainType.Wall);

    const ghostPos = grid.idOf(0, 0);
    const playerPos = grid.idOf(2, 2);

    expect(() => computeGhostStep(grid, ghostPos, playerPos, "dijkstra")).not.toThrow();
    expect(computeGhostStep(grid, ghostPos, playerPos, "dijkstra")).toBe(ghostPos);
  });

  it("works identically across all four algorithms on a trivial one-step case", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    const ghostPos = grid.idOf(1, 1);
    const playerPos = grid.idOf(1, 2);

    for (const algorithm of ["bfs", "dfs", "dijkstra", "astar"] as const) {
      expect(computeGhostStep(grid, ghostPos, playerPos, algorithm)).toBe(playerPos);
    }
  });
});

describe("computePlayerMove", () => {
  it("moves into a passable neighboring cell", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    const pos = grid.idOf(1, 1);
    expect(computePlayerMove(grid, pos, "up")).toBe(grid.idOf(0, 1));
    expect(computePlayerMove(grid, pos, "down")).toBe(grid.idOf(2, 1));
    expect(computePlayerMove(grid, pos, "left")).toBe(grid.idOf(1, 0));
    expect(computePlayerMove(grid, pos, "right")).toBe(grid.idOf(1, 2));
  });

  it("returns the unchanged position when the move would go out of bounds", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    const corner = grid.idOf(0, 0);
    expect(computePlayerMove(grid, corner, "up")).toBe(corner);
    expect(computePlayerMove(grid, corner, "left")).toBe(corner);
  });

  it("returns the unchanged position when the move would enter a wall", () => {
    const grid = new Grid(3, 3, TerrainType.Road);
    const pos = grid.idOf(1, 1);
    grid.setTerrain(grid.idOf(0, 1), TerrainType.Wall);
    expect(computePlayerMove(grid, pos, "up")).toBe(pos);
  });
});
