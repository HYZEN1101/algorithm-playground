import { describe, it, expect } from "vitest";
import { dijkstra } from "../../src/algorithms/pathfinding/dijkstra";
import { bfs } from "../../src/algorithms/pathfinding/bfs";
import { Grid } from "../../src/world/grid";
import { TerrainType } from "../../src/world/terrain";
import { generate as generateRandomObstacles } from "../../src/world/generators/randomObstacles";
import type { PathfindingInput } from "../../src/algorithms/pathfinding/types";

function input(grid: Grid, start: number, goal: number): PathfindingInput {
  return { grid, start, goal, diagonals: false };
}

function assertValidPath(grid: Grid, path: number[], start: number, goal: number): void {
  expect(path[0]).toBe(start);
  expect(path[path.length - 1]).toBe(goal);
  for (const id of path) {
    expect(grid.isPassable(id)).toBe(true);
  }
  for (let i = 1; i < path.length; i++) {
    expect(grid.neighbors(path[i - 1], false)).toContain(path[i]);
  }
}

/** Brute-force shortest-cost check, independent of the implementation under test. */
function bruteForceCost(grid: Grid, start: number, goal: number): number | null {
  if (start === goal) return 0;
  const dist = new Map<number, number>([[start, 0]]);
  const pq: Array<{ id: number; cost: number }> = [{ id: start, cost: 0 }];
  const settled = new Set<number>();
  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { id, cost } = pq.shift()!;
    if (settled.has(id)) continue;
    settled.add(id);
    if (id === goal) return cost;
    for (const n of grid.neighbors(id, false)) {
      if (settled.has(n)) continue;
      const next = cost + grid.costOf(n);
      if (dist.get(n) === undefined || next < (dist.get(n) as number)) {
        dist.set(n, next);
        pq.push({ id: n, cost: next });
      }
    }
  }
  return null;
}

describe("dijkstra", () => {
  it("finds a valid path when one exists", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const result = dijkstra(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("reports no path when the goal is unreachable", () => {
    const grid = new Grid(5, 5);
    for (let col = 0; col < 5; col++) {
      grid.setTerrain(grid.idOf(2, col), TerrainType.Wall);
    }
    const result = dijkstra(input(grid, grid.idOf(0, 0), grid.idOf(4, 4)));

    expect(result.pathFound).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("start equals goal: path=[start], length=0, cost=0", () => {
    const grid = new Grid(5, 5);
    const id = grid.idOf(2, 2);
    const result = dijkstra(input(grid, id, id));

    expect(result.pathFound).toBe(true);
    expect(result.path).toEqual([id]);
    expect(result.pathLength).toBe(0);
    expect(result.pathCost).toBe(0);
  });

  it("blocked start: immediate no-path, start never relocated", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(1, 1);
    grid.setTerrain(start, TerrainType.Wall);
    const result = dijkstra(input(grid, start, grid.idOf(4, 4)));

    expect(result.pathFound).toBe(false);
    expect(result.nodesExplored).toBe(0);
  });

  it("blocked goal: immediate no-path, goal never relocated", () => {
    const grid = new Grid(5, 5);
    const goal = grid.idOf(3, 3);
    grid.setTerrain(goal, TerrainType.Wall);
    const result = dijkstra(input(grid, grid.idOf(0, 0), goal));

    expect(result.pathFound).toBe(false);
    expect(result.nodesExplored).toBe(0);
  });

  it("works on a 1x1 grid", () => {
    const grid = new Grid(1, 1);
    const only = grid.idOf(0, 0);
    const result = dijkstra(input(grid, only, only));
    expect(result.pathFound).toBe(true);
    expect(result.path).toEqual([only]);
  });

  it("works on a 2x2 grid", () => {
    const grid = new Grid(2, 2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(1, 1);
    const result = dijkstra(input(grid, start, goal));
    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("terminates and returns a valid result on a large (200x200) grid within a reasonable time", () => {
    const grid = generateRandomObstacles(2024, 200, 200, 0.2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(199, 199);

    const t0 = performance.now();
    const result = dijkstra(input(grid, start, goal));
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(3000); // generous budget, not a strict perf gate
    if (result.pathFound) {
      assertValidPath(grid, result.path, start, goal);
    } else {
      expect(result.path).toEqual([]);
    }
  });

  it("finds the optimal-cost path when multiple optimal paths exist (open uniform-cost grid)", () => {
    const grid = new Grid(6, 6);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(5, 5);
    const result = dijkstra(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
    const trueCost = bruteForceCost(grid, start, goal);
    expect(result.pathCost).toBe(trueCost);
  });

  it("is deterministic across repeated runs on a fixed seeded world", () => {
    const grid = generateRandomObstacles(555, 20, 20, 0.25);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(19, 19);

    const first = dijkstra(input(grid, start, goal));
    const second = dijkstra(input(grid, start, goal));

    expect(second.pathFound).toBe(first.pathFound);
    expect(second.path).toEqual(first.path);
    expect(second.pathCost).toBe(first.pathCost);
    expect(second.nodesExplored).toBe(first.nodesExplored);
  });

  it("prefers the cheaper longer-by-length route over the geometrically shorter expensive route (guideline §8)", () => {
    // 3-row corridor: the direct route crosses Mountain (cost 20); a
    // longer detour around stays on Road (cost 1) the whole way.
    const grid = new Grid(5, 3, TerrainType.Wall);
    const carve = (row: number, col: number, terrain: TerrainType = TerrainType.Road) =>
      grid.setTerrain(grid.idOf(row, col), terrain);

    // Direct route: straight across row 1, through an expensive cell.
    // 4 steps: (1,0)->(1,1)Mountain->(1,2)->(1,3)->(1,4), cost = 20+1+1+1 = 23.
    carve(1, 0);
    carve(1, 1, TerrainType.Mountain);
    carve(1, 2);
    carve(1, 3);
    carve(1, 4);

    // Detour route: down to row 2, across, back up — all Road, 6 steps, cost 6.
    carve(0, 0);
    carve(2, 0);
    carve(2, 1);
    carve(2, 2);
    carve(2, 3);
    carve(2, 4);

    const start = grid.idOf(1, 0);
    const goal = grid.idOf(1, 4);
    const result = dijkstra(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    // The chosen path must avoid the Mountain cell entirely...
    expect(result.path).not.toContain(grid.idOf(1, 1));
    // ...taking the geometrically LONGER route (6 steps, not the direct 4)...
    expect(result.pathLength).toBeGreaterThan(4);
    // ...because it's cheaper overall than the direct route would have been
    // (direct route cost = 20+1+1+1 = 23; this directly tests the
    // guideline §8 requirement that a visualization must never imply
    // shorter-geometric = cheaper).
    expect(result.pathCost).toBeLessThan(23);
    expect(result.pathCost).toBe(6);
  });

  it("with all-uniform terrain cost, produces the same path cost as BFS's path length on the same map", () => {
    const grid = generateRandomObstacles(42, 15, 15, 0.2); // walls + Road only, all uniform cost=1
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(14, 14);

    const dijkstraResult = dijkstra(input(grid, start, goal));
    const bfsResult = bfs(input(grid, start, goal));

    expect(dijkstraResult.pathFound).toBe(bfsResult.pathFound);
    if (dijkstraResult.pathFound) {
      expect(dijkstraResult.pathCost).toBe(bfsResult.pathLength);
    }
  });

  it("never emits UPDATE_SCORES (that's A*-only)", () => {
    const grid = new Grid(5, 5);
    const result = dijkstra(input(grid, grid.idOf(0, 0), grid.idOf(4, 4)));
    expect(result.events.some((e) => e.type === "UPDATE_SCORES")).toBe(false);
  });
});
