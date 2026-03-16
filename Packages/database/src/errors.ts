/**
 * Base error for all database-related errors
 */
export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Error thrown when schema definition is invalid
 */
export class SchemaError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

/**
 * Error thrown when a database driver encounters an error
 */
export class DriverError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "DriverError";
  }
}

/**
 * Error thrown when a query is invalid
 */
export class QueryError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "QueryError";
  }
}

/**
 * Error thrown when schema synchronization fails
 */
export class SyncError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

/**
 * Error thrown when migration execution fails
 */
export class MigrationError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/**
 * Error thrown when cache operation fails
 */
export class CacheError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "CacheError";
  }
}
