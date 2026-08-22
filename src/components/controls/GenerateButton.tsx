import { useState, useEffect } from "react";
import { worldStore, useWorldState } from "../../state/worldStore";

export function GenerateButton() {
  const { seed } = useWorldState();
  // Local editable copy of the seed input — lets the user type a custom
  // seed before pressing Generate without every keystroke touching the
  // store. Re-synced from the store's committed seed after a successful
  // Generate (including the initial auto-generated one on load), so the
  // field always shows a copyable, currently-active seed at rest.
  const [seedInput, setSeedInput] = useState(String(seed));

  useEffect(() => {
    setSeedInput(String(seed));
  }, [seed]);

  const parsedSeed = Number(seedInput);
  const isValidSeed = Number.isFinite(parsedSeed) && seedInput.trim() !== "";

  return (
    <div>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", margin: "0 0 8px" }}>
        World
      </h2>

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
