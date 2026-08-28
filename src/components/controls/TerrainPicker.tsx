import type { CSSProperties } from "react";
import { TerrainType } from "../../world/terrain";
import { TERRAIN_COLORS, TERRAIN_PATTERNS, START_COLOR, GOAL_COLOR } from "../../rendering/canvas/theme";
import { worldStore, useWorldState, type Tool } from "../../state/worldStore";

const PAINT_TOOLS: Array<{ terrain: TerrainType; label: string }> = [
  { terrain: TerrainType.Wall, label: "Wall" },
  { terrain: TerrainType.Road, label: "Road (erase)" },
  { terrain: TerrainType.Grass, label: "Grass" },
  { terrain: TerrainType.Mud, label: "Mud" },
  { terrain: TerrainType.Water, label: "Water" },
  { terrain: TerrainType.Mountain, label: "Mountain" },
];

function isSameTool(a: Tool, b: Tool): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "paint" && b.kind === "paint") return a.terrain === b.terrain;
  return true;
}

/**
 * Small swatch showing a terrain's color + pattern together, so the picker
 * itself doubles as a legend (reinforces the non-color-only encoding rather
 * than only living inside the canvas).
 */
function TerrainSwatch({ terrain }: { terrain: TerrainType }) {
  const pattern = TERRAIN_PATTERNS[terrain];
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: TERRAIN_COLORS[terrain],
        border: "1px solid rgba(0,0,0,0.25)",
        marginRight: 8,
        verticalAlign: "middle",
        position: "relative",
      }}
      title={pattern === "none" ? undefined : `pattern: ${pattern}`}
    />
  );
}

export function TerrainPicker() {
  const { activeTool } = useWorldState();

  const toolButtonStyle = (selected: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "6px 10px",
    marginBottom: 4,
    borderRadius: 6,
    border: selected ? "1px solid #2c2a28" : "1px solid transparent",
    background: selected ? "rgba(44, 42, 40, 0.08)" : "transparent",
    fontWeight: selected ? 600 : 400,
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left",
  });

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        Paint
      </h2>
      {PAINT_TOOLS.map(({ terrain, label }) => {
        const tool: Tool = { kind: "paint", terrain };
        const selected = isSameTool(activeTool, tool);
        return (
          <button
            key={terrain}
            type="button"
            aria-pressed={selected}
            style={toolButtonStyle(selected)}
            onClick={() => worldStore.setActiveTool(tool)}
          >
            <TerrainSwatch terrain={terrain} />
            {label}
          </button>
        );
      })}

      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "16px 0 8px" }}>
        Move
      </h2>
      <button
        type="button"
        aria-pressed={activeTool.kind === "move-start"}
        style={toolButtonStyle(activeTool.kind === "move-start")}
        onClick={() => worldStore.setActiveTool({ kind: "move-start" })}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: START_COLOR,
            border: "1px solid white",
            outline: "1px solid rgba(0,0,0,0.25)",
            marginRight: 8,
          }}
        />
        Move Start
      </button>
      <button
        type="button"
        aria-pressed={activeTool.kind === "move-goal"}
        style={toolButtonStyle(activeTool.kind === "move-goal")}
        onClick={() => worldStore.setActiveTool({ kind: "move-goal" })}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            backgroundColor: GOAL_COLOR,
            border: "1px solid white",
            outline: "1px solid rgba(0,0,0,0.25)",
            marginRight: 8,
            transform: "rotate(45deg)",
          }}
        />
        Move Goal
      </button>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "16px 0 8px" }}>
        Inspect
      </h2>
      <button
        type="button"
        aria-pressed={activeTool.kind === "inspect"}
        style={toolButtonStyle(activeTool.kind === "inspect")}
        onClick={() => worldStore.setActiveTool({ kind: "inspect" })}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: "2px solid #2c2a28",
            marginRight: 8,
            verticalAlign: "middle",
          }}
        />
        Inspect Cell
      </button>
    </div>
  );
}
