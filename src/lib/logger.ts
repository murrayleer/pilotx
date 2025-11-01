const prefix = "[PilotX]";

type Level = "debug" | "info" | "warn" | "error";

const shouldDebug = () => {
  return process.env.NODE_ENV !== "production";
};

const log = (level: Level, ...args: unknown[]) => {
  if (level === "debug" && !shouldDebug()) return;
  // eslint-disable-next-line no-console
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](prefix, ...args);
};

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args)
};

export default logger;
