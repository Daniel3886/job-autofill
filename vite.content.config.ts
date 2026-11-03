import { defineConfig } from "vite";
import { resolve } from "node:path";

// Builds the content script as a single IIFE file (dist/content.js).
// Runs after the main build, so it must not empty dist/.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/content/index.ts"),
      formats: ["iife"],
      name: "JobAutofillContent",
      fileName: () => "content.js",
    },
  },
});
