# SPEC — `@caisson/billing` Stripe envelope hardening (harvest slice-2)

**Status: LOCKED — ADR-0204, harvest slice-2 wave, 2026-07-02 operator picker.**

- **Package:** `packages/billing` (Apache-2.0, `kind: "base"`, `tier: "oss"`).
- **Type:** HARDEN IN PLACE. No new package, no membership change, no new dependency.
- **Tags:** `security`.

## Goal (WHAT + WHY)

`provider.ts`'s Stripe driver casts the raw webhook body straight to `StripeEvent` —
`JSON.parse(rawBody) as StripeEvent` — with **no runtime shape check**. Signature
verification (`verifyStripeWebhook`) already runs first, so authenticity is covered; but a
validly-signed, malformed-envelope delivery (missing `id`/`type`, wrong type, or an
unexpected top-level field) flows straight into `parseStripeEvent` on a type assertion
alone. Paddle, LemonSqueezy, and Polar already close this exact gap with a `strictObject`
envelope schema + `parseStrict` before their mappers run (services-hardening MED finding,
ADR-0175 conformance harness). Stripe is the one driver still on a bare cast — closing it
makes all four drivers uniform and keeps the (dormant, ADR-0200) Stripe path safe to
reactivate later without a re-audit.

## Scope

**In:** a `StripeEventSchema` mirroring `PaddleEventSchema`'s shape/strictness; wire it into
`verifyAndParse` via `parseStrict`; malformed-envelope tests per the `paddle.test.ts:321-344`
pattern (extra top-level field; missing/wrong-typed `id`).

**Out:** re-validating `data.object`'s per-event-type inner fields (stays a loose
`Record<string, unknown>` — `events.ts`'s `read*` helpers are already the defensive layer,
same division Paddle uses); `verifyStripeWebhook`/HMAC logic (verify-then-parse order is
already correct); reactivating the Stripe driver (ADR-0200 keeps it dormant);
LemonSqueezy/Polar (already hardened).

## Design

Add to `events.ts` — replaces the hand-written `StripeEvent` interface (no other file
imports it beyond `provider.ts`'s cast, so re-deriving as `z.infer` is safe); `events.ts`
already imports both `z` and `strictObject`:

```ts
export const StripeEventSchema = strictObject({
  id: z.string(),
  type: z.string(),
  data: strictObject({ object: z.record(z.string(), z.unknown()) }),
});
export type StripeEvent = z.infer<typeof StripeEventSchema>;
```

In `provider.ts`, `createStripeBilling.verifyAndParse`:

```ts
verifyStripeWebhook(rawBody, signatureHeader, config.webhookSecret, opts);
const event = parseStrict(StripeEventSchema, JSON.parse(rawBody));
return parseStripeEvent(event);
```

`parseStrict` (already imported in `provider.ts` from `@caisson/kernel`) throws a
redaction-safe `ValidationError` on a bad envelope, same as Paddle — the route layer's
existing non-2xx-on-throw handling covers it with no new call site. `StripeEvent`'s
name/shape at every call boundary is unchanged — only its provenance (schema-inferred).

## Tasks

1. `events.ts`: add `StripeEventSchema` (`strictObject`), replace the hand-written
   `StripeEvent` interface with `z.infer<typeof StripeEventSchema>`; export the schema.
   Verify: `bunx tsc --noEmit -p packages/billing`.
2. `provider.ts`: import `StripeEventSchema`, swap the bare cast for
   `parseStrict(StripeEventSchema, JSON.parse(rawBody))` in `verifyAndParse`. Verify:
   `bun test packages/billing/src/billing.test.ts` (existing fixtures already match the
   schema — stay green).
3. `billing.test.ts`: add the two malformed-envelope tests (extra top-level field;
   missing/wrong-typed `id`), mirroring `paddle.test.ts:321-344`. Verify:
   `bun test packages/billing/src/billing.test.ts`.
4. Export `StripeEventSchema` from `index.ts` (mirrors `PaddleEventSchema`). Verify:
   `bun test packages/billing` (full suite, incl. `provider-conformance.test.ts`).
5. Changeset naming `@caisson/billing` (`patch`). Verify:
   `bunx changeset status --since=origin/main`.

## Verify (goal-backward)

- A validly-signed Stripe webhook with an extra/unknown top-level field or a
  missing/wrong-typed `id`/`type` is rejected (`ValidationError`) before reaching
  `parseStripeEvent` — proven by the new tests, mirroring Paddle's coverage.
- All four `BillingProvider` drivers now parse through a `strictObject` envelope +
  `parseStrict` before their mapper; `provider-conformance.test.ts` stays green unmodified.
- No change to `verifyAndParse`'s call order, the `BillingProvider` port shape,
  `DomainBillingEvent`, or Stripe driver activation state (ADR-0200: still dormant).
- `bun run check` green (turbo + standards gate) for `packages/billing`.

## Effort: XS (~1 hour). Value: MEDIUM (closes a real boundary gap; low risk, dormant driver).
