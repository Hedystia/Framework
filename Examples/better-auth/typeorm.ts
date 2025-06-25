import "reflect-metadata";

import { entities, migrations } from "@hedystia/better-auth-typeorm";
import path from "path";
import { DataSource } from "typeorm";

export const dataSource = new DataSource({
  type: "sqlite",
  database: path.join(process.cwd(), "./test.db"),
  entities: [...entities],
  migrations: [...migrations],
  migrationsRun: true,
});

await dataSource.initialize();
