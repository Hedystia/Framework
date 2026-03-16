import type {
  ColumnDataType,
  ColumnMetadata,
  DeferredRefMeta,
  ReferenceAction,
} from "../types";

/**
 * Base column builder with chainable methods for defining column properties
 * @template T - The TypeScript type this column resolves to
 * @template TN - The table name this column belongs to (set by table())
 * @template CN - The column name (set by table())
 * @template Ref - The deferred reference metadata (set by references())
 */
export class ColumnBuilder<
  T = unknown,
  TN extends string = string,
  CN extends string = string,
  Ref extends DeferredRefMeta = never,
> {
  declare readonly __type: T;
  declare readonly __tableName: TN;
  declare readonly __columnName: CN;
  declare readonly __ref: Ref;
  private _type: ColumnDataType;
  private _primaryKey = false;
  private _autoIncrement = false;
  private _notNull = false;
  private _unique = false;
  private _defaultValue: unknown = undefined;
  private _length?: number;
  private _precision?: number;
  private _scale?: number;
  private _references?: {
    resolve: () => { table: string; column: string };
    onDelete?: ReferenceAction;
    onUpdate?: ReferenceAction;
    relationName?: string;
  };

  constructor(type: ColumnDataType, length?: number, precision?: number, scale?: number) {
    this._type = type;
    this._length = length;
    this._precision = precision;
    this._scale = scale;
  }

  /**
   * Mark this column as a primary key
   * @returns {ColumnBuilder<T, TN, CN, Ref>} The column builder for chaining
   */
  primaryKey(): ColumnBuilder<T, TN, CN, Ref> {
    this._primaryKey = true;
    return this;
  }

  /**
   * Mark this column as auto-incrementing
   * @returns {ColumnBuilder<T, TN, CN, Ref>} The column builder for chaining
   */
  autoIncrement(): ColumnBuilder<T, TN, CN, Ref> {
    this._autoIncrement = true;
    return this;
  }

  /**
   * Mark this column as NOT NULL
   * @returns {ColumnBuilder<NonNullable<T>, TN, CN, Ref>} The column builder for chaining
   */
  notNull(): ColumnBuilder<NonNullable<T>, TN, CN, Ref> {
    this._notNull = true;
    return this as unknown as ColumnBuilder<NonNullable<T>, TN, CN, Ref>;
  }

  /**
   * Mark this column as nullable
   * @returns {ColumnBuilder<T | null, TN, CN, Ref>} The column builder for chaining
   */
  nullable(): ColumnBuilder<T | null, TN, CN, Ref> {
    this._notNull = false;
    return this as unknown as ColumnBuilder<T | null, TN, CN, Ref>;
  }

  /**
   * Set a default value for this column
   * @param {T} value - The default value
   * @returns {ColumnBuilder<T, TN, CN, Ref>} The column builder for chaining
   */
  default(value: T): ColumnBuilder<T, TN, CN, Ref> {
    this._defaultValue = value;
    return this;
  }

  /**
   * Mark this column as having a unique constraint
   * @returns {ColumnBuilder<T, TN, CN, Ref>} The column builder for chaining
   */
  unique(): ColumnBuilder<T, TN, CN, Ref> {
    this._unique = true;
    return this;
  }

  /**
   * Add a foreign key reference to another table's column
   * @param {() => ColumnBuilder<any>} ref - A function returning the referenced column
   * @param {object} [options] - Reference options
   * @param {ReferenceAction} [options.onDelete] - Action on delete
   * @param {ReferenceAction} [options.onUpdate] - Action on update
   * @param {string} [options.relationName] - Name for the relation
   * @returns {ColumnBuilder<T>} The column builder for chaining
   */
  references<
    R extends ColumnBuilder<any, string, string, any>,
    O extends {
      onDelete?: ReferenceAction;
      onUpdate?: ReferenceAction;
      relationName?: string;
    } = never,
  >(
    ref: () => R,
    options?: O,
  ): ColumnBuilder<
    T,
    TN,
    CN,
    DeferredRefMeta<
      CN,
      R["__tableName"],
      R["__columnName"],
      O extends { relationName: infer N extends string } ? N : undefined
    >
  > {
    this._references = {
      resolve: () => {
        const col = ref();
        return {
          table: (col as any).__tableName ?? "",
          column: (col as any).__columnName ?? "",
        };
      },
      onDelete: options?.onDelete,
      onUpdate: options?.onUpdate,
      relationName: options?.relationName,
    };
    return this as any;
  }

  /**
   * Build the column metadata from the builder configuration
   * @param {string} name - The column name
   * @returns {ColumnMetadata} The built column metadata
   */
  __build(name: string): ColumnMetadata {
    return {
      name,
      type: this._type,
      primaryKey: this._primaryKey,
      autoIncrement: this._autoIncrement,
      notNull: this._notNull || this._primaryKey,
      unique: this._unique || this._primaryKey,
      defaultValue: this._defaultValue,
      length: this._length,
      precision: this._precision,
      scale: this._scale,
    };
  }

  /**
   * Get deferred reference data if this column has a foreign key reference
   * @returns {object | null} The deferred reference data or null
   */
  __getDeferredRef(): {
    resolve: () => { table: string; column: string };
    onDelete?: ReferenceAction;
    onUpdate?: ReferenceAction;
    relationName?: string;
  } | null {
    return this._references ?? null;
  }
}
