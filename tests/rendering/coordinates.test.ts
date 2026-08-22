import { describe, it, expect } from "vitest";
import {
  computeCellMetrics,
  gridToPixel,
  gridToPixelCenter,
  pixelToGrid,
} from "../../src/rendering/coordinates";

describe("coordinates", () => {
  describe("computeCellMetrics", () => {
    it("produces square cells sized to fit the smaller dimension", () => {
      // 300x300 canvas, 10x10 grid -> 30px cells exactly, no padding needed
      const metrics = computeCellMetrics({
        gridWidth: 10,
        gridHeight: 10,
        canvasWidth: 300,
        canvasHeight: 300,
      });
      expect(metrics.cellSize).toBe(30);
      expect(metrics.offsetX).toBe(0);
      expect(metrics.offsetY).toBe(0);
    });

    it("centers the grid within extra space on the non-limiting axis", () => {
      // 400 wide x 200 tall canvas, 10x10 grid -> limited by height (20px cells),
      // grid only uses 200x200, so it should be horizontally centered.
      const metrics = computeCellMetrics({
        gridWidth: 10,
        gridHeight: 10,
        canvasWidth: 400,
        canvasHeight: 200,
      });
      expect(metrics.cellSize).toBe(20);
      expect(metrics.offsetX).toBe(100); // (400 - 200) / 2
      expect(metrics.offsetY).toBe(0);
    });

    it("never produces a cellSize below 1px even for a tiny canvas", () => {
      const metrics = computeCellMetrics({
        gridWidth: 200,
        gridHeight: 200,
        canvasWidth: 50,
        canvasHeight: 50,
      });
      expect(metrics.cellSize).toBeGreaterThanOrEqual(1);
    });
  });

  describe("pixelToGrid / gridToPixel round-trip", () => {
    // A range of canvas sizes, DPR-like scale factors baked into canvas
    // size (see coordinates.ts's design note on why DPR itself isn't a
    // separate parameter here), and grid dimensions.
    const scenarios: Array<{ gridWidth: number; gridHeight: number; canvasWidth: number; canvasHeight: number }> = [
      { gridWidth: 10, gridHeight: 10, canvasWidth: 300, canvasHeight: 300 }, // exact fit
      { gridWidth: 10, gridHeight: 10, canvasWidth: 301, canvasHeight: 301 }, // 1px slop
      { gridWidth: 30, gridHeight: 20, canvasWidth: 800, canvasHeight: 500 }, // typical app size
      { gridWidth: 100, gridHeight: 100, canvasWidth: 1000, canvasHeight: 1000 }, // large grid
      { gridWidth: 200, gridHeight: 200, canvasWidth: 1400, canvasHeight: 900 }, // stress size, non-square
      // Simulated 2x and 3x DPR: canvas CSS size scaled up, same grid.
      { gridWidth: 30, gridHeight: 20, canvasWidth: 1600, canvasHeight: 1000 }, // 2x of the "typical" scenario
      { gridWidth: 30, gridHeight: 20, canvasWidth: 2400, canvasHeight: 1500 }, // 3x of the "typical" scenario
      { gridWidth: 7, gridHeight: 13, canvasWidth: 500, canvasHeight: 500 }, // odd/non-square grid
    ];

    for (const scenario of scenarios) {
      const label = `${scenario.gridWidth}x${scenario.gridHeight} grid in ${scenario.canvasWidth}x${scenario.canvasHeight} canvas`;

      it(`round-trips every cell center exactly for ${label}`, () => {
        const metrics = computeCellMetrics(scenario);
        for (let row = 0; row < scenario.gridHeight; row++) {
          for (let col = 0; col < scenario.gridWidth; col++) {
            const { x, y } = gridToPixelCenter(row, col, metrics);
            const back = pixelToGrid(x, y, metrics);
            expect(back).toEqual({ row, col });
          }
        }
      });

      it(`round-trips within half a cell near cell corners for ${label}`, () => {
        const metrics = computeCellMetrics(scenario);
        // Sample a handful of representative cells, not every one — corner
        // rounding behavior is the same for all cells given uniform cellSize.
        const sampleCells: Array<[number, number]> = [
          [0, 0],
          [scenario.gridHeight - 1, scenario.gridWidth - 1],
          [Math.floor(scenario.gridHeight / 2), Math.floor(scenario.gridWidth / 2)],
        ];
        for (const [row, col] of sampleCells) {
          const topLeft = gridToPixel(row, col, metrics);
          // Nudge slightly inside the cell from the top-left corner —
          // still within half a cell of the true center.
          const nudged = { x: topLeft.x + 1, y: topLeft.y + 1 };
          const back = pixelToGrid(nudged.x, nudged.y, metrics);
          expect(back).toEqual({ row, col });
        }
      });
    }

    it("returns null for points outside the drawn grid area (padding region)", () => {
      const metrics = computeCellMetrics({
        gridWidth: 10,
        gridHeight: 10,
        canvasWidth: 400,
        canvasHeight: 200,
      });
      // offsetX is 100 here (see the centering test above) — a point in the
      // left padding strip should not resolve to a cell.
      expect(pixelToGrid(50, 100, metrics)).toBeNull();
    });

    it("returns null for negative coordinates", () => {
      const metrics = computeCellMetrics({
        gridWidth: 10,
        gridHeight: 10,
        canvasWidth: 300,
        canvasHeight: 300,
      });
      expect(pixelToGrid(-5, 10, metrics)).toBeNull();
      expect(pixelToGrid(10, -5, metrics)).toBeNull();
    });

    it("returns null for coordinates past the grid's far edge", () => {
      const metrics = computeCellMetrics({
        gridWidth: 10,
        gridHeight: 10,
        canvasWidth: 300,
        canvasHeight: 300,
      });
      expect(pixelToGrid(299, 305, metrics)).toBeNull();
      expect(pixelToGrid(305, 299, metrics)).toBeNull();
    });
  });
});
