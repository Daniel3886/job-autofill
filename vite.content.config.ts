import { defineConfig } from "vite";
import { resolve } from "node:path";

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
