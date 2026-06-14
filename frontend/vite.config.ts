import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import tailwindcss from "@tailwindcss/vite"

const target = process.env.VITE_API_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  envDir: path.resolve(__dirname, ".."), // because .env is in the root directory
  server: {
    proxy: {
      "/api": {
        target,
        changeOrigin: true,
      },
    },
  },
});
