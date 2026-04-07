import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["database/better-auth.ts"],
    exclude: ["**/*.{test,spec}.ts"],
  },
});
