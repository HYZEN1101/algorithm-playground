import { TerrainType } from "../../world/terrain";

/**
 * Colors and non-color encodings for the grid. Per ARCHITECTURE.md §8/§17:
 * state must never depend on color alone. Walls get a hatch pattern on top
 * of their fill color; start/goal get distinct icon shapes, not just
 * distinct colors.
 *
 * Restrained palette for now — this is functional, not the final visual
 * polish pass (that's Phase 8, per requirements §21/§32). Formal WCAG AA
 * contrast auditing of every pair happens in Phase 7
 * (docs/accessibility-notes.md); the notes below are a basic sanity check
 * done while picking these values, not that formal audit.
 */

export const CANVAS_BACKGROUND = "#f6f4ef";
export const GRID_LINE_COLOR = "rgba(30, 27, 20, 0.10)";

export const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.Road]: "#e7e2d6",
  [TerrainType.Grass]: "#3d7a40",
  [TerrainType.Mud]: "#7a5730",
  [TerrainType.Water]: "#266d92",
  [TerrainType.Mountain]: "#6e655a",
  [TerrainType.Wall]: "#2c2a28",
};

/**
 * Per-terrain fill pattern, drawn on top of TERRAIN_COLORS so terrain is
 * distinguishable without relying on color alone (PHASE_2_CANVAS.md
 * acceptance criteria: "start/goal/walls/terrain does not rely on color
 * alone"). "none" is intentionally used for Road, since Road is the
 * neutral/default terrain and every other type gets a mark.
 */
export type TerrainPattern = "none" | "dots" | "waves" | "tufts" | "peaks" | "hatch";

export const TERRAIN_PATTERNS: Record<TerrainType, TerrainPattern> = {
  [TerrainType.Road]: "none",
  [TerrainType.Grass]: "tufts",
  [TerrainType.Mud]: "dots",
  [TerrainType.Water]: "waves",
  [TerrainType.Mountain]: "peaks",
  [TerrainType.Wall]: "hatch",
};

// Hatch pattern drawn over Wall cells in addition to the dark fill, so
// walls remain identifiable even under a color-vision simulation or in
// grayscale printouts.
export const WALL_HATCH_COLOR = "rgba(255, 255, 255, 0.18)";
export const WALL_HATCH_LINE_WIDTH = 1;
export const WALL_HATCH_SPACING = 6; // CSS px between hatch lines

export const START_COLOR = "#2f6b45";
export const GOAL_COLOR = "#8a3030";

/**
 * Rough relative-luminance contrast check (WCAG formula), used only to
 * sanity-check the palette above while choosing it. Not a substitute for
 * Phase 7's formal per-pair audit.
 */
function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Actual computed contrast ratios for this palette (computed via the
// function above; verified programmatically, not just by hand — see
// docs/accessibility-notes.md for the full audit and methodology):
//   Wall     vs Road        11.06 : 1   (clears 3:1 comfortably)
//   Wall     vs background  13.01 : 1   (clears 3:1 comfortably)
//   Start    vs Road         4.91 : 1   (clears 3:1)
//   Goal     vs Road         6.38 : 1   (clears 3:1)
//   Grass    vs Road         4.01 : 1   (clears 3:1 — Phase 7 fix, was 1.48:1)
//   Mud      vs Road         5.02 : 1   (clears 3:1 — Phase 7 fix, was 2.54:1)
//   Water    vs Road         4.41 : 1   (clears 3:1 — Phase 7 fix, was 1.72:1)
//   Mountain vs Road         4.42 : 1   (clears 3:1 — Phase 7 fix, was a marginal 3.14:1)
//
// Phase 7 (formal WCAG AA pass, docs/accessibility-notes.md) darkened
// Grass/Mud/Water/Mountain so every terrain now clears 3:1 against Road,
// the shared light "neutral ground" every other terrain is visually
// compared to. Doing this pushed the four darkened terrain colors closer
// to each other in luminance (their MUTUAL contrast against each other is
// now low, ~1.0-1.25:1) — this is a known, accepted tradeoff, not an
// oversight: distinguishing one non-Road terrain from another was always
// meant to rely primarily on TERRAIN_PATTERNS (tufts/dots/waves/peaks),
// not color, per guideline §24's "combinations of color, icons, borders,
// patterns" rule — pushing all four terrain colors far apart from each
// other AND each clearing 3:1 against a shared light Road is not
// achievable within one cohesive, restrained palette (guideline §32).
// Pattern strokes were switched from dark to light
// (`rgba(255,255,255,0.55)`, gridRenderer.ts) to stay visible against the
// now-dark terrain fills — the old dark stroke color was chosen for the
// old, lighter fills and would have been invisible against these.
