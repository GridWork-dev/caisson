# ADR-0046 — Waitlist capture seam: Cloudflare Pages Function → Resend Segments

Status: accepted · 2026-06-27 (closes the **"Waitlist / primary-CTA mechanism"** open fork for the
GTM session. Pre-launch the hero CTA is capture, not checkout — commerce is a deferred wave.)

The site's primary CTA is a waitlist signup handled by a single Cloudflare Pages Function
(`apps/site/functions/api/waitlist.ts` → `/api/waitlist`) that adds the contact to **Resend**
(the locked email provider, ADR-0018) via the **Segments** API — `POST https://api.resend.com/contacts`
with a `segments: [{ id }]` body. The function runs alongside the static export; the Resend API key
and segment id are read from the Pages environment binding, never the client bundle.

## Why

A Pages Function is the native runtime seam for a static-exported Pages site — it keeps the API secret
server-side (in `context.env`), needs no new vendor, and Resend is already locked (ADR-0018). Resend's
docs now mark **Audiences deprecated in favor of Segments**, so a greenfield build targets Segments —
the non-deprecated canonical path — rather than the legacy `/audiences/{id}/contacts` endpoint. Same
provider, same one outbound call, same secret-in-env pattern.

## Scope

The function validates the request body with **Zod `.strict()`** (email only; trimmed, lowercased,
length-bounded), wraps the outbound Resend call in **`fetchWithTimeout`** (the native AbortSignal
timeout is forbidden on Bun), sets the **mandatory `User-Agent` header** Resend requires for raw HTTP
(403/1010 without it), and never echoes the upstream error body to the client. Security headers
(`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Cache-Control: no-store`)
are set **inside** the function response — Cloudflare does **not** apply `public/_headers` rules to
Pages Function responses; a `functions/_middleware.ts` centralizes the header policy. If the function
is ever gated by a shared token, the compare uses `crypto.timingSafeEqual`. On success it fires the
Plausible `Signup` goal client-side (ADR-0047). The function is a **seam**: inert until a real Resend
account + `RESEND_API_KEY` / `RESEND_SEGMENT_ID` env are wired (not this session — no live launch).

## Rejected

- **Resend Audiences** (`POST /audiences/{id}/contacts`) — the fork's literal wording, but
  Resend-flagged deprecated; Segments is the forward path.
- **Third-party embed** (Buttondown / ConvertKit / hosted form) — a new vendor + an external script on
  a privacy-forward brand page.
- **OpenNext route handler / server action** — would pull in the Workers deploy mode rejected in
  ADR-0045.

## Binding

The waitlist is a Cloudflare Pages Function calling Resend Segments with a Zod-`.strict()` body, an
`fetchWithTimeout`-wrapped outbound call, the secret read only from the Pages env, and security headers
set in-function. Switching the list primitive, provider, or runtime requires a superseding ADR.
