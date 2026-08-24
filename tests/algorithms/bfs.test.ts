import { describe, it, expect } from "vitest";
import { bfs } from "../../src/algorithms/pathfinding/bfs";
import { Grid } from "../../src/world/grid";
import { TerrainType } from "../../src/world/terrain";
import { generate as generateRandomObstacles } from "../../src/world/generators/randomObstacles";
import type { PathfindingInput } from "../../src/algorithms/pathfinding/types";

function input(grid: Grid, start: number, goal: number): PathfindingInput {
  return { grid, start, goal, diagonals: false };
}

/** Brute-force BFS distance check, independent of the implementation under test. */
function bruteForceDistance(grid: Grid, start: number, goal: number): number | null {
  if (start === goal) return 0;
  const visited = new Set<number>([start]);
  const queue: Array<{ id: number; dist: number }> = [{ id: start, dist: 0 }];
  let head = 0;
  while (head < queue.length) {
    const { id, dist } = queue[head++];
    for (const n of grid.neighbors(id, false)) {
      if (visited.has(n)) continue;
      if (n === goal) return dist + 1;
      visited.add(n);
      queue.push({ id: n, dist: dist + 1 });
    }
  }
  return null;
}

function assertValidPath(grid: Grid, path: number[], start: number, goal: number): void {
  expect(path[0]).toBe(start);
  expect(path[path.length - 1]).toBe(goal);
  for (const id of path) {
    expect(grid.isPassable(id)).toBe(true);
  }
  for (let i = 1; i < path.length; i++) {
    const neighbors = grid.neighbors(path[i - 1], false);
    expect(neighbors).toContain(path[i]);
  }
}

describe("bfs", () => {
  it("finds a valid path when one exists", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("reports no path when the goal is unreachable", () => {
    const grid = new Grid(5, 5);
    // Wall off an entire row, splitting the grid in two.
    for (let col = 0; col < 5; col++) {
      grid.setTerrain(grid.idOf(2, col), TerrainType.Wall);
    }
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("start equals goal: path=[start], length=0, cost=0", () => {
    const grid = new Grid(5, 5);
    const id = grid.idOf(2, 2);
    const result = bfs(input(grid, id, id));

    expect(result.pathFound).toBe(true);
    expect(result.path).toEqual([id]);
    expect(result.pathLength).toBe(0);
    expect(result.pathCost).toBe(0);
  });

  it("blocked start: immediate no-path, start never relocated", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(1, 1);
    grid.setTerrain(start, TerrainType.Wall);
    const goal = grid.idOf(4, 4);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.nodesExplored).toBe(0);
  });

  it("blocked goal: immediate no-path, goal never relocated", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(3, 3);
    grid.setTerrain(goal, TerrainType.Wall);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.nodesExplored).toBe(0);
  });

  it("works on a 1x1 grid (start equals goal necessarily)", () => {
    const grid = new Grid(1, 1);
    const only = grid.idOf(0, 0);
    const result = bfs(input(grid, only, only));

    expect(result.pathFound).toBe(true);
    expect(result.path).toEqual([only]);
  });

  it("works on a 2x2 grid", () => {
    const grid = new Grid(2, 2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(1, 1);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
    expect(result.pathLength).toBe(2); // (0,0)->(0,1)->(1,1) or (0,0)->(1,0)->(1,1)
  });

  it("terminates and returns a valid result on a large (200x200) grid within a reasonable time", () => {
    const grid = generateRandomObstacles(2024, 200, 200, 0.2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(199, 199);

    const t0 = performance.now();
    const result = bfs(input(grid, start, goal));
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000); // generous budget, not a strict perf gate
    if (result.pathFound) {
      assertValidPath(grid, result.path, start, goal);
    } else {
      expect(result.path).toEqual([]);
    }
  });

  it("finds a valid, optimal-length path when multiple optimal paths exist (open grid, symmetric)", () => {
    // An open grid has many equally-short paths between diagonal corners;
    // assert validity + optimal length, not a specific path (Ambiguity #3).
    const grid = new Grid(6, 6);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(5, 5);
    const result = bfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
    const trueDistance = bruteForceDistance(grid, start, goal);
    expect(result.pathLength).toBe(trueDistance);
  });

  it("is deterministic across repeated runs on a fixed seeded world", () => {
    const grid = generateRandomObstacles(555, 20, 20, 0.25);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(19, 19);

    const first = bfs(input(grid, start, goal));
    const second = bfs(input(grid, start, goal));

    expect(second.pathFound).toBe(first.pathFound);
    expect(second.path).toEqual(first.path);
    expect(second.pathLength).toBe(first.pathLength);
    expect(second.pathCost).toBe(first.pathCost);
    expect(second.nodesExplored).toBe(first.nodesExplored);
  });

  describe("BFS-specific", () => {
    it("pathLength equals pathCost on an unweighted grid (uniform cost)", () => {
      const grid = new Grid(8, 8);
      const start = grid.idOf(0, 0);
      const goal = grid.idOf(7, 7);
      const result = bfs(input(grid, start, goal));

      expect(result.pathCost).toBe(result.pathLength);
    });

    it("finds the provably shortest path, verified against a brute-force BFS distance check", () => {
      // A maze with exactly one route forces an unambiguous shortest length.
      const grid = new Grid(5, 5, TerrainType.Wall);
      // Carve an S-shaped single-width corridor.
      const corridor: Array<[number, number]> = [
        [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
        [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0],
        [3, 0], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
      ];
      for (const [row, col] of corridor) {
        grid.setTerrain(grid.idOf(row, col), TerrainType.Road);
      }
      const start = grid.idOf(0, 0);
      const goal = grid.idOf(4, 4);
      const result = bfs(input(grid, start, goal));

      expect(result.pathFound).toBe(true);
      const trueDistance = bruteForceDistance(grid, start, goal);
      expect(result.pathLength).toBe(trueDistance);
      assertValidPath(grid, result.path, start, goal);
    });

    it("never emits UPDATE_SCORES (that's A*-only, Phase 4)", () => {
      const grid = new Grid(5, 5);
      const result = bfs(input(grid, grid.idOf(0, 0), grid.idOf(4, 4)));
      expect(result.events.some((e) => e.type === "UPDATE_SCORES")).toBe(false);
    });
  });
});
