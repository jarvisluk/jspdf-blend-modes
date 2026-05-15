import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Point bare imports at the library source so the demo always tracks
      // the current state of the workspace without a publish/install loop.
      "jspdf-blend-modes": resolve(__dirname, "../../src/index.ts")
    }
  },
  server: {
    port: 5173
  },
  base: "./"
});
