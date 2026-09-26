// The ai-meter store schema (ADR-0060/0014/0070). Four FORCE-RLS, tenant-isolated tables that back
// the metered-inference gateway's estimate→reserve→reconcile + caps + circuit breaker:
//
//   - `usage_event` — APPEND-ONLY actuals: one row per metered call recording tokens (incl. cached),
//     the integer `cost_micro_usd` the provider price book normalized to, and the integer `credits`
//     charged. The app role gets SELECT + INSERT only — UPDATE and DELETE are REVOKED, so a recorded
//     call can never be rewritten (ADR-0006). A `(account_id, call_id)` UNIQUE makes the reconcile
//     leg idempotent: a same-call retry settles exactly one usage row.
//   - `tenant_spend_window` — the per-tenant running spend COUNTER, one row per
//     (scope, unit, window_key). It mutates ONLY via an atomic `UPDATE … RETURNING` (the reserve
//     path), never a read-modify-write, so concurrent reserves can't lose an increment (ADR-0060).
//   - `spend_policy` — the per-tenant cap declaration: a (scope, unit)-keyed soft/hard limit over a
//     window granularity. Soft warns; hard trips the breaker.
//   - `spend_breaker` — the stored circuit-breaker STATE per (scope). `reserve()` reads it before
//     every reservation; an `open` breaker returns 402 without ever calling the provider (ADR-0060).
//
// All four are FORCE-RLS via `buildTenantPolicySql` (@caisson-sh/tenancy-rls): a query that forgets its
// tenant filter — or its `withTenant` scope entirely — sees nothing (ADR-0005, fail-closed). In prod
// this DDL is a numbered forward-only migration (ADR-0014/0070); it is owned here and applied
// verbatim in tests.
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";

export const USAGE_EVENT_TABLE = "usage_event";
export const TENANT_SPEND_WINDOW_TABLE = "tenant_spend_window";
export const SPEND_POLICY_TABLE = "spend_policy";
export const SPEND_BREAKER_TABLE = "spend_breaker";

export const AI_METER_SCHEMA_SQL = `
CREATE TABLE ${USAGE_EVENT_TABLE} (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  -- The gateway's per-call correlation id (ADR-0059/0060). UNIQUE per tenant so the reconcile leg
  -- records actuals exactly once — a same-call retry settles a single usage row.
  call_id text NOT NULL,
  -- The prompt_registry version that produced this call (the version→usage→eval link, ADR-0061).
  -- A LOGICAL reference to prompt_version(id), deliberately NOT a DB FK: ai-meter is an independently
  -- composable primitive and must not couple "sideways" to the prompt-registry primitive (ADR-0003).
  -- The ai-kit gateway supplies a valid id; it is NULL for an ad-hoc (non-registered-prompt) call.
  prompt_version_id text,
  lane text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  -- Cache-read tokens, billed at a provider-specific rate by the price book (ADR-0060).
  cached_input_tokens integer NOT NULL DEFAULT 0,
  -- Provider cost normalized to INTEGER micro-USD, and the INTEGER credit units charged — never
  -- floats (ADR-0007). Both are non-negative.
  cost_micro_usd integer NOT NULL,
  credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_event_call_uniq UNIQUE (account_id, call_id),
  CONSTRAINT usage_event_tokens_nonneg CHECK (
    input_tokens >= 0 AND output_tokens >= 0 AND cached_input_tokens >= 0
  ),
  CONSTRAINT usage_event_cost_nonneg CHECK (cost_micro_usd >= 0 AND credits >= 0)
);

CREATE TABLE ${TENANT_SPEND_WINDOW_TABLE} (
  account_id text NOT NULL,
  -- The aggregation scope the cap applies over (e.g. 'account', or a per-lane scope). Free text so an
  -- edition can scope finer without a schema change; the meter validates it against its policy set.
  scope text NOT NULL,
  -- What is being counted: 'micro_usd' or 'credits' (matches the policy unit).
  unit text NOT NULL,
  -- The period bucket the running total belongs to (e.g. '2026-06-27' for a day window, '2026-06' for
  -- a month) — derived by the meter from the policy window, so rolling to a new period starts at 0.
  window_key text NOT NULL,
  spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_spend_window_pk PRIMARY KEY (account_id, scope, unit, window_key),
  CONSTRAINT tenant_spend_window_spent_nonneg CHECK (spent >= 0)
);

CREATE TABLE ${SPEND_POLICY_TABLE} (
  account_id text NOT NULL,
  scope text NOT NULL,
  unit text NOT NULL,
  -- The window granularity the cap resets on ('day' | 'month' | …); the meter buckets window_key by
  -- it. Named to avoid the reserved word WINDOW.
  window_granularity text NOT NULL,
  -- Soft warns (a usage signal), hard blocks (trips the breaker). Either may be NULL (a policy can set
  -- only a hard cap); when both are set the soft cap must not exceed the hard cap. Non-negative.
  soft_limit integer,
  hard_limit integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spend_policy_pk PRIMARY KEY (account_id, scope, unit),
  CONSTRAINT spend_policy_limits_nonneg CHECK (
    (soft_limit IS NULL OR soft_limit >= 0) AND (hard_limit IS NULL OR hard_limit >= 0)
  ),
  CONSTRAINT spend_policy_soft_le_hard CHECK (
    soft_limit IS NULL OR hard_limit IS NULL OR soft_limit <= hard_limit
  )
);

CREATE TABLE ${SPEND_BREAKER_TABLE} (
  account_id text NOT NULL,
  scope text NOT NULL,
  -- 'closed' = reservations flow; 'open' = a hard cap tripped, every reserve returns 402 (ADR-0060).
  state text NOT NULL DEFAULT 'closed',
  reason text,
  tripped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spend_breaker_pk PRIMARY KEY (account_id, scope),
  CONSTRAINT spend_breaker_state_valid CHECK (state IN ('closed', 'open')),
  -- A breaker is open IFF it carries a trip timestamp — the two move together (booleans, so '=' is
  -- the biconditional, same shape as credit_event's feature CHECK).
  CONSTRAINT spend_breaker_open_iff_tripped CHECK ((state = 'open') = (tripped_at IS NOT NULL))
);

${buildTenantPolicySql(USAGE_EVENT_TABLE)}
-- Append-only (ADR-0006/0060): a metered call's actuals are recorded once and never rewritten.
REVOKE UPDATE, DELETE ON ${USAGE_EVENT_TABLE} FROM app;

${buildTenantPolicySql(TENANT_SPEND_WINDOW_TABLE)}
${buildTenantPolicySql(SPEND_POLICY_TABLE)}
${buildTenantPolicySql(SPEND_BREAKER_TABLE)}
`;
