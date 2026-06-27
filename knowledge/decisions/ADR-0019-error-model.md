# ADR-0019 — Typed error model + the 402 credit-gate response

Status: proposed · 2026-06-27 (foundations track; the cross-package error contract — extends
ADR-0002, which is immutable/append-only, so this is its own ADR)

Every package throws from **one typed error hierarchy** in `@caisson/kernel`, so errors propagate
across the package graph with a stable `code`, a mapped HTTP status, and a redaction-safe
envelope — never a raw `Error` or a leaked stack/SQL string.

**Hierarchy (base `CaissonError`).** `{ code: string, httpStatus: number, message: string,
details?: Record<string, unknown> }`, each subclass a stable `code`:

| Class                      | code                   | HTTP    | Use                                                                                                                      |
| -------------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ValidationError`          | `validation_error`     | 400     | Zod boundary failure (carries safe field paths)                                                                          |
| `AuthnError`               | `unauthenticated`      | 401     | missing/invalid session or Bearer                                                                                        |
| `AuthzError`               | `forbidden`            | 403     | authenticated, not permitted                                                                                             |
| `EntitlementError`         | `not_entitled`         | 403     | license/entitlement check fails (ADR-0010)                                                                               |
| `InsufficientCreditsError` | `insufficient_credits` | **402** | the credit gate (ADR-0007)                                                                                               |
| `NotFoundError`            | `not_found`            | 404     | absent resource                                                                                                          |
| `TenancyError`             | `not_found`            | **404** | RLS/tenant-isolation denial — **fail-closed as 404**, never 403 (a 403 would leak that the row exists in another tenant) |
| `ConflictError`            | `conflict`             | 409     | unique violation — Postgres **23505 maps here**                                                                          |
| `RateLimitError`           | `rate_limited`         | 429     | per-account rate cap (ADR-0008)                                                                                          |
| `InternalError`            | `internal_error`       | 500     | the only class an unknown throw becomes                                                                                  |

**Envelope.** `toErrorResponse(err)` → `{ error: { code, message, details? } }`. A non-`CaissonError`
throw is coerced to `InternalError` with a generic message (the original is logged server-side,
**never** serialized to the client). `details` is allowlisted per class — no SQL, no stack, no
secret ever reaches `details`.

**The 402 shape (the credit gate, load-bearing for ADR-0007 + the AI Production Kit).**
`InsufficientCreditsError` →
`{ error: { code: "insufficient_credits", message, details: { required: <int>, balance: <int> } }}`
with HTTP **402**. `required`/`balance` are integer credits (ADR-0002). Every spend path that hits
an empty/short wallet returns exactly this; clients branch on `code === "insufficient_credits"`.

Rejected: per-package ad-hoc error shapes (un-composable across the graph; clients can't branch
reliably). Returning 403 for tenancy denials (leaks cross-tenant existence — must be 404). Putting
raw error/SQL text in the client envelope (info leak — the security floor).

Binding: packages throw `CaissonError` subclasses only; the HTTP edge renders `toErrorResponse`;
tenancy denials are 404; the credit gate is the exact 402 shape above; unknown throws → 500 generic.
