// The wiring shell (T18, the P3 exit artifact). Three scenarios drive the @caisson/ai-kit `infer()`
// gateway end-to-end against the embedded PGlite store + the local mock model — proving the SPEC
// exit gate in a runnable app, with zero network and zero provider secret:
//
//   metered   — coach-configure a lane → resolve a prompt by name@version → render → reserve BEFORE
//               the call → reconcile to ACTUAL; the wallet settles to the real charge.
//   cap       — a hard per-tenant spend cap trips the circuit breaker; the NEXT call 402s
//               (SpendCapError) before the provider is ever reached.
//   guardrail — a flagged input fails closed: GuardrailError 422, the model is never called, no
//               spend, and a metadata-only `guardrail.blocked` event reaches the EventSink.
//
// Each run is fully isolated (a fresh embedded store) so the demo is deterministic + idempotent.
import { randomUUID } from "node:crypto";
import { balance, grant } from "@caisson/credits";
import {
  GuardrailError,
  InMemoryEventSink,
  InsufficientCreditsError,
  asCredits,
  asMicroUsdPerCredit,
} from "@caisson/kernel";
import { SPEND_POLICY_TABLE, SpendCapError } from "@caisson/ai-meter";
import type { MeterConfig } from "@caisson/ai-meter";
import { localModerator } from "@caisson/guardrails";
import type { GuardPolicy } from "@caisson/guardrails";
import { infer } from "@caisson/ai-kit";
import type { InferOptions } from "@caisson/ai-kit";
import type { AiSettings } from "@caisson/ai-config";
import { registerPrompt } from "@caisson/prompt-registry";
import { withTenant } from "@caisson/tenancy-rls";
import type { Transactor } from "@caisson/tenancy-rls";
import { coachConfigureLane } from "./coach.ts";
import { mockModel } from "./model.ts";
import type { LocalModel } from "./model.ts";
import { createEmbeddedStore } from "./store.ts";

export const SCENARIOS = ["metered", "cap", "guardrail"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function isScenario(value: string): value is Scenario {
  return (SCENARIOS as readonly string[]).includes(value);
}

const ACCOUNT = "acct_demo";

// A fixed price book + denomination + clock makes the integer money math deterministic: 1 input
// token = $1/MTok, output 2×, 1 credit = 100 micro-USD; the mock's 10 in / 20 out →
// (10·1 + 20·2) = 50 micro → ceil(50/100) = 1 credit ACTUAL.
const METER: MeterConfig = {
  priceBook: {
    "openai/model": {
      inputPerMTok: 1_000_000,
      cachedInputPerMTok: 500_000,
      outputPerMTok: 2_000_000,
    },
  },
  conversion: { microUsdPerCredit: asMicroUsdPerCredit(100) },
  now: new Date("2026-06-27T12:00:00Z"),
};

const cleanPolicy = (over: Partial<GuardPolicy> = {}): GuardPolicy => ({
  policyName: "default",
  moderator: localModerator([]),
  ...over,
});

function baseOpts(
  tx: Transactor,
  settings: AiSettings,
  model: LocalModel,
  policy: GuardPolicy,
  sink: InMemoryEventSink,
  over: Partial<InferOptions> = {},
): InferOptions {
  return {
    tx,
    accountId: ACCOUNT,
    settings,
    resolveModel: () => model,
    guard: { policy, runtime: { tenantId: ACCOUNT, sink } },
    meter: METER,
    maxOutputTokens: 50,
    ...over,
  };
}

function seed(tx: Transactor, amount: number): Promise<unknown> {
  return withTenant(tx, ACCOUNT, (t) =>
    grant(t, {
      accountId: ACCOUNT,
      amount: asCredits(amount),
      eventType: "purchase",
      sourceEventId: `seed:${randomUUID()}`,
    }),
  );
}

/** Result of the coach-configure step, surfaced on every scenario. */
export interface CoachSummary {
  readonly lane: string;
  readonly provider: string;
  readonly model: string;
  readonly requiredEnvVars: readonly string[];
  readonly valid: boolean;
}

export interface MeteredResult {
  readonly scenario: "metered";
  readonly coach: CoachSummary;
  readonly promptRef: string;
  readonly promptVersionId: string | null;
  readonly text: string;
  readonly callId: string;
  readonly reservedCredits: number;
  readonly actualCredits: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cachedInputTokens: number;
  };
  readonly providerCalls: number;
}

export interface CapResult {
  readonly scenario: "cap";
  readonly coach: CoachSummary;
  readonly hardLimit: number;
  readonly firstCallBreakerTripped: boolean;
  readonly blockedStatus: number;
  readonly blockedError: string;
  readonly providerCallsOnBlocked: number;
}

export interface GuardrailResult {
  readonly scenario: "guardrail";
  readonly coach: CoachSummary;
  readonly blockedTerm: string;
  readonly status: number;
  readonly error: string;
  readonly providerCalls: number;
  readonly balanceUnchanged: boolean;
  readonly eventName: string | undefined;
}

export type ScenarioResult = MeteredResult | CapResult | GuardrailResult;

async function coachSummary(): Promise<{
  settings: AiSettings;
  summary: CoachSummary;
}> {
  const configured = await coachConfigureLane();
  const lane = configured.settings.lanes[configured.settings.defaultLane];
  if (lane === undefined) {
    throw new Error("coach produced no default lane");
  }
  return {
    settings: configured.settings,
    summary: {
      lane: configured.settings.defaultLane,
      provider: lane.provider,
      model: lane.model,
      requiredEnvVars: configured.requiredEnvVars,
      valid: configured.valid,
    },
  };
}

async function runMetered(): Promise<MeteredResult> {
  const pg = await createEmbeddedStore();
  try {
    const { settings, summary } = await coachSummary();
    await seed(pg, 1000);
    const balanceBefore = await withTenant(pg, ACCOUNT, (t) =>
      balance(t, ACCOUNT),
    );
    const version = await withTenant(pg, ACCOUNT, (t) =>
      registerPrompt(t, {
        accountId: ACCOUNT,
        name: "greet",
        messages: [{ role: "user", content: "Hi {{name}}!" }],
        varSpec: { name: "string" },
      }),
    );
    const model = mockModel("Hi world!");
    const res = await infer(
      summary.lane,
      { promptRef: `greet@${version.version}`, vars: { name: "world" } },
      baseOpts(pg, settings, model, cleanPolicy(), new InMemoryEventSink()),
    );
    const balanceAfter = await withTenant(pg, ACCOUNT, (t) =>
      balance(t, ACCOUNT),
    );
    return {
      scenario: "metered",
      coach: summary,
      promptRef: `greet@${version.version}`,
      promptVersionId: res.promptVersionId,
      text: res.text,
      callId: res.callId,
      reservedCredits: res.reserved.reservedCredits,
      actualCredits: res.reconciled.actualCredits,
      balanceBefore,
      balanceAfter,
      usage: res.usage,
      providerCalls: model.doGenerateCalls.length,
    };
  } finally {
    await pg.close();
  }
}

async function runCap(): Promise<CapResult> {
  const pg = await createEmbeddedStore();
  try {
    const { settings, summary } = await coachSummary();
    await seed(pg, 1000);
    const hardLimit = 1;
    await withTenant(pg, ACCOUNT, (t) =>
      t.query(
        `INSERT INTO ${SPEND_POLICY_TABLE}
           (account_id, scope, unit, window_granularity, soft_limit, hard_limit)
         VALUES ($1, 'account', 'credits', 'day', NULL, $2)`,
        [ACCOUNT, hardLimit],
      ),
    );
    const sink = new InMemoryEventSink();

    // First call reserves > 1 credit → crosses the hard cap → trips the breaker.
    const first = await infer(
      summary.lane,
      { messages: [{ role: "user", content: "the first call here" }] },
      baseOpts(pg, settings, mockModel("one"), cleanPolicy(), sink),
    );

    // Next call: the breaker is open → 402 before any spend or provider call.
    const blockedModel = mockModel("should not run");
    const err = await infer(
      summary.lane,
      { messages: [{ role: "user", content: "the second call here" }] },
      baseOpts(pg, settings, blockedModel, cleanPolicy(), sink),
    ).catch((e: unknown) => e);

    if (!(err instanceof SpendCapError)) {
      throw new Error(
        `expected SpendCapError, got ${err instanceof Error ? err.constructor.name : String(err)}`,
      );
    }
    return {
      scenario: "cap",
      coach: summary,
      hardLimit,
      firstCallBreakerTripped: first.reserved.breakerTripped,
      blockedStatus: err.httpStatus,
      blockedError: err.constructor.name,
      providerCallsOnBlocked: blockedModel.doGenerateCalls.length,
    };
  } finally {
    await pg.close();
  }
}

async function runGuardrail(): Promise<GuardrailResult> {
  const pg = await createEmbeddedStore();
  try {
    const { settings, summary } = await coachSummary();
    await seed(pg, 1000);
    const sink = new InMemoryEventSink();
    const blockedTerm = "forbidden";
    const model = mockModel("should not run");
    const policy = cleanPolicy({ moderator: localModerator([blockedTerm]) });

    const err = await infer(
      summary.lane,
      { messages: [{ role: "user", content: "this is forbidden content" }] },
      baseOpts(pg, settings, model, policy, sink),
    ).catch((e: unknown) => e);

    if (!(err instanceof GuardrailError)) {
      throw new Error(
        `expected GuardrailError, got ${err instanceof Error ? err.constructor.name : String(err)}`,
      );
    }
    const balanceAfter = await withTenant(pg, ACCOUNT, (t) =>
      balance(t, ACCOUNT),
    );
    return {
      scenario: "guardrail",
      coach: summary,
      blockedTerm,
      status: err.httpStatus,
      error: err.constructor.name,
      providerCalls: model.doGenerateCalls.length,
      balanceUnchanged: balanceAfter === 1000,
      eventName: sink.events[0]?.name,
    };
  } finally {
    await pg.close();
  }
}

/** Drive one scenario end-to-end through the gateway. Used by the route handler + the smoke test. */
export function runScenario(scenario: Scenario): Promise<ScenarioResult> {
  switch (scenario) {
    case "metered":
      return runMetered();
    case "cap":
      return runCap();
    case "guardrail":
      return runGuardrail();
  }
}

/** The fail-closed 402 on an empty wallet — the gateway's reserve-before-spend guarantee. */
export async function runEmptyWallet(): Promise<{
  status: number;
  error: string;
  providerCalls: number;
}> {
  const pg = await createEmbeddedStore();
  try {
    const { settings, summary } = await coachSummary();
    const model = mockModel("should not run");
    const err = await infer(
      summary.lane,
      { messages: [{ role: "user", content: "an expensive request here" }] },
      baseOpts(pg, settings, model, cleanPolicy(), new InMemoryEventSink()),
    ).catch((e: unknown) => e);
    if (!(err instanceof InsufficientCreditsError)) {
      throw new Error(
        `expected InsufficientCreditsError, got ${err instanceof Error ? err.constructor.name : String(err)}`,
      );
    }
    return {
      status: err.httpStatus,
      error: err.constructor.name,
      providerCalls: model.doGenerateCalls.length,
    };
  } finally {
    await pg.close();
  }
}
