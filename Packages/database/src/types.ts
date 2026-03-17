export type ColumnDataType =
  | "integer"
  | "varchar"
  | "text"
  | "boolean"
  | "json"
  | "datetime"
  | "decimal"
  | "float"
  | "char"
  | "timestamp"
  | "bigint"
  | "blob";

export type DatabaseType =
  | "mysql"
  | "mariadb"
  | "sqlite"
  | "file"
  | { name: "mysql"; provider: "mysql" | "mysql2" }
  | { name: "mariadb"; provider: "mysql" | "mysql2" }
  | { name: "sqlite"; provider: "better-sqlite3" | "sqlite3" | "sql.js" | "bun:sqlite" }
  | { name: "file"; provider: string };

export interface ColumnMetadata {
  name: string;
  type: ColumnDataType;
  primaryKey: boolean;
  autoIncrement: boolean;
  notNull: boolean;
  unique: boolean;
  defaultValue: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  columnAlias?: string;
  references?: {
    table: string;
    column: string;
    onDelete?: ReferenceAction;
    onUpdate?: ReferenceAction;
    relationName?: string;
  };
}

export type ReferenceAction = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
}

export type DeferredRefMeta<
  ColumnName extends string = string,
  TargetTable extends string = string,
  TargetColumn extends string = string,
  RelationName extends string | undefined = string | undefined,
> = {
  columnName: ColumnName;
  targetTable: TargetTable;
  targetColumn: TargetColumn;
  relationName?: RelationName;
  onDelete?: ReferenceAction;
  onUpdate?: ReferenceAction;
};

export type TableDefinition<
  T extends Record<string, any> = Record<string, any>,
  C extends Record<string, any> = {},
  N extends string = string,
  Refs extends DeferredRefMeta = any,
> = {
  __table: true;
  __name: N;
  __row: T;
  __refs: Refs;
  __columns: ColumnMetadata[];
  __columnMap: Record<string, string>;
  __deferredRefs: Array<{
    columnName: string;
    resolve: () => { table: string; column: string };
    onDelete?: ReferenceAction;
    onUpdate?: ReferenceAction;
    relationName?: string;
  }>;
} & C;

export type InferRow<T> = T extends { __row: infer R } ? R : never;

export type InferInsert<T> =
  T extends TableDefinition<infer R, any, any>
    ? {
        [K in keyof R as K extends AutoIncrementKeys<T> ? never : K]: R[K];
      } & {
        [K in AutoIncrementKeys<T>]?: R[K];
      }
    : never;

type AutoIncrementKeys<T> = T extends TableDefinition<infer R, any, any> ? keyof R : never;

export type InferUpdate<T> = T extends TableDefinition<infer R, any, any> ? Partial<R> : never;

export interface WhereCondition {
  eq?: unknown;
  neq?: unknown;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
  like?: string;
  notLike?: string;
  in?: unknown[];
  notIn?: unknown[];
  isNull?: boolean;
  between?: [unknown, unknown];
}

export type WhereClause<T = Record<string, any>> = {
  [K in keyof T]?: T[K] | WhereCondition;
} & {
  OR?: WhereClause<T>[];
  AND?: WhereClause<T>[];
};

export interface QueryOptions<T = Record<string, any>, Rel extends Record<string, any> = {}> {
  where?: WhereClause<T>;
  select?: (keyof T)[];
  orderBy?: Partial<Record<keyof T, "asc" | "desc">>;
  take?: number;
  skip?: number;
  with?: {
    [K in keyof Rel]?: boolean | QueryOptions<Rel[K] extends { row: infer R } ? R : Rel[K]>;
  };
}

export interface UpdateOptions<T = Record<string, any>> {
  where: WhereClause<T>;
  data: Partial<T>;
}

export interface DeleteOptions<T = Record<string, any>> {
  where: WhereClause<T>;
}

export interface MySQLConnectionConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

export interface SQLiteConnectionConfig {
  filename: string;
}

export interface FileConnectionConfig {
  directory: string;
}

export type ConnectionConfig =
  | MySQLConnectionConfig
  | SQLiteConnectionConfig
  | FileConnectionConfig;

export interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  maxTtl?: number;
  maxEntries?: number;
}

export interface DatabaseConfig {
  schemas: readonly TableDefinition<any, any, any>[];
  migrations?: any[];
  database: DatabaseType;
  connection: ConnectionConfig | ConnectionConfig[];
  runMigrations?: boolean;
  syncSchemas?: boolean;
  cache?: boolean | CacheConfig;
}

export interface MigrationContext {
  schema: {
    createTable: (table: TableDefinition) => Promise<void>;
    dropTable: (name: string) => Promise<void>;
    addColumn: (table: string, name: string, column: ColumnMetadata) => Promise<void>;
    dropColumn: (table: string, name: string) => Promise<void>;
    renameColumn: (table: string, oldName: string, newName: string) => Promise<void>;
    addIndex: (table: string, columns: string[], unique?: boolean) => Promise<void>;
    dropIndex: (table: string, indexName: string) => Promise<void>;
  };
  sql: (query: string, params?: unknown[]) => Promise<unknown>;
}

export interface MigrationDefinition {
  name: string;
  up: (ctx: MigrationContext) => Promise<void>;
  down: (ctx: MigrationContext) => Promise<void>;
}

export interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string, params?: unknown[]): Promise<any>;
  query(sql: string, params?: unknown[]): Promise<any[]>;
  tableExists(name: string): Promise<boolean>;
  getTableColumns(name: string): Promise<ColumnMetadata[]>;
  createTable(meta: TableMetadata): Promise<void>;
  dropTable(name: string): Promise<void>;
  addColumn(table: string, column: ColumnMetadata): Promise<void>;
  dropColumn(table: string, name: string): Promise<void>;
  renameColumn(table: string, oldName: string, newName: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  getAllTableColumns?(): Promise<Record<string, ColumnMetadata[]>>;
}

export interface Repository<T extends Record<string, any>> {
  find(options?: QueryOptions<T>): Promise<T[]>;
  findMany(options?: QueryOptions<T>): Promise<T[]>;
  findFirst(options?: QueryOptions<T>): Promise<T | null>;
  insert(data: Partial<T> | Partial<T>[]): Promise<T>;
  insertMany(data: Partial<T>[]): Promise<T[]>;
  update(options: UpdateOptions<T>): Promise<T[]>;
  delete(options: DeleteOptions<T>): Promise<number>;
  count(options?: Pick<QueryOptions<T>, "where">): Promise<number>;
  exists(options: Pick<QueryOptions<T>, "where">): Promise<boolean>;
  upsert(options: { where: WhereClause<T>; create: Partial<T>; update: Partial<T> }): Promise<T>;
  truncate(): Promise<void>;
}

export type AnyTableDef = TableDefinition<any, any, any, any>;

type TableRefs<T> = T extends { __refs: infer R } ? R : never;

type TableName<T> = T extends { __name: infer N extends string } ? N : never;

type SchemaByName<S extends readonly AnyTableDef[], N extends string> = Extract<
  S[number],
  { __name: N }
>;

type StripIdSuffix<S extends string> = S extends `${infer Base}Id`
  ? Base
  : S extends `${infer Base}_id`
    ? Base
    : S;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type ForwardRelationEntries<S extends readonly AnyTableDef[], T extends AnyTableDef> =
  TableRefs<T> extends infer R
    ? R extends DeferredRefMeta<infer Col, infer ToTable, any, infer Name>
      ? {
          [K in Name extends string ? Name : StripIdSuffix<Col>]: {
            table: SchemaByName<S, ToTable>;
            many: false;
          };
        }
      : never
    : never;

type ReverseRelationEntry<U extends AnyTableDef, TargetName extends string> =
  TableRefs<U> extends infer R
    ? R extends DeferredRefMeta<any, TargetName, any, any>
      ? { [K in TableName<U>]: { table: U; many: true } }
      : never
    : never;

type ReverseRelationEntries<
  S extends readonly AnyTableDef[],
  T extends AnyTableDef,
> = ReverseRelationEntry<S[number], TableName<T>>;

export type RelationsFor<S extends readonly AnyTableDef[], T extends AnyTableDef> = Simplify<
  UnionToIntersection<ForwardRelationEntries<S, T> | ReverseRelationEntries<S, T>>
>;

type DepthPrev = [never, 0, 1, 2, 3];

type ExtractRelationRow<Rel> = Rel extends { table: infer R } ? InferRow<R> : never;
type ExtractRelationMany<Rel> = Rel extends { many: true } ? true : false;

export type RelationQueryMap<
  S extends readonly AnyTableDef[],
  T extends AnyTableDef,
  D extends number = 3,
> = [D] extends [never]
  ? {}
  : {
      [K in keyof RelationsFor<S, T>]: {
        row: ExtractRelationRow<RelationsFor<S, T>[K]>;
        many: ExtractRelationMany<RelationsFor<S, T>[K]>;
        relations: RelationsFor<S, T>[K] extends { table: infer R extends AnyTableDef }
          ? RelationQueryMap<S, R, DepthPrev[D]>
          : {};
      };
    };

type ResolveWith<S extends readonly AnyTableDef[], T extends AnyTableDef, W> = [W] extends [
  undefined,
]
  ? {}
  : W extends Record<string, any>
    ? {
        [K in keyof W & keyof RelationsFor<S, T>]: ExtractRelationMany<
          RelationsFor<S, T>[K]
        > extends true
          ? ExtractRelationRow<RelationsFor<S, T>[K]>[]
          : ExtractRelationRow<RelationsFor<S, T>[K]> | null;
      }
    : {};

export type ResolveResult<
  S extends readonly AnyTableDef[],
  T extends AnyTableDef,
  O,
> = InferRow<T> & ResolveWith<S, T, O extends { with: infer W } ? W : undefined>;
