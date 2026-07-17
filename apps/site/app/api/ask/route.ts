// POST /api/ask — the buyer/prospect-facing "Ask AI" route (ADR-0234). A same-origin Next Route
// Handler that ports rag.py's grounding discipline to TS and streams a grounded, cited answer over the
// live docs corpus. `services/docs` stays a pure retrieval, server-to-server contract (F7); synthesis,
// the browser session, CSP, and Plausible all already live in the site. All the orchestration + the
// response contract live in lib/ask-ai/handler.ts (hermetically tested); this file only wires real deps
// from server-only env: DOCS_SERVICE_TOKEN, OPENROUTER_API_KEY, TURNSTILE_SECRET never reach the browser.
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  captureAiGeneration,
  loadAiCaptureConfig,
} from "@/lib/ask-ai/ai-capture";
import { type AskDeps, handleAsk } from "@/lib/ask-ai/handler";
import { logQuestion } from "@/lib/ask-ai/question-log";
import { retrieveChunks } from "@/lib/ask-ai/retrieve";
import { streamOpenRouter } from "@/lib/ask-ai/openrouter";
import { throttleEscalate } from "@/lib/ask-ai/escalate-throttle";
import {
  loadSiteEscalateConfig,
  pushSiteEscalation,
} from "@/lib/ask-ai/site-escalate";
import {
  reserveSpendMicro,
  resolveDailyCapMicro,
  settleSpendMicro,
} from "@/lib/ask-ai/spend";
import { makeTurnstileVerifier } from "@/lib/ask-ai/turnstile";

// Reads the session cookie + streams — never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Model-lane defaults (ADR-0234 F2). Both env-swappable — the operator can drop the public lane to
// deepseek/deepseek-v4-flash (or any model) via ASK_AI_PUBLIC_MODEL without a code change.
const DEFAULT_PUBLIC_MODEL = "google/gemini-3.5-flash";
const DEFAULT_PREMIUM_MODEL = "anthropic/claude-sonnet-4.6";

// Module scope (constructed ONCE per process, not per request — SHIP review WR-01): the throttle's
// dedup window + per-minute cap must persist across requests to mean anything. `buildDeps()` runs on
// every POST, so wiring `throttleEscalate` inside it would reset both guards on every request.
const escalateConfig = loadSiteEscalateConfig();
const throttledEscalate =
  escalateConfig !== null
    ? throttleEscalate(async (question, reason) => {
        await pushSiteEscalation(escalateConfig, question, reason);
      })
    : null;

// M4 (CAISSON-120): server-side $ai_generation capture, env-gated on POSTHOG_CAPTURE_KEY (unset ⇒
// null ⇒ no capture, zero behavior change). Resolved once per process, like escalateConfig above.
const aiCaptureConfig = loadAiCaptureConfig();

function envOr(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v !== undefined && v.length > 0 ? v : fallback;
}

function buildDeps(): AskDeps {
  const verifyTurnstile = makeTurnstileVerifier({
    secret: process.env.TURNSTILE_SECRET,
    isProduction: process.env.NODE_ENV === "production",
  });
  return {
    verifyTurnstile,
    isAuthed: async () => (await getSession()) !== null,
    retrieve: (question) =>
      retrieveChunks(question, {
        url: process.env.DOCS_QUERY_URL ?? "",
        token: process.env.DOCS_SERVICE_TOKEN ?? "",
        k: 6,
      }),
    stream: (args) =>
      streamOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY ?? "",
        model: args.model,
        system: args.system,
        user: args.user,
      }),
    spend: {
      reserve: async (lane) =>
        reserveSpendMicro(await getDb(), lane, resolveDailyCapMicro(lane)),
      settle: async (lane, actualMicro) => {
        await settleSpendMicro(await getDb(), lane, actualMicro);
      },
    },
    models: {
      public: envOr("ASK_AI_PUBLIC_MODEL", DEFAULT_PUBLIC_MODEL),
      premium: envOr("ASK_AI_PREMIUM_MODEL", DEFAULT_PREMIUM_MODEL),
    },
    // ADR-0236: consent-noticed question capture (the handler treats it as best-effort).
    capture: async (lane, question, outcome) => {
      await logQuestion(await getDb(), lane, question, outcome);
    },
    // G21: ticket parity with the Discord bot's own escalations, throttled (WR-01: dedup window +
    // a global per-minute cap — see escalate-throttle.ts). `exactOptionalPropertyTypes` means the
    // key must be OMITTED (not set to `undefined`) when the push is unconfigured, so the optional
    // dep is spread in rather than assigned a possibly-undefined value.
    ...(throttledEscalate !== null ? { escalate: throttledEscalate } : {}),
    // M4: emit one $ai_generation event per model call (fire-and-forget, never throws). Same
    // omit-when-unconfigured spread as `escalate` (exactOptionalPropertyTypes).
    ...(aiCaptureConfig !== null
      ? {
          captureGeneration: (gen) => captureAiGeneration(aiCaptureConfig, gen),
        }
      : {}),
  };
}

export function POST(request: Request): Promise<Response> {
  return handleAsk(request, buildDeps());
}
