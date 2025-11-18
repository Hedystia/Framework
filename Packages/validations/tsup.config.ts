import { defineConfig } from "tsup";

export default defineConfig(({ watch = false }) => ({
  clean: true,
  dts: {
    resolve: true,
  },
  entry: {
    index: "lib/index.ts",
  },
  format: "cjs",
  target: "esnext",
  splitting: false,
  watch,
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  keepNames: false,
  sourcemap: false,
  external: ["bun"],
}));
