export type DebugLevel = "none" | "debug" | "warn" | "log" | "error";

const levels: Record<Exclude<DebugLevel, "none">, number> = {
  debug: 0,
  log: 1,
  warn: 2,
  error: 3,
};

export function createLogger(debugLevel: DebugLevel) {
  return (level: Exclude<DebugLevel, "none">, message: string, data?: any) => {
    if (debugLevel === "none") {
      return;
    }

    if (levels[level] < levels[debugLevel]) {
      return;
    }

    const method = level === "debug" ? "log" : level;
    const prefix = `[${level.toUpperCase()}]`;

    if (data !== undefined) {
      console[method](prefix, message, data);
    } else {
      console[method](prefix, message);
    }
  };
}
