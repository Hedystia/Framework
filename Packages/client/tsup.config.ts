import { defineConfig } from "tsup";

export default defineConfig(({ watch = false }) => ({
  clean: true,
  dts: true,
  entry: {
    index: "src/index.ts",
  },
  format: "cjs",
  target: "esnext",
  splitting: false,
  watch,
  esbuildOptions(options) {
    options.minifyIdentifiers = true;
    options.minifySyntax = true;
    options.minifyWhitespace = true;
    options.keepNames = false;
  },
  external: ["bun", "hedystia"],
}));
