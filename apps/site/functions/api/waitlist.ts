// Cloudflare Pages Function → Resend Segments (ADR-0046). Runs alongside the static export;
// the API key never enters the client bundle (read from the Pages env binding). Static-asset
// security headers come from public/_headers, but Cloudflare does NOT apply _headers to Function
// responses — so headers are set here, in-Response.
import { z } from "zod";

interface Env {
  RESEND_API_KEY?: string;
  RESEND_SEGMENT_ID?: string;
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
