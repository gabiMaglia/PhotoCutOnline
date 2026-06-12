import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and serves from ../dist
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  worker: {
    // el worker de recorte hace import() dinámico (onnxruntime-web):
    // requiere workers en formato ES (soportado por toda nuestra matriz)
    format: "es",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    target: "es2021",
    sourcemap: false,
  },
});
