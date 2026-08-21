export enum TerrainType {
  Road,
  Grass,
  Mud,
  Water,
  Mountain,
  Wall,
}

/**
 * Wall is Infinity, not just "very expensive" — Grid.isPassable() treats
 * Wall as non-traversable, and no algorithm should ever path through it
 * regardless of how costs are compared. See ARCHITECTURE.md §3.
 */
export const TERRAIN_COST: Record<TerrainType, number> = {
  [TerrainType.Road]: 1,
  [TerrainType.Grass]: 2,
  [TerrainType.Mud]: 5,
  [TerrainType.Water]: 10,
  [TerrainType.Mountain]: 20,
  [TerrainType.Wall]: Infinity,
};
