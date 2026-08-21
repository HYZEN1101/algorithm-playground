import { Grid } from "../grid";
import { TerrainType } from "../terrain";
import { mulberry32 } from "./rng";

/**
 * Generates a Grid where each cell becomes a Wall with probability `density`
 * (0-1) and Road otherwise. Deterministic: the same (seed, width, height,
 * density) always produces an identical grid — verify with `.equals()`,
 * never by inspecting internal storage.
 *
 * This is the only generator for the MVP; maze/cellular-automata generators
 * are explicitly deferred (ARCHITECTURE.md §13).
 */
export function generate(seed: number, width: number, height: number, density: number): Grid {
  if (density < 0 || density > 1) {
    throw new RangeError(`density must be between 0 and 1, got ${density}`);
  }

  const grid = new Grid(width, height, TerrainType.Road);
  const random = mulberry32(seed);
  const totalCells = width * height;

  for (let id = 0; id < totalCells; id++) {
    if (random() < density) {
      grid.setTerrain(id, TerrainType.Wall);
    }
  }

  return grid;
}
