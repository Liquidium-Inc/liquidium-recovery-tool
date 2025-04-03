import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "liquidium-recovery-tool/",
  plugins: [
    wasm(),
    react(),
    nodePolyfills({ include: ["buffer", "crypto"] }),
    tailwindcss(),
  ],
  build: {
    target: "esnext"
  }
});
