# SPEC — `@caisson/kernel` branded money + rounding provenance

**Status: EXECUTED — ADR-0212, harvest slice-2 wave, 2026-07-02 operator picker, shipped PR #47.**
Built as the SERIALIZED wave-2 of the session (cross-package API thread), after wave-1 landed. Wardfile B3.

## Goal (WHAT + WHY)

Money discipline is strong on _policy_ (integer-only ADR-0007; documented rounding direction
ADR-0060/0089) but has zero compile-time _unit safety_ — every cents/credits/micro-USD quantity is
a bare `number` (zero `.brand()` usage repo-wide), so a cents value can pass silently where credits
are expected. Every rounding site (`centsToCredits`, ai-meter's `ceilDiv`) also discards the
pre-rounding value + direction once it returns, so the ledger records only the final integer — a
grant is unauditable after the fact. This closes both gaps: nominal money types catch a unit
mix-up at compile time; a `{raw, mode, result}` record threads into the ledger write.

## Scope

**In:** `Cents`/`Credits`/`MicroUsd`/`MicroUsdPerCredit` nominal types + constructors in kernel;
threading through `credit-conversion.ts`, `@caisson/pricebook` (plans/purchases/actions),
`@caisson/ai-meter` cost legs; a `RoundedMoney<TRaw,TResult>` record at both rounding sites
(`centsToCredits` DOWN, ai-meter `ceilDiv` UP), persisted on the shared `credit_event` ledger
(`@caisson/credits`) for an ai-meter-sourced grant/debit.

**Out:** rounding `apply-billing-event.ts`'s grants — ADR-0089 §5 keeps those EXACT table integers
(`plan.creditsPerCycle`/`purchase.credits`), so those rows correctly persist NULL provenance.
Migrating `credits`/`ai-meter` onto the `@caisson/migrate` per-package `migrations/` convention —
both still use one inline DDL string; out of scope, the new columns land in that string as-is.

## Design

- **Brand mechanism: TS-native nominal types, not `z.brand<>()`.** `type Cents = number & {
readonly [brandTag]: "Cents" }` (ditto `Credits`/`MicroUsd`/`MicroUsdPerCredit`), new
  `packages/kernel/src/money.ts`. Zod's `.brand<>()` only brands values flowing through `.parse()`;
  most money here is pure arithmetic (`ceilDiv`, `legMicroUsd`) with no schema at each step, so Zod
  would force a parse per computation for no gain. TS brands cost nothing at runtime, widen to
  `number` for free (no unwrap into `BigInt(...)`/a SQL param), and need explicit construction only
  where a raw number first becomes money. Constructors `asCents`/`asCredits`/`asMicroUsd`
  (non-negative int) and `asMicroUsdPerCredit` (positive int) throw `ValidationError`, mirroring
  `credit-conversion.ts`'s existing guard; `unwrapMoney(v)` is an identity no-op — a grep-able
  DB-boundary marker, not a type requirement.
- **`RoundedMoney<TRaw, TResult> = { raw: TRaw; mode: "up" | "down"; result: TResult }`.**
  `centsToCreditsProvenance(cents, conversion?)` → `{raw: cents, mode: "down", result: credits}`
  (`centsToCredits` keeps its plain-`Credits` return). `computeCost()` (ai-meter) gains
  `roundingCredits: RoundedMoney<MicroUsd, Credits>` (`raw: costMicroUsd, mode: "up"`) alongside
  its existing fields.
- **Ledger:** `credit_event` (owned in `packages/credits/src/schema.ts`'s DDL string, same
  mechanism `usage_event` uses) gains nullable `rounding_raw integer` + `rounding_mode text`, a
  biconditional CHECK (mirrors the file's `credit_event_feature_iff` idiom) + a mode-enum CHECK —
  two typed columns, not JSON, matching ADR-0007's integer/queryable style. `GrantInput`/
  `DebitInput.amount` become `Credits`; both gain optional `rounding?: RoundedMoney<number,
Credits>`, written by `insertEvent` (NULL/NULL when absent). Arithmetic on branded numbers (e.g.
  `settledCredits - reservedCredits`) yields plain `number` — re-wrap via `asCredits(...)` at the
  point a new money value is minted.

## Tasks

1. `packages/kernel/src/money.ts` (new): brands + constructors + `RoundedMoney`; export from
   `index.ts`; `money.test.ts`. Then `credit-conversion.ts`: brand `microUsdPerCredit`/
   `centsToCredits`; add `centsToCreditsProvenance`. Verify: `bun test packages/kernel/src`
2. `packages/credits/src/schema.ts`+`credits.ts`: 2 columns + CHECKs; branded `amount`; `rounding`
   threaded into `insertEvent`; extend `credits.integration.test.ts`. Verify: `bun test
packages/credits/src`
3. `packages/pricebook/src/{conversion,plans,purchases,actions}.ts`: brand `creditsPerCycle`/
   `credits`/`codegenRunCredits`; re-export `centsToCreditsProvenance`. Verify: `bun test
packages/pricebook/src`
4. `packages/ai-meter/src/pricebook.ts`: brand `CostBreakdown`; add `roundingCredits`. Verify:
   `bun test packages/ai-meter/src/pricebook.test.ts`
5. `packages/ai-meter/src/meter.ts`: thread `est.roundingCredits`/`actual.roundingCredits` into
   `reserve()`/`reconcile()`'s `debit`/`grant` calls. Verify: `bun test packages/ai-meter/src`
6. `services/license/src/apply-billing-event.ts`: no behavior change — confirms branded
   `plan.creditsPerCycle`/`purchase.credits` flow into `grant()` with no cast, no rounding record.
   Verify: `bun test services/license/src/apply-billing-event.integration.test.ts`
7. Full sweep: `bun run check` green; changeset naming `kernel`, `credits`, `pricebook`, `ai-meter`.

## Verify (goal-backward)

- Every money quantity crossing a package boundary is a branded type; `grep -rn "\.brand("
packages/` still zero hits (TS-native choice held).
- `centsToCreditsProvenance` / `computeCost().roundingCredits` each produce `{raw, mode, result}`
  with the documented direction.
- A `credit_event` row from ai-meter's reserve/reconcile carries non-null `rounding_raw`/
  `rounding_mode`; a row from `apply-billing-event.ts` carries NULL/NULL.
- ADR-0007 intact (existing goldens byte-identical — branding is compile-time-only); ADR-0003
  down-only preserved (kernel/credits stay Apache-2.0, no new commercial deps).
- `bun run check` green across kernel, credits, pricebook, ai-meter, services/license.

## Effort: L (serialized cross-package thread, ~2–3 days). Value: MEDIUM-HIGH.
