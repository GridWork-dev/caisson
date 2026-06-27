// Typed config loader (ADR-0014 seam / ADR-0002). Validate env once at boot against a Zod
// schema; a missing/invalid var fails closed with a `ConfigError` naming the offending keys
// (never their values). No secret is ever echoed.
import type { z } from "zod";
import { ConfigError } from "./errors.ts";

export type EnvSource = Record<string, string | undefined>;

/**
 * Parse `source` (default `process.env`) against `schema`. On failure throws `ConfigError` with
 * the failing key paths only — startup is the right place to fail, loudly but without leaking
 * values.
 */
export function loadConfig<T extends z.ZodTypeAny>(
  schema: T,
  source: EnvSource = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new ConfigError(`Invalid configuration: ${keys.join(", ")}`, {
      keys,
    });
  }
  return result.data;
}
