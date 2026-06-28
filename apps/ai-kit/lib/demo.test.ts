// Wiring smoke test for the P3 reference app (T18). Drives every scenario through the real
// @caisson/ai-kit gateway against the embedded PGlite store + the local mock model — no network,
// no provider secret. This proves the app WIRES the composition correctly; the per-leg behaviour
// is exhaustively covered by the gateway's own unit + integration suites.
import { describe, expect, test } from "bun:test";
import { coachConfigureLane } from "./coach.ts";
import { runEmptyWallet, runScenario, SCENARIOS, isScenario } from "./demo.ts";

describe("coach-configure a lane (ADR-0076)", () => {
  test("proposes + validates a lane and emits NAMES only, never a secret value", async () => {
    const configured = await coachConfigureLane();
    expect(configured.settings.defaultLane).toBe("default");
    expect(configured.settings.lanes.default?.provider).toBe("openai");
    expect(configured.requiredEnvVars).toEqual(["OPENAI_API_KEY"]);
    expect(configured.valid).toBe(true);
    expect(configured.missingEnvVars).toEqual([]);
    // The approval-gated write surface emits a forge.config + a .env.example — NAMES only.
    const env = configured.files.find((f) => f.path === ".env.example");
    expect(env?.contents).toContain("OPENAI_API_KEY=");
    // Never a value: the placeholder line ends at `=`, with nothing after it.
    expect(env?.contents).not.toMatch(/OPENAI_API_KEY=.+/);
  });

  test("a missing provider key is reported fail-closed (NAME present, value absent)", async () => {
    const configured = await coachConfigureLane("openai", "model", {});
    expect(configured.valid).toBe(false);
    expect(configured.missingEnvVars).toEqual(["OPENAI_API_KEY"]);
  });
});

describe("isScenario guard", () => {
  test("accepts the known scenarios and rejects others", () => {
    for (const s of SCENARIOS) expect(isScenario(s)).toBe(true);
    expect(isScenario("bogus")).toBe(false);
  });
});

describe("metered infer() — resolve(name@version) → reserve → call → reconcile", () => {
  test("the metered call resolves a prompt, calls the model once, and trues to actual", async () => {
    const res = await runScenario("metered");
    if (res.scenario !== "metered") throw new Error("wrong scenario");
    expect(res.text).toBe("Hi world!");
    expect(res.promptRef).toBe("greet@1");
    expect(res.promptVersionId).not.toBeNull();
    expect(res.providerCalls).toBe(1);
    expect(res.reservedCredits).toBeGreaterThan(0);
    expect(res.actualCredits).toBe(1); // 10 in + 20 out → 50 micro → 1 credit
    expect(res.balanceBefore).toBe(1000);
    expect(res.balanceAfter).toBe(999); // settled to ACTUAL, not the reservation
    expect(res.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cachedInputTokens: 0,
    });
  });
});

describe("hard cap → circuit breaker → 402", () => {
  test("crossing the hard cap trips the breaker; the next call 402s without a provider call", async () => {
    const res = await runScenario("cap");
    if (res.scenario !== "cap") throw new Error("wrong scenario");
    expect(res.firstCallBreakerTripped).toBe(true);
    expect(res.blockedStatus).toBe(402);
    expect(res.blockedError).toBe("SpendCapError");
    expect(res.providerCallsOnBlocked).toBe(0);
  });
});

describe("guardrail input block → 422 fail-closed", () => {
  test("a flagged input throws GuardrailError 422, never calls the model, spends nothing, emits an event", async () => {
    const res = await runScenario("guardrail");
    if (res.scenario !== "guardrail") throw new Error("wrong scenario");
    expect(res.status).toBe(422);
    expect(res.error).toBe("GuardrailError");
    expect(res.providerCalls).toBe(0);
    expect(res.balanceUnchanged).toBe(true);
    expect(res.eventName).toBe("guardrail.blocked");
  });
});

describe("fail-closed credit gate — reserve BEFORE the provider call", () => {
  test("an empty wallet 402s and never reaches the model", async () => {
    const res = await runEmptyWallet();
    expect(res.status).toBe(402);
    expect(res.error).toBe("InsufficientCreditsError");
    expect(res.providerCalls).toBe(0);
  });
});
