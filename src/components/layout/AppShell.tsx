import { CanvasGrid } from "../grid/CanvasGrid";
import { TerrainPicker } from "../controls/TerrainPicker";
import { GenerateButton } from "../controls/GenerateButton";
import { AlgorithmPicker } from "../controls/AlgorithmPicker";
import { ComparisonPanel } from "../comparison/ComparisonPanel";
import { PlaybackControls } from "../controls/PlaybackControls";
import { NodeInspector } from "../inspector/NodeInspector";
import { MetricsPanel } from "../metrics/MetricsPanel";

/**
 * Conceptual 3-panel layout from ARCHITECTURE.md §9: left = algorithm/
 * settings panel, center = CanvasGrid, right = NodeInspector (Phase 6).
 * Bottom bar hosts PlaybackControls (Phase 5) and, above it, MetricsPanel
 * (Phase 6).
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
        <span style={{ fontSize: 12, color: "#888" }}>Learn and understand algorithms by watching them think.</span>
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
          <div style={{ height: 20 }} />
          <ComparisonPanel />
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
            overflowY: "auto",
          }}
        >
          <NodeInspector />
        </aside>
      </div>

      <div style={{ borderTop: "1px solid #e2ddd2", flexShrink: 0 }}>
        <MetricsPanel />
        <div style={{ borderTop: "1px solid #eee" }}>
          <PlaybackControls />
        </div>
      </div>
    </div>
  );
}
