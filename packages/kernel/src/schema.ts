// Zod boundary helpers (ADR-0002). `.strict()` at every boundary; failures surface as a
// `ValidationError` carrying safe field paths only — never the rejected values.
import { z } from "zod";
import { ValidationError } from "./errors.ts";

/** `z.object(shape).strict()` — rejects unknown keys at the boundary. */
export function strictObject<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T> {
  return z.object(shape).strict();
}

/** Parse `input` against `schema`, throwing a redaction-safe `ValidationError` on failure. */
export function parseStrict<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return result.data;
}
