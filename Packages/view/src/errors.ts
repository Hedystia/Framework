/**
 * Base error for all view-related errors
 */
export class ViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewError";
  }
}

/**
 * Error thrown when a signal operation is invalid
 */
export class SignalError extends ViewError {
  constructor(message: string) {
    super(message);
    this.name = "SignalError";
  }
}

/**
 * Error thrown when a context operation fails
 */
export class ContextError extends ViewError {
  constructor(message: string) {
    super(message);
    this.name = "ContextError";
  }
}

/**
 * Error thrown when a render operation fails
 */
export class RenderError extends ViewError {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

/**
 * Error thrown when a store operation fails
 */
export class StoreError extends ViewError {
  constructor(message: string) {
    super(message);
    this.name = "StoreError";
  }
}

/**
 * Error thrown when a resource fetch fails
 */
export class ResourceError extends ViewError {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "ResourceError";
  }
}
