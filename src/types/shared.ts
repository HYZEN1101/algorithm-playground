/**
 * A grid cell identity: row * width + col. This is the single source of
 * truth for cell identity everywhere in the app (events, inspector
 * selection, parent pointers) instead of Coord objects — see
 * ARCHITECTURE.md §4.
 */
export type NodeId = number;

export interface Coord {
  row: number;
  col: number;
}
