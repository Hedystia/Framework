import type {
  ColumnDataType,
  ColumnMetadata,
  DatabaseType,
  TableMetadata,
  WhereClause,
  WhereCondition,
} from "../types";

/**
 * Compile column type to SQL string for a specific database dialect
 * @param {ColumnMetadata} col - Column metadata
 * @param {DatabaseType} dialect - Database dialect
 * @returns {string} SQL column type string
 */
export function compileColumnType(col: ColumnMetadata, dialect: DatabaseType): string {
  const name = typeof dialect === "string" ? dialect : dialect.name;

  const typeMap: Record<ColumnDataType, Record<string, string>> = {
    integer: { mysql: "INT", mariadb: "INT", sqlite: "INTEGER", file: "INTEGER" },
    bigint: { mysql: "BIGINT", mariadb: "BIGINT", sqlite: "INTEGER", file: "BIGINT" },
    varchar: {
      mysql: `VARCHAR(${col.length ?? 255})`,
      mariadb: `VARCHAR(${col.length ?? 255})`,
      sqlite: "TEXT",
      file: "VARCHAR",
    },
    char: {
      mysql: `CHAR(${col.length ?? 1})`,
      mariadb: `CHAR(${col.length ?? 1})`,
      sqlite: "TEXT",
      file: "CHAR",
    },
    text: { mysql: "TEXT", mariadb: "TEXT", sqlite: "TEXT", file: "TEXT" },
    boolean: { mysql: "TINYINT(1)", mariadb: "TINYINT(1)", sqlite: "INTEGER", file: "BOOLEAN" },
    json: { mysql: "JSON", mariadb: "JSON", sqlite: "TEXT", file: "JSON" },
    datetime: { mysql: "DATETIME", mariadb: "DATETIME", sqlite: "TEXT", file: "DATETIME" },
    timestamp: { mysql: "TIMESTAMP", mariadb: "TIMESTAMP", sqlite: "TEXT", file: "TIMESTAMP" },
    decimal: {
      mysql: `DECIMAL(${col.precision ?? 10},${col.scale ?? 2})`,
      mariadb: `DECIMAL(${col.precision ?? 10},${col.scale ?? 2})`,
      sqlite: "REAL",
      file: "DECIMAL",
    },
    float: { mysql: "FLOAT", mariadb: "FLOAT", sqlite: "REAL", file: "FLOAT" },
    blob: { mysql: "BLOB", mariadb: "BLOB", sqlite: "BLOB", file: "BLOB" },
  };

  return typeMap[col.type]?.[name] ?? "TEXT";
}

/**
 * Compile a column definition to a SQL fragment
 * @param {ColumnMetadata} col - Column metadata
 * @param {DatabaseType} dialect - Database dialect
 * @returns {string} SQL column definition
 */
export function compileColumnDef(col: ColumnMetadata, dialect: DatabaseType): string {
  const parts: string[] = [`\`${col.name}\``, compileColumnType(col, dialect)];

  if (col.primaryKey) {
    parts.push("PRIMARY KEY");
  }
  if (col.autoIncrement) {
    parts.push(dialect === "mysql" ? "AUTO_INCREMENT" : "AUTOINCREMENT");
  }
  if (col.notNull && !col.primaryKey) {
    parts.push("NOT NULL");
  }
  if (col.unique && !col.primaryKey) {
    parts.push("UNIQUE");
  }
  if (col.defaultValue !== undefined) {
    if (typeof col.defaultValue === "string") {
      parts.push(`DEFAULT '${col.defaultValue}'`);
    } else if (col.defaultValue === null) {
      parts.push("DEFAULT NULL");
    } else {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }
  }

  return parts.join(" ");
}

/**
 * Compile a CREATE TABLE statement from table metadata
 * @param {TableMetadata} table - Table metadata
 * @param {DatabaseType} dialect - Database dialect
 * @returns {string} CREATE TABLE SQL statement
 */
export function compileCreateTable(table: TableMetadata, dialect: DatabaseType): string {
  const columnDefs: string[] = [];
  const constraints: string[] = [];

  for (const col of table.columns) {
    columnDefs.push(compileColumnDef(col, dialect));

    if (col.references) {
      const onDelete = col.references.onDelete ? ` ON DELETE ${col.references.onDelete}` : "";
      const onUpdate = col.references.onUpdate ? ` ON UPDATE ${col.references.onUpdate}` : "";
      constraints.push(
        `FOREIGN KEY (\`${col.name}\`) REFERENCES \`${col.references.table}\`(\`${col.references.column}\`)${onDelete}${onUpdate}`,
      );
    }
  }

  const allDefs = [...columnDefs, ...constraints].join(", ");
  return `CREATE TABLE IF NOT EXISTS \`${table.name}\` (${allDefs})`;
}

/**
 * Compile a WHERE clause from a condition object
 * @param {WhereClause} where - Where clause object
 * @param {unknown[]} params - Parameter array to push values into
 * @returns {string} SQL WHERE fragment
 */
export function compileWhere(where: WhereClause, params: unknown[]): string {
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(value)) {
      const orParts = (value as WhereClause[]).map((sub) => compileWhere(sub, params));
      if (orParts.length > 0) {
        conditions.push(`(${orParts.join(" OR ")})`);
      }
      continue;
    }
    if (key === "AND" && Array.isArray(value)) {
      const andParts = (value as WhereClause[]).map((sub) => compileWhere(sub, params));
      if (andParts.length > 0) {
        conditions.push(`(${andParts.join(" AND ")})`);
      }
      continue;
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const cond = value as WhereCondition;
      if (cond.eq !== undefined) {
        params.push(cond.eq);
        conditions.push(`\`${key}\` = ?`);
      }
      if (cond.neq !== undefined) {
        params.push(cond.neq);
        conditions.push(`\`${key}\` != ?`);
      }
      if (cond.gt !== undefined) {
        params.push(cond.gt);
        conditions.push(`\`${key}\` > ?`);
      }
      if (cond.gte !== undefined) {
        params.push(cond.gte);
        conditions.push(`\`${key}\` >= ?`);
      }
      if (cond.lt !== undefined) {
        params.push(cond.lt);
        conditions.push(`\`${key}\` < ?`);
      }
      if (cond.lte !== undefined) {
        params.push(cond.lte);
        conditions.push(`\`${key}\` <= ?`);
      }
      if (cond.like !== undefined) {
        params.push(cond.like);
        conditions.push(`\`${key}\` LIKE ?`);
      }
      if (cond.notLike !== undefined) {
        params.push(cond.notLike);
        conditions.push(`\`${key}\` NOT LIKE ?`);
      }
      if (cond.in !== undefined && Array.isArray(cond.in)) {
        const placeholders = cond.in.map(() => "?").join(", ");
        params.push(...cond.in);
        conditions.push(`\`${key}\` IN (${placeholders})`);
      }
      if (cond.notIn !== undefined && Array.isArray(cond.notIn)) {
        const placeholders = cond.notIn.map(() => "?").join(", ");
        params.push(...cond.notIn);
        conditions.push(`\`${key}\` NOT IN (${placeholders})`);
      }
      if (cond.isNull === true) {
        conditions.push(`\`${key}\` IS NULL`);
      }
      if (cond.isNull === false) {
        conditions.push(`\`${key}\` IS NOT NULL`);
      }
      if (cond.between !== undefined && Array.isArray(cond.between)) {
        params.push(cond.between[0], cond.between[1]);
        conditions.push(`\`${key}\` BETWEEN ? AND ?`);
      }
    } else {
      params.push(value);
      conditions.push(`\`${key}\` = ?`);
    }
  }

  return conditions.length > 0 ? conditions.join(" AND ") : "1=1";
}

/**
 * Compile a SELECT query from options
 * @param {string} tableName - Table name
 * @param {object} options - Query options
 * @param {unknown[]} params - Parameter array
 * @returns {string} SQL SELECT statement
 */
export function compileSelect(
  tableName: string,
  options: {
    select?: string[];
    where?: WhereClause;
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
    skip?: number;
  },
  params: unknown[],
): string {
  const cols = options.select?.map((c) => `\`${String(c)}\``).join(", ") ?? "*";
  let sql = `SELECT ${cols} FROM \`${tableName}\``;

  if (options.where && Object.keys(options.where).length > 0) {
    sql += ` WHERE ${compileWhere(options.where, params)}`;
  }
  if (options.orderBy) {
    const orderParts = Object.entries(options.orderBy).map(
      ([col, dir]) => `\`${col}\` ${dir.toUpperCase()}`,
    );
    if (orderParts.length > 0) {
      sql += ` ORDER BY ${orderParts.join(", ")}`;
    }
  }
  if (options.take !== undefined) {
    sql += ` LIMIT ${options.take}`;
  }
  if (options.skip !== undefined) {
    sql += ` OFFSET ${options.skip}`;
  }

  return sql;
}

/**
 * Compile an INSERT statement
 * @param {string} tableName - Table name
 * @param {Record<string, unknown>} data - Data to insert
 * @param {unknown[]} params - Parameter array
 * @returns {string} SQL INSERT statement
 */
export function compileInsert(
  tableName: string,
  data: Record<string, unknown>,
  params: unknown[],
): string {
  const keys = Object.keys(data);
  const cols = keys.map((k) => `\`${k}\``).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  params.push(...keys.map((k) => data[k]));
  return `INSERT INTO \`${tableName}\` (${cols}) VALUES (${placeholders})`;
}

/**
 * Compile a bulk INSERT statement for multiple rows
 * @param {string} tableName - Table name
 * @param {Record<string, unknown>[]} data - Array of data to insert
 * @param {unknown[]} params - Parameter array
 * @returns {string} SQL bulk INSERT statement
 */
export function compileBulkInsert(
  tableName: string,
  data: Record<string, unknown>[],
  params: unknown[],
): string {
  if (data.length === 0) {
    return "";
  }
  const keys = Object.keys(data[0]!);
  const cols = keys.map((k) => `\`${k}\``).join(", ");
  const valuePlaceholders = data.map(() => `(${keys.map(() => "?").join(", ")})`).join(", ");

  for (const row of data) {
    for (const key of keys) {
      params.push(row[key]);
    }
  }

  return `INSERT INTO \`${tableName}\` (${cols}) VALUES ${valuePlaceholders}`;
}

/**
 * Compile an UPDATE statement
 * @param {string} tableName - Table name
 * @param {Record<string, unknown>} data - Data to update
 * @param {WhereClause} where - Where clause
 * @param {unknown[]} params - Parameter array
 * @returns {string} SQL UPDATE statement
 */
export function compileUpdate(
  tableName: string,
  data: Record<string, unknown>,
  where: WhereClause,
  params: unknown[],
): string {
  const setParts = Object.keys(data).map((k) => {
    params.push(data[k]);
    return `\`${k}\` = ?`;
  });
  let sql = `UPDATE \`${tableName}\` SET ${setParts.join(", ")}`;
  if (Object.keys(where).length > 0) {
    sql += ` WHERE ${compileWhere(where, params)}`;
  }
  return sql;
}

/**
 * Compile a DELETE statement
 * @param {string} tableName - Table name
 * @param {WhereClause} where - Where clause
 * @param {unknown[]} params - Parameter array
 * @returns {string} SQL DELETE statement
 */
export function compileDelete(tableName: string, where: WhereClause, params: unknown[]): string {
  let sql = `DELETE FROM \`${tableName}\``;
  if (Object.keys(where).length > 0) {
    sql += ` WHERE ${compileWhere(where, params)}`;
  }
  return sql;
}
