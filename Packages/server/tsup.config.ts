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
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  keepNames: false,
  sourcemap: false,
  external: ["@hedystia/validations", "bun"],
}));
