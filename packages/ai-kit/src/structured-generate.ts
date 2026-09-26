// structuredGenerate<T>() — the structured-output-or-throw wrapper around infer(): the canonical
// default path for any caller that wants a typed value back instead of raw model text. `infer()`
// itself returns whatever the model said, including an empty string on a refusal — a caller that
// forgets to check for that gets a silent no-op, not an error. This wraps that gap: parse `text` as
// JSON, validate it against the caller's Zod schema, and THROW a typed `StructuredGenerateError`
// (never return null/undefined/empty) on a refusal, invalid JSON, or a schema mismatch.
import type { z } from "zod";
import { CaissonError } from "@caisson-sh/kernel";
import { infer } from "./gateway.ts";
import type { InferInput, InferOptions, InferResult } from "./gateway.ts";

/** Why structuredGenerate() couldn't produce a value. */
export type StructuredGenerateReason =
  | "refusal"
  | "invalid_json"
  | "schema_mismatch";

/** Thrown instead of returning a null/empty result — a refusal or a malformed completion is a
 *  caller-visible failure, not a silent no-op. `details.callId` ties it back to the meter event. */
export class StructuredGenerateError extends CaissonError {
  readonly code = "structured_generate_failed";
  readonly httpStatus = 422;
  readonly reason: StructuredGenerateReason;

  constructor(
    reason: StructuredGenerateReason,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
    this.reason = reason;
  }
}

export interface StructuredGenerateResult<T> {
  readonly value: T;
  /** The underlying metered infer() result (usage, callId, reserved/reconciled) for callers that
   *  need it — structuredGenerate charges the same as a plain infer() call. */
  readonly raw: InferResult;
}

/**
 * Run one metered infer() call and parse its text output against `schema`. Throws
 * `StructuredGenerateError` — never returns an empty/partial value — on an empty completion (a
 * refusal), text that isn't valid JSON, or JSON that fails `schema`.
 */
export async function structuredGenerate<T>(
  schema: z.ZodType<T>,
  lane: string,
  input: InferInput,
  opts: InferOptions,
): Promise<StructuredGenerateResult<T>> {
  const raw = await infer(lane, input, opts);

  if (raw.text.trim().length === 0) {
    throw new StructuredGenerateError("refusal", "Model returned no content", {
      callId: raw.callId,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.text);
  } catch {
    throw new StructuredGenerateError(
      "invalid_json",
      "Model output was not valid JSON",
      { callId: raw.callId },
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StructuredGenerateError(
      "schema_mismatch",
      "Model output failed schema validation",
      {
        callId: raw.callId,
        issues: result.error.issues.map((i) => i.message),
      },
    );
  }

  return { value: result.data, raw };
}
