import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      template: "treemap",
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: "dist/stats.html",
    }),
    visualizer({
      template: "raw-data",
      open: false,
      gzipSize: true,
      filename: "dist/stats.json",
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(PROJECT_DIR, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@hugeicons")) {
              return "icons-vendor";
            }
            if (id.includes("highlight.js") || id.includes("lowlight")) {
              return "highlight-vendor";
            }
            if (id.includes("@tiptap") || id.includes("prosemirror")) {
              return "tiptap-vendor";
            }
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
