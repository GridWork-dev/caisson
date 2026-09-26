# @caisson/ai-meter

The money path for metered AI inference: estimate a call's cost before it runs, reserve that
amount up front, then true the charge to the provider's actual usage once the call completes.
Built on the integer credit ledger, so a charge is never a float and never drifts.

- **Layer:** base

## What it gives you

- **Estimate → reserve → reconcile.** `reserve()` prices a call from a versioned, per-`provider/
model` price book and debits the wallet BEFORE the provider is ever called — a short wallet or an
  open circuit breaker fails the call with no spend and no provider round-trip. `reconcile()` then
  trues the reservation to the provider's reported usage: refunds an over-reservation, charges a
  shortfall, or leaves the ledger untouched when the estimate was exact.
- **A per-tenant spend window + soft/hard caps.** Every reserve bumps an atomic running-spend
  counter for the tenant's current window (day/month/etc.); crossing a soft cap is a warning,
  crossing a hard cap trips a circuit breaker so every subsequent call fails closed until an
  operator resets it.
- **A bundled, overridable price book.** Ships default per-million-token rates for common
  provider/model pairs; an app can override the whole book or the credit denomination.
- **Idempotent by construction.** Both `reserve()` and `reconcile()` key off the caller's `callId`
  — a retried call settles exactly once instead of double-charging.
- **A pre-call dedup gate.** `checkDedupGate()` flags a prompt that's near-identical to one already
  in flight (an agent loop rewording a retry, a user re-asking the same question) before the price
  book ever prices it, so a caller can choose to skip or reuse the earlier result. Detection only —
  it never auto-skips a call or moves a credit itself.

## Entry points

- `.` — the full surface: the price book, the estimator, and the database-bound
  `reserve()`/`reconcile()` money path with its stored circuit breaker. Server-only.
- `./browser` — the pure half, safe inside a client bundle: the versioned price book and its
  integer cost normalizer, the pre-call estimator, and the spend-policy vocabulary
  (`DEFAULT_SCOPE`, `BreakerState`, `SpendCapError`). Every name on `./browser` is also on `.`.
  Nothing that moves a credit or takes a `TenantExecutor` is reachable from it.
- `./ui` — the `<UsageChart>` React component.

## Usage

```ts
import { withTenant } from "@caisson/tenancy-rls";
import { reserve, reconcile } from "@caisson/ai-meter";

await withTenant(db, accountId, async (tx) => {
  const reserved = await reserve(tx, {
    accountId,
    callId,
    provider: "openai",
    model: "gpt-4o",
    lane: "default",
    messages: [{ role: "user", content: "hello" }],
  });

  // ... call the provider, using reserved.reservedCredits to size the request ...

  await reconcile(tx, {
    accountId,
    callId,
    provider: "openai",
    model: "gpt-4o",
    lane: "default",
    reservedCredits: reserved.reservedCredits,
    usage: { inputTokens: 12, outputTokens: 40, cachedInputTokens: 0 },
    windowKey: reserved.windowKey,
  });
});
```

## Test

```sh
bun test packages/ai-meter/src
```
