import { describe, it, expect } from "vitest";
import { Grid } from "../../src/world/grid";
import { generate as generateRandomObstacles } from "../../src/world/generators/randomObstacles";
import { bfs } from "../../src/algorithms/pathfinding/bfs";
import { astar } from "../../src/algorithms/pathfinding/astar";
import { deriveNodeStates, createIncrementalNodeStateDeriver } from "../../src/playback/deriveNodeStates";

/**
 * Smoke test, not a strict performance gate (per PHASE_7_ACCESSIBILITY_
 * PERFORMANCE.md's own description: "generous threshold, marked as a
 * smoke test not a strict perf gate"). This sandbox has no browser to
 * profile real canvas/rAF performance against (docs/performance-notes.md
 * records that honestly), so these thresholds exist only to catch a
 * genuine algorithmic blowup (e.g. an accidental O(n²) reintroduced
 * somewhere) — not to assert any specific frame budget. Thresholds are
 * deliberately generous (10x+ looser than what should be needed on any
 * reasonable machine) so this never flakes on a slow CI box.
 */
describe("performance smoke tests at 200x200", () => {
  it("Grid construction + full neighbor iteration completes well within a generous budget", () => {
    const start = performance.now();
    const grid = new Grid(200, 200);
    let total = 0;
    for (let row = 0; row < 200; row++) {
      for (let col = 0; col < 200; col++) {
        total += grid.neighbors(grid.idOf(row, col), false).length;
      }
    }
    const elapsed = performance.now() - start;
    expect(total).toBeGreaterThan(0); // sanity: the loop actually did work
    expect(elapsed).toBeLessThan(2000); // generous; real cost is a few ms
  });

  it("randomObstacles.generate at 200x200 completes well within a generous budget", () => {
    const start = performance.now();
    generateRandomObstacles(2024, 200, 200, 0.2);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("BFS/A* on a 200x200 generated grid complete well within a generous budget", () => {
    const grid = generateRandomObstacles(2024, 200, 200, 0.15);
    const start = grid.idOf(0, 0);
    const goal = grid.idOf(199, 199);
    const input = { grid, start, goal, diagonals: false };

    const t0 = performance.now();
    const bfsResult = bfs(input);
    const t1 = performance.now();
    const astarResult = astar(input);
    const t2 = performance.now();

    expect(bfsResult.events.length).toBeGreaterThan(0);
    expect(astarResult.events.length).toBeGreaterThan(0);
    expect(t1 - t0).toBeLessThan(2000);
    expect(t2 - t1).toBeLessThan(2000);
  });

  it("deriveNodeStates (pure, full-replay) on a large event timeline completes well within a generous budget", () => {
    const grid = generateRandomObstacles(2024, 200, 200, 0.15);
    const input = { grid, start: grid.idOf(0, 0), goal: grid.idOf(199, 199), diagonals: false };
    const { events } = bfs(input);

    const start = performance.now();
    deriveNodeStates(events, events.length);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("the incremental deriver, applied one step at a time across a full large timeline, stays well within a generous total budget", () => {
    // This is the specific access pattern that was slow before the
    // post-Phase-5 incremental-deriver fix (many small forward steps
    // instead of one big replay) — regression-guards that fix, loosely.
    const grid = generateRandomObstacles(2024, 200, 200, 0.15);
    const input = { grid, start: grid.idOf(0, 0), goal: grid.idOf(199, 199), diagonals: false };
    const { events } = bfs(input);
    const deriver = createIncrementalNodeStateDeriver();

    const start = performance.now();
    const STEP = 8; // roughly what a single rAF tick advances at a moderate configured speed
    for (let index = 0; index <= events.length; index += STEP) {
      deriver.derive(events, index);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
