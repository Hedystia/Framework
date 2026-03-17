import { ColumnBuilder } from "../column";

/**
 * Create an INTEGER column
 * @returns {ColumnBuilder<number>} Column builder for integer type
 */
export const integer = (): ColumnBuilder<number> => new ColumnBuilder<number>("integer");

/**
 * Create a BIGINT column
 * @returns {ColumnBuilder<number>} Column builder for bigint type
 */
export const bigint = (): ColumnBuilder<number> => new ColumnBuilder<number>("bigint");

/**
 * Create a VARCHAR column with specified length
 * @param {number} [length=255] - Maximum character length
 * @returns {ColumnBuilder<string>} Column builder for varchar type
 */
export const varchar = (length = 255): ColumnBuilder<string> =>
  new ColumnBuilder<string>("varchar", length);

/**
 * Create a CHAR column with specified length
 * @param {number} [length=1] - Fixed character length
 * @returns {ColumnBuilder<string>} Column builder for char type
 */
export const char = (length = 1): ColumnBuilder<string> =>
  new ColumnBuilder<string>("char", length);

/**
 * Create a TEXT column
 * @returns {ColumnBuilder<string>} Column builder for text type
 */
export const text = (): ColumnBuilder<string> => new ColumnBuilder<string>("text");

/**
 * Create a BOOLEAN column
 * @returns {ColumnBuilder<boolean>} Column builder for boolean type
 */
export const boolean = (): ColumnBuilder<boolean> => new ColumnBuilder<boolean>("boolean");

/**
 * Create a JSON column
 * @returns {ColumnBuilder<unknown>} Column builder for json type
 */
export const json = (): ColumnBuilder<unknown> => new ColumnBuilder<unknown>("json");

/**
 * Create a DATETIME column
 * @returns {ColumnBuilder<Date>} Column builder for datetime type
 */
export const datetime = (): ColumnBuilder<Date> => new ColumnBuilder<Date>("datetime");

/**
 * Create a TIMESTAMP column
 * @returns {ColumnBuilder<Date>} Column builder for timestamp type
 */
export const timestamp = (): ColumnBuilder<Date> => new ColumnBuilder<Date>("timestamp");

/**
 * Create a DECIMAL column with precision and scale
 * @param {number} [precision=10] - Total number of digits
 * @param {number} [scale=2] - Number of decimal digits
 * @returns {ColumnBuilder<number>} Column builder for decimal type
 */
export const decimal = (precision = 10, scale = 2): ColumnBuilder<number> =>
  new ColumnBuilder<number>("decimal", undefined, precision, scale);

/**
 * Create a FLOAT column
 * @returns {ColumnBuilder<number>} Column builder for float type
 */
export const float = (): ColumnBuilder<number> => new ColumnBuilder<number>("float");

/**
 * Create a BLOB column
 * @returns {ColumnBuilder<Buffer>} Column builder for blob type
 */
export const blob = (): ColumnBuilder<Buffer> => new ColumnBuilder<Buffer>("blob");

/**
 * Starter class for creating columns with a pre-set database column name
 * @example
 * // Start with name, then pick column type
 * guildId: name("guild_id").varchar(255)
 */
export class NamedColumnStarter {
  private _alias: string;

  constructor(alias: string) {
    this._alias = alias;
  }

  /** Create an INTEGER column with this database column name */
  integer(): ColumnBuilder<number> {
    return new ColumnBuilder<number>("integer").name(this._alias);
  }

  /** Create a BIGINT column with this database column name */
  bigint(): ColumnBuilder<number> {
    return new ColumnBuilder<number>("bigint").name(this._alias);
  }

  /** Create a VARCHAR column with this database column name
   * @param {number} [length=255] - Maximum character length
   */
  varchar(length = 255): ColumnBuilder<string> {
    return new ColumnBuilder<string>("varchar", length).name(this._alias);
  }

  /** Create a CHAR column with this database column name
   * @param {number} [length=1] - Fixed character length
   */
  char(length = 1): ColumnBuilder<string> {
    return new ColumnBuilder<string>("char", length).name(this._alias);
  }

  /** Create a TEXT column with this database column name */
  text(): ColumnBuilder<string> {
    return new ColumnBuilder<string>("text").name(this._alias);
  }

  /** Create a BOOLEAN column with this database column name */
  boolean(): ColumnBuilder<boolean> {
    return new ColumnBuilder<boolean>("boolean").name(this._alias);
  }

  /** Create a JSON column with this database column name */
  json(): ColumnBuilder<unknown> {
    return new ColumnBuilder<unknown>("json").name(this._alias);
  }

  /** Create a DATETIME column with this database column name */
  datetime(): ColumnBuilder<Date> {
    return new ColumnBuilder<Date>("datetime").name(this._alias);
  }

  /** Create a TIMESTAMP column with this database column name */
  timestamp(): ColumnBuilder<Date> {
    return new ColumnBuilder<Date>("timestamp").name(this._alias);
  }

  /** Create a DECIMAL column with this database column name
   * @param {number} [precision=10] - Total number of digits
   * @param {number} [scale=2] - Number of decimal digits
   */
  decimal(precision = 10, scale = 2): ColumnBuilder<number> {
    return new ColumnBuilder<number>("decimal", undefined, precision, scale).name(this._alias);
  }

  /** Create a FLOAT column with this database column name */
  float(): ColumnBuilder<number> {
    return new ColumnBuilder<number>("float").name(this._alias);
  }

  /** Create a BLOB column with this database column name */
  blob(): ColumnBuilder<Buffer> {
    return new ColumnBuilder<Buffer>("blob").name(this._alias);
  }
}

/**
 * Create a column with a custom database column name, then pick the column type
 * @param {string} alias - The column name to use in the database
 * @returns {NamedColumnStarter} A starter object to pick the column type
 * @example
 * guildId: name("guild_id").varchar(255).notNull()
 */
export const name = (alias: string): NamedColumnStarter => new NamedColumnStarter(alias);

/**
 * Column type helpers object for schema definitions
 * @returns {typeof d} Column type helpers
 */
export const d = {
  integer,
  bigint,
  varchar,
  char,
  text,
  boolean,
  json,
  datetime,
  timestamp,
  decimal,
  float,
  blob,
  name,
};
