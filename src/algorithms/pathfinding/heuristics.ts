import type { Coord } from "../../types/shared";

/**
 * MVP scope (movement/heuristic amendment, logged in HANDOFF.md): only
 * manhattanDistance is ever consulted by astar.ts or wired into any MVP UI.
 * euclideanDistance/chebyshevDistance are implemented here as clean,
 * independently-testable utilities per PHASE_4_DIJKSTRA_ASTAR.md's
 * instruction ("may implement... if that's convenient"), but nothing in
 * this codebase calls them yet — they become meaningful once diagonal
 * movement exists in a future phase. Do not wire them into astar.ts or
 * AlgorithmPicker in this phase.
 */

export function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function euclideanDistance(a: Coord, b: Coord): number {
  const dRow = a.row - b.row;
  const dCol = a.col - b.col;
  return Math.sqrt(dRow * dRow + dCol * dCol);
}

export function chebyshevDistance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}
