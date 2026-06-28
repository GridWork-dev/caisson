// Cloudflare Pages Function → Resend Segments (ADR-0046). Runs alongside the static export;
// the API key never enters the client bundle (read from the Pages env binding). Static-asset
// security headers come from public/_headers, but Cloudflare does NOT apply _headers to Function
// responses — so headers are set here, in-Response.
import { z } from "zod";

interface Env {
  RESEND_API_KEY?: string;
  RESEND_SEGMENT_ID?: string;
  // Cloudflare Turnstile secret. Inert seam (like Resend): when UNSET we skip verification
  // entirely — we never claim bot-protection we aren't running. When SET, every request must
  // carry a valid token or it is rejected.
  TURNSTILE_SECRET?: string;
  // Next step (NOT yet wired — documented, not faked): bind a Workers KV namespace as
  // `WAITLIST_RL` in the Pages project, then gate on a per-IP counter keyed by the
  // CF-Connecting-IP header (e.g. 5 / 10 min, TTL-expiring keys). Env-gated like the seams
  // above so the function stays correct with no binding present. Not asserting a rate limit
  // we don't enforce.
}

interface PagesContext {
  request: Request;
  env: Env;
}

// z.object().strict() rejects unknown fields (security floor). Email is bounded + pattern-checked.
const Body = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(254)
      .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "invalid email"),
    source: z.string().trim().max(64).optional(),
    // Honeypot: a hidden field no human fills. A non-empty value means a bot — we drop it
    // silently with a benign 202 (never reaching Resend) so the bot can't distinguish success.
    company_url: z.string().max(200).optional(),
    // Optional Cloudflare Turnstile token, verified only when TURNSTILE_SECRET is configured.
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: SECURITY_HEADERS,
  });
}

// fetchWithTimeout: every outbound fetch is bounded (engineering invariant). AbortController,
// not AbortSignal.timeout.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestPost = async (
  context: PagesContext,
): Promise<Response> => {
  const { env } = context;

  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid" }, 422);

  // Honeypot: a non-empty hidden field is a bot. Return a benign 202 WITHOUT touching Resend —
  // silently dropped, indistinguishable from success so the bot gets no signal to adapt.
  if (parsed.data.company_url && parsed.data.company_url.trim() !== "") {
    return json({ ok: true, queued: false }, 202);
  }

  // Turnstile verify seam (inert until TURNSTILE_SECRET is set — no fake "protected" claim).
  // When configured, every submission must carry a token that Cloudflare confirms; otherwise
  // reject. remoteip is bound to CF-Connecting-IP when present (defense against token replay).
  if (env.TURNSTILE_SECRET) {
    const token = parsed.data.turnstileToken;
    if (!token) return json({ error: "challenge_required" }, 403);
    try {
      const form = new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
      });
      const ip = context.request.headers.get("CF-Connecting-IP");
      if (ip) form.set("remoteip", ip);
      const verify = await fetchWithTimeout(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        },
        5000,
      );
      const outcome = (await verify.json()) as { success?: boolean };
      if (!verify.ok || outcome.success !== true) {
        return json({ error: "challenge_failed" }, 403);
      }
    } catch {
      // Fail closed: if the challenge can't be verified, don't admit the request.
      return json({ error: "challenge_failed" }, 403);
    }
  }

  // Seam: inert until a real Resend account + env are wired (ADR-0046; not this session). Return
  // a benign 202 so the form's success path works against a preview with no secrets.
  if (!env.RESEND_API_KEY || !env.RESEND_SEGMENT_ID) {
    return json({ ok: true, queued: false }, 202);
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.resend.com/contacts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Mandatory for raw HTTP — Resend rejects with 403/1010 without a User-Agent.
          "User-Agent": "caisson-waitlist/1.0",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          unsubscribed: false,
          segments: [{ id: env.RESEND_SEGMENT_ID }],
        }),
      },
      5000,
    );
    if (!res.ok) return json({ error: "upstream" }, 502);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "upstream" }, 502);
  }
};
