import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Phase 1: minimal config. No aliasing/env/build tuning added until a
// later phase actually needs it (ARCHITECTURE.md §15 dependency discipline).
export default defineConfig({
  plugins: [react()],
});
