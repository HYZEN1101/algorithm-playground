import type { NodeId, Coord } from "../types/shared";
import { TerrainType, TERRAIN_COST } from "./terrain";

const NEIGHBOR_DELTAS_4: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const NEIGHBOR_DELTAS_DIAGONAL_ONLY: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/**
 * The canonical world grid. Backed by a Uint8Array (one byte per cell,
 * indexed by NodeId) rather than an array of objects — see ARCHITECTURE.md
 * §3 for why (memory/iteration cost at 200x200 cells).
 *
 * Encapsulation rule (amended, ARCHITECTURE.md §3): the internal terrain
 * array is never exposed, not even for tests. Grid.equals() is the only
 * sanctioned way to compare two grids' contents. Do not add any accessor
 * whose only purpose is exposing `terrain` — that includes convenience
 * getters that "just happen" to return the raw array.
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  private terrain: Uint8Array;

  constructor(width: number, height: number, fill: TerrainType = TerrainType.Road) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Grid dimensions must be positive integers, got ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.terrain = new Uint8Array(width * height).fill(fill);
  }

  idOf(row: number, col: number): NodeId {
    return row * this.width + col;
  }

  coordOf(id: NodeId): Coord {
    return { row: Math.floor(id / this.width), col: id % this.width };
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.height && col >= 0 && col < this.width;
  }

  private assertValidId(id: NodeId): void {
    if (!Number.isInteger(id) || id < 0 || id >= this.terrain.length) {
      throw new RangeError(
        `NodeId ${id} is out of bounds for a ${this.width}x${this.height} grid`,
      );
    }
  }

  terrainAt(id: NodeId): TerrainType {
    this.assertValidId(id);
    return this.terrain[id] as TerrainType;
  }

  setTerrain(id: NodeId, t: TerrainType): void {
    this.assertValidId(id);
    this.terrain[id] = t;
  }

  isPassable(id: NodeId): boolean {
    return this.terrainAt(id) !== TerrainType.Wall;
  }

  costOf(id: NodeId): number {
    return TERRAIN_COST[this.terrainAt(id)];
  }

  /**
   * Bounds- and passability-filtered neighbor lookup. `diagonals` is kept
   * as a parameter for a future phase (see ARCHITECTURE.md §4) — the MVP
   * always calls this with `diagonals = false`; no MVP UI ever toggles it.
   */
  neighbors(id: NodeId, diagonals: boolean): NodeId[] {
    this.assertValidId(id);
    const { row, col } = this.coordOf(id);
    const deltas = diagonals
      ? [...NEIGHBOR_DELTAS_4, ...NEIGHBOR_DELTAS_DIAGONAL_ONLY]
      : NEIGHBOR_DELTAS_4;

    const result: NodeId[] = [];
    for (const [dr, dc] of deltas) {
      const r = row + dr;
      const c = col + dc;
      if (!this.inBounds(r, c)) continue;
      const neighborId = this.idOf(r, c);
      if (!this.isPassable(neighborId)) continue;
      result.push(neighborId);
    }
    return result;
  }

  /**
   * A full independent copy. Needed once per algorithm run as input (not
   * per step) so a run's result stays valid even if the world is edited
   * afterward — see ARCHITECTURE.md §4.
   */
  clone(): Grid {
    const copy = new Grid(this.width, this.height);
    copy.terrain = this.terrain.slice();
    return copy;
  }

  /**
   * The only sanctioned way to compare two grids' contents. Tests must use
   * this instead of reaching into internal storage.
   */
  equals(other: Grid): boolean {
    if (this.width !== other.width || this.height !== other.height) {
      return false;
    }
    if (this.terrain.length !== other.terrain.length) {
      return false;
    }
    for (let i = 0; i < this.terrain.length; i++) {
      if (this.terrain[i] !== other.terrain[i]) {
        return false;
      }
    }
    return true;
  }
}

/**
 * ARCHITECTURE.md §3 notes this type "lives with grid.ts conceptually" and
 * is kept in state/worldStore.ts "for locality" once that store exists.
 * Phase 1 does not create a state/ folder (that's Phase 2+ — see
 * PHASE_1_FOUNDATION.md's explicit non-goals), so the type is defined here
 * for now. Phase 2 should re-export it from worldStore.ts rather than
 * duplicating the definition.
 */
export interface WorldConfig {
  grid: Grid;
  start: NodeId;
  goal: NodeId;
  seed: number;
  diagonals: boolean;
}
