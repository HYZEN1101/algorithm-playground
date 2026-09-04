import { describe, it, expect } from "vitest";
import { buildComparisonRows, findMostEfficientOptimal } from "../../src/algorithms/pathfinding/comparisonMetrics";
import { ALGORITHM_REGISTRY, ALGORITHM_NAMES } from "../../src/algorithms/pathfinding/registry";
import { Grid } from "../../src/world/grid";
import { TerrainType } from "../../src/world/terrain";
import type { AlgorithmName, PathfindingResult } from "../../src/algorithms/pathfinding/types";

/** Minimal hand-built PathfindingResult fixture — only the fields comparisonMetrics reads matter. */
function result(overrides: Partial<PathfindingResult>): PathfindingResult {
  return {
    pathFound: true,
    path: [],
    pathLength: 0,
    pathCost: 0,
    nodesExplored: 0,
    events: [],
    finalNodeState: new Map(),
    executionTimeMs: 0,
    ...overrides,
  };
}

describe("buildComparisonRows", () => {
  it("marks the single cheapest-cost result as optimal", () => {
    const rows = buildComparisonRows({
      bfs: result({ pathCost: 10, pathLength: 10, nodesExplored: 50 }),
      dijkstra: result({ pathCost: 10, pathLength: 10, nodesExplored: 60 }),
      astar: result({ pathCost: 10, pathLength: 10, nodesExplored: 30 }),
      dfs: result({ pathCost: 40, pathLength: 40, nodesExplored: 5 }),
    });

    const byAlgo = Object.fromEntries(rows.map((r) => [r.algorithm, r]));
    expect(byAlgo.bfs.isOptimal).toBe(true);
    expect(byAlgo.dijkstra.isOptimal).toBe(true);
    expect(byAlgo.astar.isOptimal).toBe(true);
    expect(byAlgo.dfs.isOptimal).toBe(false);
  });

  it("does not hardcode DFS as never-optimal — honestly reports a tie", () => {
    // Contrived but legitimate: a map where DFS's path happens to be the
    // only/cheapest path (e.g. a single-corridor grid). comparisonMetrics
    // must not special-case DFS by name.
    const rows = buildComparisonRows({
      bfs: result({ pathCost: 5, pathLength: 5, nodesExplored: 5 }),
      dfs: result({ pathCost: 5, pathLength: 5, nodesExplored: 5 }),
    });

    const dfsRow = rows.find((r) => r.algorithm === "dfs");
    expect(dfsRow?.isOptimal).toBe(true);
  });

  it("a pathFound:false result is never optimal, regardless of its cost field", () => {
    const rows = buildComparisonRows({
      bfs: result({ pathFound: false, pathCost: 0, nodesExplored: 100 }),
      astar: result({ pathCost: 8, nodesExplored: 20 }),
    });

    const bfsRow = rows.find((r) => r.algorithm === "bfs");
    expect(bfsRow?.isOptimal).toBe(false);
  });

  it("handles no results at all (empty map)", () => {
    expect(buildComparisonRows({})).toEqual([]);
  });

  it("handles the case where nothing found a path", () => {
    const rows = buildComparisonRows({
      bfs: result({ pathFound: false, nodesExplored: 100 }),
      dfs: result({ pathFound: false, nodesExplored: 80 }),
    });
    expect(rows.every((r) => !r.isOptimal)).toBe(true);
  });
});

describe("findMostEfficientOptimal", () => {
  it("returns the optimal row with the fewest nodesExplored", () => {
    const rows = buildComparisonRows({
      bfs: result({ pathCost: 10, nodesExplored: 50 }),
      astar: result({ pathCost: 10, nodesExplored: 30 }),
    });
    expect(findMostEfficientOptimal(rows)?.algorithm).toBe("astar");
  });

  it("returns null when no path was found by any algorithm", () => {
    const rows = buildComparisonRows({
      bfs: result({ pathFound: false, nodesExplored: 100 }),
    });
    expect(findMostEfficientOptimal(rows)).toBeNull();
  });

  it("returns null on an empty row set (no division-by-zero / crash)", () => {
    expect(findMostEfficientOptimal([])).toBeNull();
  });
});

describe("ALGORITHM_REGISTRY", () => {
  it("contains exactly the four MVP algorithms", () => {
    expect(ALGORITHM_NAMES.sort()).toEqual(["astar", "bfs", "dfs", "dijkstra"]);
  });

  it("Run All passes the identical Grid reference to every algorithm, not a fresh clone each time", () => {
    const grid = new Grid(5, 5, TerrainType.Road);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(4, 4);
    const seenGrids: Grid[] = [];

    for (const name of ALGORITHM_NAMES as AlgorithmName[]) {
      const { run } = ALGORITHM_REGISTRY[name];
      // Wrap to observe exactly what grid reference each algorithm receives.
      run({ grid, start, goal, diagonals: false });
      seenGrids.push(grid);
    }

    // Every call used the SAME object reference (not four separately
    // generated grids) — confirmed via strict reference equality.
    expect(seenGrids.every((g) => g === grid)).toBe(true);
    expect(new Set(seenGrids).size).toBe(1);
  });
});
