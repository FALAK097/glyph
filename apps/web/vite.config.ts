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
      // Intentionally widen `server.fs.allow` to the repo root so Vite can read
      // shared workspace files like CHANGELOG.md during dev/build; this is a
      // deliberate security tradeoff and should not be tightened accidentally.
      allow: [resolve(__dirname, "../..")],
    },
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
});
