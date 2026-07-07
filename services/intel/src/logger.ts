// Structured stderr logging — the repo's no-console-log rule. One JSON line per event on
// stderr (stdout stays clean for any future piped output). Never pass a secret as a field;
// callers log ids, counts, and status, not tokens or DSNs.

export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

function emit(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    svc: "service-intel",
    level,
    msg,
    ...(fields ?? {}),
    t: new Date().toISOString(),
  });
  process.stderr.write(`${line}\n`);
}

export const logger: Logger = {
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
};
