#!/usr/bin/env bun
import { createMigration } from "./cli/commands/migration";
import { createSchema } from "./cli/commands/schema";

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

function getFlag(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

function getName(): string | undefined {
  return getFlag("--name") ?? args[2];
}

switch (command) {
  case "migration": {
    const action = subCommand === "create" ? "create" : "create";
    if (action === "create") {
      const name = subCommand === "create" ? getName() : subCommand;
      if (!name) {
        console.log("Usage: @hedystia/db migration create <name> [--path <path>]");
        console.log("       @hedystia/db migration <name> [--path <path>]");
        process.exit(1);
      }
      createMigration(name, getFlag("--path"));
    }
    break;
  }
  case "schema": {
    const action = subCommand === "create" ? "create" : "create";
    if (action === "create") {
      const name = subCommand === "create" ? getName() : subCommand;
      if (!name) {
        console.log("Usage: @hedystia/db schema create <name> [--path <path>]");
        console.log("       @hedystia/db schema <name> [--path <path>]");
        process.exit(1);
      }
      createSchema(name, getFlag("--path"));
    }
    break;
  }
  default: {
    console.log("@hedystia/db CLI");
    console.log("");
    console.log("Commands:");
    console.log("  migration create <name> [--path <path>]  Create a new migration file");
    console.log("  migration <name> [--path <path>]         Create a new migration file (shorthand)");
    console.log("  schema create <name> [--path <path>]     Create a new schema file");
    console.log("  schema <name> [--path <path>]            Create a new schema file (shorthand)");
    break;
  }
}
