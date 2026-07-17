// $ai_generation capture (ai-capture.ts) — the PostHog envelope, the privacy invariant (no prompt or
// completion text ever leaves), config gating, and fail-soft. CAISSON-120 / audit M4.
import { expect, test } from "bun:test";
import {
  type AiGeneration,
  captureAiGeneration,
  loadAiCaptureConfig,
} from "./ai-capture.ts";
import type { fetchWithTimeout } from "@caisson/kernel";

const CONFIG = { key: "phc_test", host: "https://ph.test" };

function successGen(over: Partial<AiGeneration> = {}): AiGeneration {
  return {
    model: "google/gemini-3.5-flash",
    inputTokens: 812,
    outputTokens: 96,
    totalCostUsd: 0.0021,
    latencySeconds: 1.4,
    isError: false,
    httpStatus: 200,
    ...over,
  };
}

// A fetch double capturing the single request; returns 200 unless told otherwise.
function capturingFetch(status = 200): {
  impl: typeof fetchWithTimeout;
  seen: { url: string; body: Record<string, unknown> }[];
} {
  const seen: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (input, init) => {
    seen.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(null, { status });
  }) as typeof fetchWithTimeout;
  return { impl, seen };
}

test("loadAiCaptureConfig is null unless POSTHOG_CAPTURE_KEY is set (capture disabled by default)", () => {
  expect(loadAiCaptureConfig({})).toBeNull();
  expect(loadAiCaptureConfig({ POSTHOG_CAPTURE_KEY: "   " })).toBeNull();
  expect(loadAiCaptureConfig({ POSTHOG_CAPTURE_KEY: "phc_x" })).toEqual({
    key: "phc_x",
    host: "https://us.i.posthog.com",
  });
  expect(
    loadAiCaptureConfig({
      POSTHOG_CAPTURE_KEY: "phc_x",
      POSTHOG_CAPTURE_HOST: "https://eu.posthog.com/",
    }),
  ).toEqual({ key: "phc_x", host: "https://eu.posthog.com" });
});

test("posts a $ai_generation envelope with the observability props and a server distinct_id", async () => {
  const { impl, seen } = capturingFetch();
  await captureAiGeneration(CONFIG, successGen(), impl);

  expect(seen).toHaveLength(1);
  expect(seen[0]?.url).toBe("https://ph.test/capture/");
  const body = seen[0]?.body ?? {};
  expect(body.api_key).toBe("phc_test");
  expect(body.event).toBe("$ai_generation");
  expect(body.distinct_id).toBe("server");
  const props = body.properties as Record<string, unknown>;
  expect(props.$ai_model).toBe("google/gemini-3.5-flash");
  expect(props.$ai_provider).toBe("openrouter");
  expect(props.$ai_input_tokens).toBe(812);
  expect(props.$ai_output_tokens).toBe(96);
  expect(props.$ai_total_cost_usd).toBe(0.0021);
  expect(props.$ai_latency).toBe(1.4);
  expect(props.$ai_http_status).toBe(200);
  expect(props.$ai_is_error).toBe(false);
  // trace id is fresh + doubled as the parent id (single-span generation).
  expect(typeof props.$ai_trace_id).toBe("string");
  expect(props.$ai_parent_id).toBe(props.$ai_trace_id);
});

test("PRIVACY: never emits prompt or completion text keys", async () => {
  const { impl, seen } = capturingFetch();
  await captureAiGeneration(CONFIG, successGen(), impl);
  const props = (seen[0]?.body.properties ?? {}) as Record<string, unknown>;
  expect(props).not.toHaveProperty("$ai_input");
  expect(props).not.toHaveProperty("$ai_output_choices");
  expect(props).not.toHaveProperty("$ai_input_state");
});

test("failure path carries $ai_is_error + $ai_error and omits $ai_http_status", async () => {
  const { impl, seen } = capturingFetch();
  await captureAiGeneration(
    CONFIG,
    successGen({
      isError: true,
      error: "generation_failed",
      httpStatus: undefined,
    }),
    impl,
  );
  const props = (seen[0]?.body.properties ?? {}) as Record<string, unknown>;
  expect(props.$ai_is_error).toBe(true);
  expect(props.$ai_error).toBe("generation_failed");
  expect(props).not.toHaveProperty("$ai_http_status");
});

test("fail-soft: a throwing fetch never propagates (telemetry never breaks the answer path)", async () => {
  const throwing = (async () => {
    throw new Error("network down");
  }) as typeof fetchWithTimeout;
  // Must resolve, not reject.
  await captureAiGeneration(CONFIG, successGen(), throwing);
});
