// POST /api/demo/run orchestration (CAISSON-110, ADR-0350 F1(c)/F5 · ADR-0352). Pure of I/O wiring:
// every side-effecting seam (kill switch, Turnstile, rate-limit, budget reserve/release, generation,
// lead telemetry) is injected so the whole flow is exercised hermetically with fakes — the SAME shape
// as `lib/ask-ai/handler.ts`. `route.ts` builds the real deps from server-only env.
//
// Fixed API contract (do not renegotiate — ADR-0352):
//   413 {error:"payload_too_large"}   — body over the pre-parse size cap
//   400 {error:"invalid_request"}     — malformed body / Zod .strict() reject (unknown field)
//   403 {error:"challenge_failed"}    — Turnstile missing/invalid (FAIL-CLOSED)
//   429 {error:"rate_limited", retryAfterSec} — per-IP / per-/64 budget exhausted (Retry-After header)
//   503 {reason:"daily-cap"|"disabled"} — F5 cap tripped or the kill switch / auto-disable latch
//   500 {error:"generation_failed"}   — in-process generation crashed (fail-closed; healthy deploy never hits it)
//   200 {runId, tree:[{path,bytes}], files:{path→content}, moduleSummary, generatedInMs}
import { z } from "zod";
import { clientIp } from "@caisson/rate-limit";
import { readBodyBounded } from "../bounded-body.ts";
import { ipKeys } from "./store.ts";
import type { DemoRunResult } from "./run.ts";

/** {email, projectName, turnstileToken} is tiny — cap the body well below any legitimate payload.
 *  Enforced by the STREAMING bounded read (lib/bounded-body.ts), not a content-length precheck a
 *  chunked or NaN-length request could skip (CWE-770). */
const MAX_BODY_BYTES = 8_192;

/**
 * The request body, `.strict()` at the trust boundary (rejects unknown fields — security floor).
 * `email` reuses the shipped waitlist route's bounded + pattern-checked shape (TELEMETRY ONLY — never a
 * quota key or security principal, ADR-0352 rider 1). `projectName` reuses the CLI's `ProjectName` slug
 * rules verbatim (`packages/cli/src/seam.ts`: lowercase slug, 1–64 chars) as defense-in-depth —
 * `generateDemo` re-validates it internally through `generate()` → `Selection.parse` regardless.
 */
export const DemoRunBody = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "invalid email"),
    projectName: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug"),
    turnstileToken: z.string().max(2048),
  })
  .strict();
export type DemoRunBody = z.infer<typeof DemoRunBody>;

export interface DemoRunDeps {
  /** `DEMO_RUN_ENABLED` kill switch (+ any process-level disable). False → fail-closed 503 `disabled`. */
  enabled: () => boolean;
  /** Turnstile verification (fail-closed: unreachable verifier / missing token → reject). */
  verifyTurnstile: (token: string | undefined, ip: string) => Promise<boolean>;
  /** Charge one rate-limit account key (per-IP / per-/64) against the PG account-store. */
  checkRate: (
    key: string,
  ) => Promise<{ allowed: boolean; retryAfterSec: number }>;
  /** F5 atomic reserve — run-count + concurrency. `false` → escalate to 503 with the reason. */
  reserve: () => Promise<
    { ok: true } | { ok: false; reason: "daily-cap" | "disabled" }
  >;
  /** Release the concurrency slot on completion (best-effort). */
  release: () => Promise<void>;
  /** Generate the visitor's scaffold in-process, bounded to the contract. May throw (→ 500). */
  generate: (projectName: string) => DemoRunResult | Promise<DemoRunResult>;
  /** Record the lead (telemetry only, best-effort). */
  recordLead: (email: string, runId: string, ip: string) => Promise<void>;
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function jsonResponse(
  body: unknown,
  status: number,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...extra,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function jsonError(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

/** Handle one POST /api/demo/run. Never throws — every failure is a status code per the contract. */
export async function handleDemoRun(
  req: Request,
  deps: DemoRunDeps,
): Promise<Response> {
  // 1. body — read through the STREAMING size cap (never fully buffered first, CWE-770), then a
  //    bad/unknown-field body dies here.
  const body = await readBodyBounded(req, MAX_BODY_BYTES);
  if (!body.ok) return jsonError("payload_too_large", 413);
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(body.text);
  } catch {
    return jsonError("invalid_request", 400);
  }
  const parsed = DemoRunBody.safeParse(rawBody);
  if (!parsed.success) return jsonError("invalid_request", 400);
  const { email, projectName } = parsed.data;

  // 2. kill switch / auto-disable — fail closed before any work.
  if (!deps.enabled()) return jsonResponse({ reason: "disabled" }, 503);

  // 3. bot gate — Turnstile at enqueue, FAIL-CLOSED (rider 1). Before any rate-limit / DB work.
  const ip = clientIp(req);
  if (!(await deps.verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return jsonError("challenge_failed", 403);
  }

  // 4. per-IP + per-/64 rate limits (PG account-store). Any deny → 429 with a Retry-After.
  for (const key of ipKeys(ip)) {
    const dec = await deps.checkRate(key);
    if (!dec.allowed) {
      return jsonResponse(
        { error: "rate_limited", retryAfterSec: dec.retryAfterSec },
        429,
        { "Retry-After": String(dec.retryAfterSec) },
      );
    }
  }

  // 5. F5 atomic reserve — run-count + concurrency. Fail-closed to 503.
  const reservation = await deps.reserve();
  if (!reservation.ok) return jsonResponse({ reason: reservation.reason }, 503);

  // 6. generate in-process; ALWAYS release the concurrency slot (best-effort).
  const runId = crypto.randomUUID();
  let result: DemoRunResult;
  try {
    result = await deps.generate(projectName);
  } catch {
    return jsonError("generation_failed", 500);
  } finally {
    try {
      await deps.release();
    } catch {
      /* best-effort: a metering write must never fail the user's response */
    }
  }

  // 7. lead telemetry (best-effort) + the bounded artifact.
  try {
    await deps.recordLead(email, runId, ip);
  } catch {
    /* best-effort: telemetry never blocks the response */
  }
  return jsonResponse({ runId, ...result }, 200);
}
