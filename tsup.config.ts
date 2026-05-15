import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    gstate: "src/gstate.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  splitting: false,
  treeshake: true,
  external: ["jspdf", "svg2pdf.js"]
});
