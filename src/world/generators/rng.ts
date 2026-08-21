export type RandomFn = () => number;

/**
 * mulberry32 seeded PRNG. Deterministic: the same seed always produces the
 * same sequence of numbers in [0, 1). This is the ONLY source of randomness
 * used anywhere in world generation — Math.random() must never be called
 * directly for anything that needs to be reproducible (ARCHITECTURE.md §13).
 */
export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
