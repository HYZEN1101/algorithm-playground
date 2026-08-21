import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../../src/world/generators/rng";

function take(rand: () => number, n: number): number[] {
  return Array.from({ length: n }, () => rand());
}

describe("mulberry32", () => {
  it("is deterministic: the same seed produces the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(take(a, 20)).toEqual(take(b, 20));
  });

  it("different seeds generally produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(take(a, 20)).not.toEqual(take(b, 20));
  });

  it("produces values in [0, 1)", () => {
    const rand = mulberry32(123);
    for (let i = 0; i < 2000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("does not depend on Math.random (fresh instances with the same seed agree)", () => {
    // If Math.random were involved anywhere, two independent generator
    // instances with the same seed would not reliably agree on their very
    // first output.
    expect(mulberry32(7)()).toBe(mulberry32(7)());
    expect(mulberry32(999)()).toBe(mulberry32(999)());
  });

  it("handles seed 0 without special-casing into a degenerate sequence", () => {
    const rand = mulberry32(0);
    const values = take(rand, 10);
    const allSame = values.every((v) => v === values[0]);
    expect(allSame).toBe(false);
  });
});
