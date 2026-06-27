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
export abstract class StackError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) this.details = details;
  }
}

export class ValidationError extends StackError {
  readonly code = "validation_error";
  readonly httpStatus = 400;
}

export class AuthnError extends StackError {
  readonly code = "unauthenticated";
  readonly httpStatus = 401;
  constructor(message = "Unauthenticated", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class AuthzError extends StackError {
  readonly code = "forbidden";
  readonly httpStatus = 403;
  constructor(message = "Forbidden", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class EntitlementError extends StackError {
  readonly code = "not_entitled";
  readonly httpStatus = 403;
  constructor(message = "Not entitled", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** The credit gate (ADR-0007). HTTP 402 with integer `required`/`balance` (ADR-0002). */
export class InsufficientCreditsError extends StackError {
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

export class NotFoundError extends StackError {
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
export class TenancyError extends StackError {
  readonly code = "not_found";
  readonly httpStatus = 404;
  constructor(message = "Not found", details?: Record<string, unknown>) {
    super(message, details);
  }
}

/** Unique-constraint conflict — Postgres 23505 maps here (ADR-0024). */
export class ConflictError extends StackError {
  readonly code = "conflict";
  readonly httpStatus = 409;
  constructor(message = "Conflict", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class RateLimitError extends StackError {
  readonly code = "rate_limited";
  readonly httpStatus = 429;
  constructor(message = "Rate limited", details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ConfigError extends StackError {
  readonly code = "config_error";
  readonly httpStatus = 500;
}

export class InternalError extends StackError {
  readonly code = "internal_error";
  readonly httpStatus = 500;
  constructor(
    message = "Internal server error",
    details?: Record<string, unknown>,
  ) {
    super(message, details);
  }
}

export function isStackError(err: unknown): err is StackError {
  return err instanceof StackError;
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
 * Render any thrown value to a client-safe `{ status, body }`. A `StackError` keeps its code +
 * status + allowlisted details; anything else collapses to a generic 500 — the original is the
 * caller's to log server-side, never serialized to the client.
 */
export function toErrorResponse(err: unknown): {
  status: number;
  body: ErrorEnvelope;
} {
  if (isStackError(err)) {
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
