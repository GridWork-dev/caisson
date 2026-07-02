// Typed error model (ADR-0019). One hierarchy every package throws from, so errors propagate
// across the package graph with a stable `code`, a mapped HTTP status, and a redaction-safe
// envelope — never a raw Error or a leaked stack/SQL string.

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Base of the hierarchy. `details` is allowlisted per subclass — never SQL/stack/secret. */
export abstract class CaissonError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) this.details = details;
  }
}

export class ValidationError extends CaissonError {
  readonly code = "validation_error";
  readonly httpStatus = 400;
}

export class AuthnError extends CaissonError {
  readonly code = "unauthenticated";
  readonly httpStatus = 401;
  constructor(message = "Unauthenticated", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class AuthzError extends CaissonError {
  readonly code = "forbidden";
  readonly httpStatus = 403;
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class EntitlementError extends CaissonError {
  readonly code = "not_entitled";
  readonly httpStatus = 403;
  constructor(message = "Not entitled", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** The credit gate (ADR-0007). HTTP 402 with integer `required`/`balance` (ADR-0002). */
export class InsufficientCreditsError extends CaissonError {
  readonly code = "insufficient_credits";
  readonly httpStatus = 402;
  constructor(
    required: number,
    balance: number,
    message = "Insufficient credits",
  ) {
    super(message, { required, balance });
  }
}

export class NotFoundError extends CaissonError {
  readonly code = "not_found";
  readonly httpStatus = 404;
  constructor(message = "Not found", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * RLS / tenant-isolation denial. Fail-closed as **404, never 403** — a 403 would leak that the
 * row exists in another tenant (ADR-0019/0005).
 */
export class TenancyError extends CaissonError {
  readonly code = "not_found";
  readonly httpStatus = 404;
  constructor(message = "Not found", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** Unique-constraint conflict — Postgres 23505 maps here (ADR-0024). */
export class ConflictError extends CaissonError {
  readonly code = "conflict";
  readonly httpStatus = 409;
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * A guardrail block (ADR-0063, amending the ADR-0019 hierarchy; `"secret"` added by ADR-0209). HTTP
 * 422 — the request reached a valid endpoint and parsed, but a moderation / PII / injection / secret
 * / custom guard tripped at the gateway's input or output leg (P3 AI Production Kit). **Metadata
 * only**: `details` carries the `stage` + `category` the dashboard charts by, NEVER the flagged
 * content, matched text, or secret span — echoing them would defeat the redaction the guard exists
 * to enforce (mirrors `guardrailBlockSchema`).
 */
export class GuardrailError extends CaissonError {
  readonly code = "guardrail_blocked";
  readonly httpStatus = 422;
  constructor(
    stage: "input" | "output",
    category: "moderation" | "pii" | "injection" | "secret" | "custom",
    message = "Request blocked by a guardrail",
  ) {
    super(message, { stage, category });
  }
}

export class RateLimitError extends CaissonError {
  readonly code = "rate_limited";
  readonly httpStatus = 429;
  constructor(message = "Rate limited", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ConfigError extends CaissonError {
  readonly code = "config_error";
  readonly httpStatus = 500;
}

export class InternalError extends CaissonError {
  readonly code = "internal_error";
  readonly httpStatus = 500;
  constructor(
    message = "Internal server error",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

export function isCaissonError(err: unknown): err is CaissonError {
  return err instanceof CaissonError;
}

/** Postgres unique-violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

/**
 * Render any thrown value to a client-safe `{ status, body }`. A `CaissonError` keeps its code +
 * status + allowlisted details; anything else collapses to a generic 500 — the original is the
 * caller's to log server-side, never serialized to the client.
 */
export function toErrorResponse(err: unknown): {
  status: number;
  body: ErrorEnvelope;
} {
  if (isCaissonError(err)) {
    const error: ErrorEnvelope["error"] = {
      code: err.code,
      message: err.message,
    };
    if (err.details !== undefined) error.details = err.details;
    return { status: err.httpStatus, body: { error } };
  }
  return {
    status: 500,
    body: {
      error: { code: "internal_error", message: "Internal server error" },
    },
  };
}
