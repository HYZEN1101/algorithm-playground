import { CanvasGrid } from "../grid/CanvasGrid";
import { TerrainPicker } from "../controls/TerrainPicker";
import { GenerateButton } from "../controls/GenerateButton";
import { AlgorithmPicker } from "../controls/AlgorithmPicker";
import { PlaybackControls } from "../controls/PlaybackControls";

/**
 * Conceptual 3-panel layout from ARCHITECTURE.md §9: left = algorithm/
 * settings panel, center = CanvasGrid, right = NodeInspector. Bottom bar
 * now hosts the real PlaybackControls (Phase 5). The right panel
 * (Inspector) and a Metrics panel are still placeholders until Phase 6.
 */
export function AppShell() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#2c2a28",
      }}
    >
      <header
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #e2ddd2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 15 }}>Algorithm Playground</strong>
        <span style={{ fontSize: 12, color: "#888" }}>Phase 5 — Playback Controller</span>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            padding: 16,
            borderRight: "1px solid #e2ddd2",
            overflowY: "auto",
          }}
        >
          <TerrainPicker />
          <div style={{ height: 20 }} />
          <GenerateButton />
          <div style={{ height: 20 }} />
          <AlgorithmPicker />
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: 16 }}>
          <CanvasGrid />
        </main>

        <aside
          style={{
            width: 240,
            flexShrink: 0,
            padding: 16,
            borderLeft: "1px solid #e2ddd2",
            color: "#999",
            fontSize: 13,
          }}
        >
          Inspector — coming in a later phase.
        </aside>
      </div>

      <div style={{ borderTop: "1px solid #e2ddd2", flexShrink: 0 }}>
        <PlaybackControls />
      </div>
    </div>
  );
}
