import type { ColumnMetadata, DeferredRefMeta, TableDefinition } from "../types";
import type { ColumnBuilder } from "./column";

type BindColumn<C, TableName extends string, ColName extends string> =
  C extends ColumnBuilder<infer T, any, any, infer Ref>
    ? ColumnBuilder<
        T,
        TableName,
        ColName,
        Ref extends DeferredRefMeta<any, infer ToTable, infer ToColumn, infer RelName>
          ? DeferredRefMeta<ColName, ToTable, ToColumn, RelName>
          : never
      >
    : never;

type BoundColumns<C extends Record<string, ColumnBuilder<any, any, any, any>>, N extends string> = {
  [K in keyof C]: BindColumn<C[K], N, Extract<K, string>>;
};

type ExtractDeferredRefs<C extends Record<string, ColumnBuilder<any, any, any, any>>> = {
  [K in keyof C]: C[K] extends ColumnBuilder<any, any, any, infer Ref> ? Ref : never;
}[keyof C];

/**
 * Define a database table with its columns
 * @param {string} name - The table name
 * @param {Record<string, ColumnBuilder<any>>} columns - Column definitions
 * @returns {TableDefinition<T, C>} The table definition object with column accessors
 */
export function table<
  N extends string,
  C extends Record<string, ColumnBuilder<any, any, any, any>>,
>(
  name: N,
  columns: C,
): TableDefinition<
  { [K in keyof C]: C[K]["__type"] },
  BoundColumns<C, N>,
  N,
  ExtractDeferredRefs<BoundColumns<C, N>>
> {
  const columnsArray: ColumnMetadata[] = [];
  const deferredRefs: TableDefinition["__deferredRefs"] = [];
  const columnMap: Record<string, string> = {};

  for (const [key, builder] of Object.entries(columns)) {
    const meta = builder.__build(key);
    columnsArray.push(meta);
    columnMap[key] = meta.name;

    const ref = builder.__getDeferredRef();
    if (ref) {
      deferredRefs.push({
        columnName: key,
        resolve: ref.resolve,
        onDelete: ref.onDelete,
        onUpdate: ref.onUpdate,
        relationName: ref.relationName,
      });
    }

    (builder as any).__tableName = name;
    (builder as any).__columnName = key;
  }

  const def = {
    __table: true,
    __name: name,
    __columns: columnsArray,
    __columnMap: columnMap,
    __deferredRefs: deferredRefs,
    ...columns,
  };

  return def as any;
}
