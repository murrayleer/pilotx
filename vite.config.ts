import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/ui/popup.html"),
        options: resolve(__dirname, "src/ui/options.html"),
        panel: resolve(__dirname, "src/ui/panel.html"),
        "content-script": resolve(
          __dirname,
          "src/content/content-script.ts"
        ),
        "service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts"
        )
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "service-worker") {
            return "background/[name].js";
          }
          if (chunk.name === "content-script") {
            return "content/[name].js";
          }
          return "ui/[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    },
    sourcemap: mode !== "production",
    target: "es2020",
    minify: mode === "production" ? "terser" : false
  }
}));
