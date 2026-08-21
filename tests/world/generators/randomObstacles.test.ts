import { describe, it, expect } from "vitest";
import { generate } from "../../../src/world/generators/randomObstacles";
import { TerrainType } from "../../../src/world/terrain";

describe("randomObstacles.generate", () => {
  it("is deterministic: same seed + config produces an identical grid, verified via equals()", () => {
    const a = generate(42, 20, 20, 0.3);
    const b = generate(42, 20, 20, 0.3);
    expect(a.equals(b)).toBe(true);
  });

  it("different seeds generally produce different grids", () => {
    const a = generate(1, 20, 20, 0.3);
    const b = generate(2, 20, 20, 0.3);
    expect(a.equals(b)).toBe(false);
  });

  it("respects configured width and height", () => {
    const g = generate(5, 7, 9, 0.2);
    expect(g.width).toBe(7);
    expect(g.height).toBe(9);
  });

  it("produces only Road and Wall terrain", () => {
    const g = generate(99, 10, 10, 0.5);
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const t = g.terrainAt(g.idOf(row, col));
        expect([TerrainType.Road, TerrainType.Wall]).toContain(t);
      }
    }
  });

  it("density=0 produces an all-Road grid", () => {
    const g = generate(1, 10, 10, 0);
    for (let id = 0; id < 100; id++) {
      expect(g.terrainAt(id)).toBe(TerrainType.Road);
    }
  });

  it("density=1 produces an all-Wall grid", () => {
    const g = generate(1, 10, 10, 1);
    for (let id = 0; id < 100; id++) {
      expect(g.terrainAt(id)).toBe(TerrainType.Wall);
    }
  });

  it("throws for out-of-range density", () => {
    expect(() => generate(1, 5, 5, -0.1)).toThrow();
    expect(() => generate(1, 5, 5, 1.1)).toThrow();
  });

  it("produces a usable grid at a large (200x200) size within the same call", () => {
    const g = generate(2024, 200, 200, 0.25);
    expect(g.width).toBe(200);
    expect(g.height).toBe(200);
  });
});
