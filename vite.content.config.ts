import { defineConfig } from "vite";
import { resolve } from "node:path";

const ENTRIES: Record<string, { entry: string; name: string; file: string }> = {
  content: { entry: "src/content/index.ts", name: "JobAutofillContent", file: "content.js" },
  picker: { entry: "src/picker/index.ts", name: "JobAutofillPicker", file: "picker.js" },
};

export default defineConfig(({ mode }) => {
  const target = ENTRIES[mode] ?? ENTRIES.content;
  return {
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: resolve(import.meta.dirname, target.entry),
        formats: ["iife"],
        name: target.name,
        fileName: () => target.file,
      },
    },
  };
});
