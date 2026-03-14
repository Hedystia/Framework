import { defineConfig } from "bumpp";
import { globSync } from "tinyglobby";

export default defineConfig({
  files: ["package.json", ...globSync(["./Packages/*/package.json"], { expandDirectories: false })],
});
