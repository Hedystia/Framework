import { CacheManager } from "../cache";
import { MIGRATIONS_TABLE } from "../constants";
import { createDriver } from "../drivers";
import { DatabaseError } from "../errors";
import { SchemaRegistry } from "../schema";
import type {
  AnyTableDef,
  ConnectionConfig,
  DatabaseConfig,
  DatabaseDriver,
  DeleteOptions,
  InferRow,
  MigrationDefinition,
  QueryOptions,
  RelationQueryMap,
  ResolveResult,
  TableMetadata,
  UpdateOptions,
  WhereClause,
} from "../types";
import { TableRepository } from "./repository";

type TypedTableRepository<S extends readonly AnyTableDef[], T extends AnyTableDef> = {
  find<O extends QueryOptions<InferRow<T>, RelationQueryMap<S, T>> = {}>(
    options?: O,
  ): Promise<ResolveResult<S, T, O>[]>;

  findMany<O extends QueryOptions<InferRow<T>, RelationQueryMap<S, T>> = {}>(
    options?: O,
  ): Promise<ResolveResult<S, T, O>[]>;

  findFirst<O extends QueryOptions<InferRow<T>, RelationQueryMap<S, T>> = {}>(
    options?: O,
  ): Promise<ResolveResult<S, T, O> | null>;

  insert(data: Partial<InferRow<T>> | Partial<InferRow<T>>[]): Promise<InferRow<T>>;
  insertMany(data: Partial<InferRow<T>>[]): Promise<InferRow<T>[]>;
  update(options: UpdateOptions<InferRow<T>>): Promise<InferRow<T>[]>;
  delete(options: DeleteOptions<InferRow<T>>): Promise<number>;
  count(options?: Pick<QueryOptions<InferRow<T>>, "where">): Promise<number>;
  exists(options: Pick<QueryOptions<InferRow<T>>, "where">): Promise<boolean>;
  upsert(options: {
    where: WhereClause<InferRow<T>>;
    create: Partial<InferRow<T>>;
    update: Partial<InferRow<T>>;
  }): Promise<InferRow<T>>;
  truncate(): Promise<void>;
};

type ExtractRepos<S extends readonly AnyTableDef[]> = {
  [T in S[number] as T["__name"]]: TypedTableRepository<S, T>;
};

type DatabaseInstance<S extends readonly AnyTableDef[]> = ExtractRepos<S> & {
  /**
   * Initialize the database connection, create tables and run migrations
   * @returns {Promise<void>}
   */
  initialize(): Promise<void>;
  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  close(): Promise<void>;
  /**
   * Get the underlying database driver
   * @returns {DatabaseDriver} The database driver
   */
  getDriver(): DatabaseDriver;
  /**
   * Get the schema registry
   * @returns {SchemaRegistry} The schema registry
   */
  getRegistry(): SchemaRegistry;
  /**
   * Get the cache manager
   * @returns {CacheManager} The cache manager
   */
  getCache(): CacheManager;
  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any[]>} Query results
   */
  raw(sql: string, params?: unknown[]): Promise<any[]>;
  /**
   * Execute within a transaction
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>} Result
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
};

/**
 * Create a database instance with typed repositories for each schema
 * @param {DatabaseConfig} config - Database configuration
 * @returns {DatabaseInstance<S>} Database instance with table repositories
 */
export function database<S extends readonly AnyTableDef[]>(
  config: DatabaseConfig & { schemas: S },
): DatabaseInstance<S> {
  const registry = new SchemaRegistry();
  registry.register(config.schemas);

  const connectionConfig = Array.isArray(config.connection)
    ? config.connection[0]
    : config.connection;

  if (!connectionConfig) {
    throw new DatabaseError("Connection config is required");
  }

  const driver = createDriver(config.database, connectionConfig as ConnectionConfig);
  const cache = new CacheManager(config.cache);

  let initialized = false;
  let initPromise: Promise<void> | null = null;

  const ensureInitialized = async () => {
    if (initialized) {
      return;
    }
    if (initPromise) {
      return initPromise;
    }
    initPromise = doInit();
    await initPromise;
    initialized = true;
  };

  const doInit = async () => {
    await driver.connect();

    if (config.syncSchemas) {
      const allMetadata = driver.getAllTableColumns ? await driver.getAllTableColumns() : null;

      const syncPromises = Array.from(registry.getAllTables()).map(async ([, tableMeta]) => {
        const existingCols = allMetadata ? allMetadata[tableMeta.name] : null;
        const exists = allMetadata ? !!existingCols : await driver.tableExists(tableMeta.name);

        if (!exists) {
          await driver.createTable(tableMeta);
        } else {
          const cols = existingCols || (await driver.getTableColumns(tableMeta.name));
          const existingNames = new Set(cols.map((c) => c.name));
          const addColumnPromises = tableMeta.columns
            .filter((colMeta) => !existingNames.has(colMeta.name))
            .map((colMeta) => driver.addColumn(tableMeta.name, colMeta));
          await Promise.all(addColumnPromises);
        }
      });
      await Promise.all(syncPromises);
    }

    if (config.runMigrations && config.migrations && config.migrations.length > 0) {
      await runMigrations(driver, registry, config.migrations);
    }
  };

  const repos = new Map<string, TableRepository<any>>();
  for (const schema of config.schemas) {
    const repo = new TableRepository(schema.__name, driver, cache, registry);
    repos.set(schema.__name, repo);
  }

  const instance: any = {
    initialize: async () => {
      await ensureInitialized();
    },
    close: async () => {
      await driver.disconnect();
      cache.clear();
      initialized = false;
      initPromise = null;
    },
    getDriver: () => driver,
    getRegistry: () => registry,
    getCache: () => cache,
    raw: async (sql: string, params?: unknown[]) => {
      await ensureInitialized();
      return driver.query(sql, params);
    },
    transaction: async <T>(fn: () => Promise<T>) => {
      await ensureInitialized();
      return driver.transaction(fn);
    },
  };

  for (const schema of config.schemas) {
    const repo = repos.get(schema.__name)!;
    const proxy = new Proxy(repo, {
      get(target, prop, receiver) {
        const original = Reflect.get(target, prop, receiver);
        if (typeof original === "function") {
          return async (...args: any[]) => {
            await ensureInitialized();
            return original.apply(target, args);
          };
        }
        return original;
      },
    });
    instance[schema.__name] = proxy;
  }

  return instance as DatabaseInstance<S>;
}

async function runMigrations(
  driver: DatabaseDriver,
  registry: SchemaRegistry,
  migrations: MigrationDefinition[],
): Promise<void> {
  const migrationsTableMeta: TableMetadata = {
    name: MIGRATIONS_TABLE,
    columns: [
      {
        name: "id",
        type: "integer",
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
        unique: true,
        defaultValue: undefined,
      },
      {
        name: "name",
        type: "varchar",
        primaryKey: false,
        autoIncrement: false,
        notNull: true,
        unique: true,
        defaultValue: undefined,
        length: 255,
      },
      {
        name: "executed_at",
        type: "datetime",
        primaryKey: false,
        autoIncrement: false,
        notNull: true,
        unique: false,
        defaultValue: undefined,
      },
    ],
  };

  const exists = await driver.tableExists(MIGRATIONS_TABLE);
  if (!exists) {
    await driver.createTable(migrationsTableMeta);
  }

  const executed = await driver.query(`SELECT name FROM \`${MIGRATIONS_TABLE}\``);
  const executedNames = new Set(executed.map((r: any) => r.name));

  for (const migration of migrations) {
    if (executedNames.has(migration.name)) {
      continue;
    }

    const ctx = {
      schema: {
        createTable: async (tableDef: AnyTableDef) => {
          const meta = registry.getTable(tableDef.__name);
          if (meta) {
            await driver.createTable(meta);
          }
        },
        dropTable: async (name: string) => {
          await driver.dropTable(name);
        },
        addColumn: async (table: string, _name: string, column: any) => {
          await driver.addColumn(table, column);
        },
        dropColumn: async (table: string, name: string) => {
          await driver.dropColumn(table, name);
        },
        renameColumn: async (table: string, oldName: string, newName: string) => {
          await driver.renameColumn(table, oldName, newName);
        },
        addIndex: async () => {},
        dropIndex: async () => {},
      },
      sql: async (query: string, params?: unknown[]) => {
        return driver.execute(query, params);
      },
    };

    await migration.up(ctx);

    await driver.execute(
      `INSERT INTO \`${MIGRATIONS_TABLE}\` (\`name\`, \`executed_at\`) VALUES (?, ?)`,
      [migration.name, new Date()],
    );
  }
}
