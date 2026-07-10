// The product-updates capture endpoint (mechanical re-home of the Cloudflare Pages Function
// ADR-0046 wired, ADR-0114 scope item 1: the unified app now has a server, so this is a Next
// route handler instead of `functions/api/waitlist.ts`). Same contract: POST { email, source? },
// Resend Segments upsert, honeypot + optional Turnstile, never PII in errors. The Pages Function
// is retired in the same change (DEPLOY-class CF-Pages cutover handles deleting the dead file;
// this route is the live one as soon as the app runs on a Node server).
import { fetchWithTimeout } from "@caisson/kernel";
import { z } from "zod";

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
    // Honeypot: a hidden field no human fills. A non-empty value means a bot — dropped silently
    // with a benign 202 (never reaching Resend) so the bot can't distinguish success.
    company_url: z.string().max(200).optional(),
    // Optional Cloudflare Turnstile token, verified only when TURNSTILE_SECRET is configured.
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

const SECURITY_HEADERS: Record<string, string> = {
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

// Request-body byte cap enforced BEFORE buffering/parsing (CWE-770, Kickoff-K). This route is public +
// unauthenticated and a self-hosted Next App Router route handler imposes no body limit of its own, so an
// unbounded POST would buffer fully in memory. 16 KiB is generous for the bounded Body above. Same idiom
// as registry/worker/revocations-put.ts (content-length precheck + text-length check).
const MAX_BODY_BYTES = 16_384;

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413);
    }
    raw = JSON.parse(text);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid" }, 422);

  // Honeypot — a non-empty hidden field is a bot. Benign 202 WITHOUT touching Resend, silently
  // dropped, indistinguishable from success so the bot gets no signal to adapt.
  if (parsed.data.company_url && parsed.data.company_url.trim() !== "") {
    return json({ ok: true, queued: false }, 202);
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (turnstileSecret !== undefined && turnstileSecret.length > 0) {
    const token = parsed.data.turnstileToken;
    if (!token) return json({ error: "challenge_required" }, 403);
    try {
      const form = new URLSearchParams({
        secret: turnstileSecret,
        response: token,
      });
      // Railway terminates TLS behind a proxy — the connecting-client IP is forwarded, not the
      // CF-Connecting-IP header the old Pages Function read.
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      if (ip) form.set("remoteip", ip);
      const verify = await fetchWithTimeout(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        },
        { timeoutMs: 5000 },
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

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendSegmentId = process.env.RESEND_SEGMENT_ID;
  // Seam: inert until a real Resend account + env are wired. Return a benign 202 so the form's
  // success path works with no secrets configured.
  if (
    resendApiKey === undefined ||
    resendApiKey.length === 0 ||
    resendSegmentId === undefined ||
    resendSegmentId.length === 0
  ) {
    return json({ ok: true, queued: false }, 202);
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.resend.com/contacts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          // Mandatory for raw HTTP — Resend rejects with 403/1010 without a User-Agent.
          "User-Agent": "caisson-waitlist/1.0",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          unsubscribed: false,
          segments: [{ id: resendSegmentId }],
        }),
      },
      { timeoutMs: 5000 },
    );
    if (!res.ok) return json({ error: "upstream" }, 502);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
