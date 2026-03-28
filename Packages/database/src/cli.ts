#!/usr/bin/env bun
import { migrateDown, migrateUp } from "./cli/commands/migrate";
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

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function getMigrateOptions() {
  return {
    migrationsPath: getFlag("--migrations"),
    schemasPath: getFlag("--schemas"),
    database: getFlag("--database"),
    connection: getFlag("--connection"),
    steps: getFlag("--steps") ? Number(getFlag("--steps")) : undefined,
  };
}

switch (command) {
  case "migration": {
    const action = subCommand === "create" ? "create" : "create";
    if (action === "create") {
      const name = subCommand === "create" ? getName() : subCommand;
      if (!name) {
        console.log("Usage: @hedystia/db migration create <name> [--path <path>] [--no-id]");
        console.log("       @hedystia/db migration <name> [--path <path>] [--no-id]");
        process.exit(1);
      }
      createMigration(name, getFlag("--path"), hasFlag("--no-id"));
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
  case "migrate": {
    const options = getMigrateOptions();
    if (subCommand === "up") {
      migrateUp(options).catch((err) => {
        console.error("Migration failed:", err.message);
        process.exit(1);
      });
    } else if (subCommand === "down") {
      migrateDown(options).catch((err) => {
        console.error("Rollback failed:", err.message);
        process.exit(1);
      });
    } else {
      console.log("Usage: @hedystia/db migrate up [options]");
      console.log("       @hedystia/db migrate down [options]");
      console.log("");
      console.log("Options:");
      console.log("  --migrations <path>    Path to migrations directory");
      console.log("  --schemas <path>       Path to schemas directory");
      console.log("  --database <type>      Database type (sqlite, mysql, mariadb)");
      console.log("  --connection <config>  Connection string or JSON config");
      console.log(
        "  --steps <n>            Number of migrations to rollback (down only, default: 1)",
      );
      process.exit(1);
    }
    break;
  }
  default: {
    console.log("@hedystia/db CLI");
    console.log("");
    console.log("Commands:");
    console.log("  migration create <name> [--path <path>] [--no-id]  Create a new migration file");
    console.log(
      "  migration <name> [--path <path>] [--no-id]         Create a new migration file (shorthand)",
    );
    console.log("  schema create <name> [--path <path>]     Create a new schema file");
    console.log("  schema <name> [--path <path>]            Create a new schema file (shorthand)");
    console.log("  migrate up [options]                     Run pending migrations");
    console.log("  migrate down [options]                   Rollback migrations");
    break;
  }
}
