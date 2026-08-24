import { describe, it, expect } from "vitest";
import { dfs } from "../../src/algorithms/pathfinding/dfs";
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
    const neighbors = grid.neighbors(path[i - 1], false);
    expect(neighbors).toContain(path[i]);
  }
}

/**
 * Hand-built maze forcing DFS's directional bias (Grid.neighbors' fixed
 * up/down/left/right order, explored LIFO — so "right" is tried before
 * "down" whenever both are available) into a long detour before it finds
 * the goal, while the TRUE shortest route is a straight line DFS only
 * takes after exhausting the detour. See dfs.test.ts's "longer than BFS"
 * test below for the exact hand-traced path this produces (16 steps for
 * DFS vs. 6 for BFS) — traced by hand against the actual bfs.ts/dfs.ts
 * neighbor order and stack semantics, then confirmed by running this test.
 *
 *   S = (0,3). True shortest path: straight down column 3 to (6,3) = G.
 *   False lead: row 0 rightward from col 3 to col 8, down column 8 to
 *   row 3, then row 3 leftward back to column 3 — a long way around that
 *   reconnects to the true path partway down, corrupting DFS's parent
 *   chain for every cell on that reconnecting segment.
 */
function buildDfsDetourMaze(): { grid: Grid; start: number; goal: number } {
  const grid = new Grid(9, 7, TerrainType.Wall); // width=9 (cols 0-8), height=7 (rows 0-6)
  const carve = (row: number, col: number) => grid.setTerrain(grid.idOf(row, col), TerrainType.Road);

  for (let col = 3; col <= 8; col++) carve(0, col); // row 0, cols 3-8 (false lead)
  for (let row = 0; row <= 3; row++) carve(row, 8); // col 8, rows 0-3 (down the far side)
  for (let col = 3; col <= 8; col++) carve(3, col); // row 3, cols 3-8 (back left, reconnecting)
  for (let row = 0; row <= 6; row++) carve(row, 3); // col 3, rows 0-6 (the true path, full column)

  return { grid, start: grid.idOf(0, 3), goal: grid.idOf(6, 3) };
}

describe("dfs", () => {
  it("finds a valid path when one exists", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("reports no path when the goal is unreachable", () => {
    const grid = new Grid(5, 5);
    for (let col = 0; col < 5; col++) {
      grid.setTerrain(grid.idOf(2, col), TerrainType.Wall);
    }
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.path).toEqual([]);
  });

  it("start equals goal: path=[start], length=0, cost=0", () => {
    const grid = new Grid(5, 5);
    const id = grid.idOf(2, 2);
    const result = dfs(input(grid, id, id));

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
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.nodesExplored).toBe(0);
  });

  it("blocked goal: immediate no-path, goal never relocated", () => {
    const grid = new Grid(5, 5);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(3, 3);
    grid.setTerrain(goal, TerrainType.Wall);
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(false);
    expect(result.nodesExplored).toBe(0);
  });

  it("works on a 1x1 grid (start equals goal necessarily)", () => {
    const grid = new Grid(1, 1);
    const only = grid.idOf(0, 0);
    const result = dfs(input(grid, only, only));

    expect(result.pathFound).toBe(true);
    expect(result.path).toEqual([only]);
  });

  it("works on a 2x2 grid", () => {
    const grid = new Grid(2, 2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(1, 1);
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("terminates and returns a valid result on a large (200x200) grid within a reasonable time", () => {
    const grid = generateRandomObstacles(2024, 200, 200, 0.2);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(199, 199);

    const t0 = performance.now();
    const result = dfs(input(grid, start, goal));
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000); // generous budget, not a strict perf gate
    if (result.pathFound) {
      assertValidPath(grid, result.path, start, goal);
    } else {
      expect(result.path).toEqual([]);
    }
  });

  it("finds *a* valid path when multiple routes exist (open grid) — validity only, not optimality", () => {
    const grid = new Grid(6, 6);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(5, 5);
    const result = dfs(input(grid, start, goal));

    expect(result.pathFound).toBe(true);
    assertValidPath(grid, result.path, start, goal);
  });

  it("is deterministic across repeated runs on a fixed seeded world", () => {
    const grid = generateRandomObstacles(555, 20, 20, 0.25);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(19, 19);

    const first = dfs(input(grid, start, goal));
    const second = dfs(input(grid, start, goal));

    expect(second.pathFound).toBe(first.pathFound);
    expect(second.path).toEqual(first.path);
    expect(second.pathLength).toBe(first.pathLength);
    expect(second.nodesExplored).toBe(first.nodesExplored);
  });

  describe("DFS-specific", () => {
    it("never emits UPDATE_DISTANCE (DFS doesn't track distance — see NodeState.order instead)", () => {
      const grid = new Grid(5, 5);
      const result = dfs(input(grid, grid.idOf(0, 0), grid.idOf(4, 4)));
      expect(result.events.some((e) => e.type === "UPDATE_DISTANCE")).toBe(false);
    });

    it("never emits UPDATE_SCORES (that's A*-only, Phase 4)", () => {
      const grid = new Grid(5, 5);
      const result = dfs(input(grid, grid.idOf(0, 0), grid.idOf(4, 4)));
      expect(result.events.some((e) => e.type === "UPDATE_SCORES")).toBe(false);
    });

    it("finalNodeState uses 'order' (discovery order) for visited nodes, not 'distance'", () => {
      const grid = new Grid(5, 5);
      const start = grid.idOf(0, 0);
      const result = dfs(input(grid, start, grid.idOf(4, 4)));
      const startState = result.finalNodeState.get(start);
      expect(startState?.order).toBeDefined();
      expect(startState?.distance).toBeUndefined();
    });

    it("DFS's path is demonstrably longer than BFS's shortest path on a maze designed to trigger this (documents guideline §6's DFS framing requirement)", () => {
      const { grid, start, goal } = buildDfsDetourMaze();

      const dfsResult = dfs(input(grid, start, goal));
      const bfsResult = bfs(input(grid, start, goal));

      expect(dfsResult.pathFound).toBe(true);
      expect(bfsResult.pathFound).toBe(true);
      assertValidPath(grid, dfsResult.path, start, goal);
      assertValidPath(grid, bfsResult.path, start, goal);

      // The actual point of this test: DFS is NOT guaranteed shortest path.
      expect(dfsResult.pathLength).toBeGreaterThan(bfsResult.pathLength);
      // Specific expected values from the hand-traced simulation in this
      // maze's doc comment, so a future change to neighbor order or stack
      // semantics that silently breaks this property gets caught precisely.
      expect(bfsResult.pathLength).toBe(6);
      expect(dfsResult.pathLength).toBe(16);
    });
  });
});
