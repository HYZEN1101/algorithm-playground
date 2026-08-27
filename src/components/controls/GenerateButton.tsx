import { useState, useEffect } from "react";
import { worldStore, useWorldState, clampGridDimension, MIN_GRID_DIMENSION, MAX_GRID_DIMENSION } from "../../state/worldStore";
import { runStore } from "../../state/runStore";
import { playbackController } from "../../state/playbackStore";

export function GenerateButton() {
  const { seed, grid } = useWorldState();
  // Local editable copy of the seed input — lets the user type a custom
  // seed before pressing Generate without every keystroke touching the
  // store. Re-synced from the store's committed seed after a successful
  // Generate (including the initial auto-generated one on load), so the
  // field always shows a copyable, currently-active seed at rest.
  const [seedInput, setSeedInput] = useState(String(seed));

  // Local editable copies of width/height, same pattern as the seed input
  // above — typing doesn't touch the store until "Resize Grid" is pressed.
  // Re-synced whenever the committed grid dimensions change (including
  // after a resize this component itself triggers), so the fields always
  // reflect the currently-active size at rest.
  const [widthInput, setWidthInput] = useState(String(grid.width));
  const [heightInput, setHeightInput] = useState(String(grid.height));

  useEffect(() => {
    setSeedInput(String(seed));
  }, [seed]);

  useEffect(() => {
    setWidthInput(String(grid.width));
    setHeightInput(String(grid.height));
  }, [grid.width, grid.height]);

  const parsedSeed = Number(seedInput);
  const isValidSeed = Number.isFinite(parsedSeed) && seedInput.trim() !== "";

  const parsedWidth = Number(widthInput);
  const parsedHeight = Number(heightInput);
  const isValidWidth = Number.isInteger(parsedWidth) && parsedWidth >= MIN_GRID_DIMENSION && parsedWidth <= MAX_GRID_DIMENSION;
  const isValidHeight =
    Number.isInteger(parsedHeight) && parsedHeight >= MIN_GRID_DIMENSION && parsedHeight <= MAX_GRID_DIMENSION;
  const sizeUnchanged = parsedWidth === grid.width && parsedHeight === grid.height;
  const canResize = isValidWidth && isValidHeight && !sizeUnchanged;

  const handleResize = () => {
    const width = clampGridDimension(parsedWidth);
    const height = clampGridDimension(parsedHeight);
    worldStore.resizeGrid(width, height);
    // A resize invalidates every NodeId from the previous grid dimensions
    // (NodeId = row * width + col) — any loaded algorithm result/playback
    // timeline would reference cells that don't correspond to the same
    // physical cells (or may not exist) on the new grid. Clear both so
    // the overlay and results text don't show stale, meaningless data.
    playbackController.load([]);
    runStore.clearResults();
  };

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        World
      </h2>

      <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }} htmlFor="grid-width-input">
        Grid size
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <input
          id="grid-width-input"
          type="number"
          inputMode="numeric"
          min={MIN_GRID_DIMENSION}
          max={MAX_GRID_DIMENSION}
          value={widthInput}
          onChange={(e) => setWidthInput(e.target.value)}
          aria-label="Grid width"
          style={{ width: "50%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
        />
        <span style={{ alignSelf: "center", color: "#999", fontSize: 13 }}>×</span>
        <input
          id="grid-height-input"
          type="number"
          inputMode="numeric"
          min={MIN_GRID_DIMENSION}
          max={MAX_GRID_DIMENSION}
          value={heightInput}
          onChange={(e) => setHeightInput(e.target.value)}
          aria-label="Grid height"
          style={{ width: "50%", boxSizing: "border-box", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 13 }}
        />
      </div>
      <p style={{ fontSize: 11, color: "#999", margin: "0 0 6px" }}>
        {MIN_GRID_DIMENSION}–{MAX_GRID_DIMENSION} cells per side. Resizing regenerates the world.
      </p>
      <button
        type="button"
        disabled={!canResize}
        onClick={handleResize}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 12,
          borderRadius: 6,
          border: "1px solid #2c2a28",
          background: canResize ? "#2c2a28" : "#aaa",
          color: "white",
          fontSize: 13,
          fontWeight: 600,
          cursor: canResize ? "pointer" : "not-allowed",
        }}
      >
        Resize Grid
      </button>

      <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 4 }} htmlFor="seed-input">
        Seed
      </label>
      <input
        id="seed-input"
        type="text"
        inputMode="numeric"
        value={seedInput}
        onChange={(e) => setSeedInput(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          marginBottom: 8,
          borderRadius: 6,
          border: "1px solid #ccc",
          fontSize: 13,
        }}
      />

      <button
        type="button"
        disabled={!isValidSeed}
        onClick={() => worldStore.generateRandom(parsedSeed)}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: 6,
          borderRadius: 6,
          border: "1px solid #2c2a28",
          background: isValidSeed ? "#2c2a28" : "#aaa",
          color: "white",
          fontSize: 13,
          fontWeight: 600,
          cursor: isValidSeed ? "pointer" : "not-allowed",
        }}
      >
        Generate
      </button>

      <button
        type="button"
        onClick={() => worldStore.clear()}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "white",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Clear
      </button>
    </div>
  );
}
