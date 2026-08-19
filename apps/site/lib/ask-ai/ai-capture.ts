// $ai_generation capture for the Ask-AI lane (CAISSON-120 / audit finding M4: zero $ai_* events in
// PostHog). apps/site's Ask-AI route calls OpenRouter DIRECTLY — it bypasses @caisson/ai-kit, a SOLD
// commercial package that must never carry a hardcoded vendor sink — so LLM-observability events
// (tokens, cost, latency) have to be emitted here, by the same house server-side manual-capture pattern
// services/license uses (posthog-capture.ts): a fetchWithTimeout POST to PostHog's `/capture/` endpoint,
// config-gated on POSTHOG_CAPTURE_KEY, fire-and-forget and never-throw.
//
// PRIVACY INVARIANT: no prompt or completion TEXT ever leaves the box — $ai_input and
// $ai_output_choices are NEVER sent (the keys are omitted entirely), only counts/cost/latency/status.
import { fetchWithTimeout } from "@caisson/kernel";

export interface AiCaptureConfig {
  /** PostHog PROJECT capture key (`phc_…`) — a write-only ingestion key, safe server-side. */
  key: string;
  /** Ingestion host, no trailing slash. */
  host: string;
}

/**
 * Resolve the capture config from env; `null` (capture DISABLED, zero behavior change) unless
 * `POSTHOG_CAPTURE_KEY` is set. Same env convention as services/license + services/support-bot's
 * server-side capture — the site had only the client-side `NEXT_PUBLIC_POSTHOG_*` names (dashboard
 * posthog-js, ADR-0118), which are build-inlined and semantically public, so a distinct server-side
 * name keeps the ingestion key off the client bundle.
 */
export function loadAiCaptureConfig(
  env: Record<string, string | undefined> = process.env,
): AiCaptureConfig | null {
  const key = env.POSTHOG_CAPTURE_KEY?.trim() ?? "";
  if (key === "") return null;
  const host = env.POSTHOG_CAPTURE_HOST?.trim() || "https://us.i.posthog.com";
  return { key, host: host.replace(/\/+$/, "") };
}

/** One generation's observability facts — NO prompt/completion text, ever. */
export interface AiGeneration {
  /** The OpenRouter model slug that ran (the resolved lane model). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** OpenRouter's authoritative per-request USD cost (`usage.cost`). */
  totalCostUsd: number;
  /** Generation wall-clock latency, in SECONDS (PostHog's `$ai_latency` unit). */
  latencySeconds: number;
  /** Present on the success path (200); omitted when generation threw (status unobserved). */
  httpStatus?: number;
  isError: boolean;
  /** A machine reason on the failure path; omitted on success. Never carries model text. */
  error?: string;
}

const PROVIDER = "openrouter";
// No stable per-user identity on the public Ask-AI lane — question-log stores no identity (anonymous by
// construction, ADR-0236) and spend keys on the lane, not a user. "server" is the house sentinel for
// server-side capture, the same convention services/license/src/posthog-capture.ts uses.
const DISTINCT_ID = "server";

/**
 * Fire one `$ai_generation` event at PostHog's capture endpoint. NEVER throws — a non-2xx or network
 * failure collapses to one stderr line and the event is simply lost. Fire-and-forget by contract: the
 * caller does not await this into the answer path. A fresh trace id per call is doubled as the parent id
 * (a single-span generation, no nested children).
 */
export async function captureAiGeneration(
  config: AiCaptureConfig,
  gen: AiGeneration,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<void> {
  const traceId = crypto.randomUUID();
  const properties: Record<string, string | number | boolean> = {
    $ai_trace_id: traceId,
    $ai_parent_id: traceId,
    $ai_model: gen.model,
    $ai_provider: PROVIDER,
    $ai_input_tokens: gen.inputTokens,
    $ai_output_tokens: gen.outputTokens,
    $ai_total_cost_usd: gen.totalCostUsd,
    $ai_latency: gen.latencySeconds,
    $ai_is_error: gen.isError,
    ...(gen.httpStatus !== undefined
      ? { $ai_http_status: gen.httpStatus }
      : {}),
    ...(gen.error !== undefined ? { $ai_error: gen.error } : {}),
  };
  try {
    const res = await fetchImpl(
      `${config.host}/capture/`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.key,
          event: "$ai_generation",
          distinct_id: DISTINCT_ID,
          properties,
        }),
      },
      // Fail-open side-effect, not a request the caller waits on — short so a slow ingest endpoint
      // never holds a connection open (the house 2s server-side capture budget).
      { timeoutMs: 2000 },
    );
    if (!res.ok) {
      process.stderr.write(
        `[ask-ai] posthog $ai_generation non-2xx: ${String(res.status)}\n`,
      );
    }
  } catch {
    process.stderr.write("[ask-ai] posthog $ai_generation capture failed\n");
  }
}
