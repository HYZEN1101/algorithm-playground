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
  [TerrainType.Grass]: "#94c98d",
  [TerrainType.Mud]: "#b08655",
  [TerrainType.Water]: "#6fb7d9",
  [TerrainType.Mountain]: "#867d70",
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
// function above, recorded here so the numbers don't silently drift from
// reality — see HANDOFF.md's Phase 2 entry for how these were checked):
//   Wall    vs Road        11.06 : 1   (clears 3:1 comfortably)
//   Wall    vs background  13.01 : 1   (clears 3:1 comfortably)
//   Start   vs Road         4.91 : 1   (clears 3:1)
//   Goal    vs Road         6.38 : 1   (clears 3:1)
//   Mountain vs Road        3.14 : 1   (just clears 3:1)
//   Mud     vs Road         2.54 : 1   (DOES NOT clear 3:1 on color alone)
//   Water   vs Road         1.72 : 1   (DOES NOT clear 3:1 on color alone)
//   Grass   vs Road         1.48 : 1   (DOES NOT clear 3:1 on color alone)
//
// Known gap, not silently hidden: Grass/Water/Mud are not reliably
// distinguishable from Road by color contrast alone for a low-vision user.
// TERRAIN_PATTERNS above gives each of them a distinct pattern for this
// reason (tufts/waves/dots), which is a partial mitigation, not a full fix —
// pattern legibility itself hasn't been formally audited. The full
// palette-level fix (if patterns prove insufficient) is explicitly Phase 7's
// job (docs/accessibility-notes.md); recorded here rather than deferred
// silently.
