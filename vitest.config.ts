import { defineConfig } from "vitest/config";

// Phase 1 tests are pure logic (Grid, RNG, generator) — no DOM needed, so
// no jsdom dependency is added. Revisit `environment` when a later phase
// adds component tests (not required by ARCHITECTURE.md's testing strategy
// for the MVP anyway).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
