import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(PROJECT_DIR, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
