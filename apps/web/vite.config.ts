import { resolve } from "node:path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        changelog: resolve(__dirname, "changelog/index.html"),
      },
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, "../..")],
    },
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
});
