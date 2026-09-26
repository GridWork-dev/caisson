// Paddle Billing webhook signature verification (ADR-0108). Re-implements Paddle's documented manual
// scheme over the RAW request body — HMAC-SHA256 of `${ts}:${rawBody}` (colon-joined, vs. Stripe's
// period-joined `${t}.${rawBody}`), timing-safe compared to the `Paddle-Signature` header's `h1`
// value(s), with timestamp-tolerance replay protection — the same shape as the Stripe driver
// (./webhook.ts), just a different header format and join character. The raw body is mandatory: a
// parsed + re-serialized body would not match. Hand-rolled, thin client — NO @paddle/paddle-node-sdk
// dependency (mirrors the Stripe driver's no-SDK posture; ADR-0108's "Verify using Paddle SDKs" path
// is the recommended-but-optional one, not required).
import { createHmac } from "node:crypto";
import { AuthnError, safeEqualFixed } from "@caisson-sh/kernel/node";
import type { VerifyOptions } from "./webhook.ts";

function parsePaddleSignatureHeader(header: string): {
  timestamp: number;
  h1: string[];
} {
  let timestamp = Number.NaN;
  const h1: string[] = [];
  // Paddle's `Paddle-Signature` header is `ts=<unix>;h1=<hex>` — semicolon-separated key=value pairs
  // (Stripe's analogous header is comma-separated). Collect every `h1` defensively (Paddle documents
  // future secret-rotation support returning more than one).
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "ts") timestamp = Number(value);
    else if (key === "h1" && value.length > 0) h1.push(value);
  }
  return { timestamp, h1 };
}

/**
 * Throws `AuthnError` unless `signatureHeader` is a valid, in-tolerance Paddle signature.
 *
 * The default tolerance is Paddle's OWN documented SDK default — five SECONDS ("Our SDKs have a
 * default tolerance of five seconds between the timestamp and the current time",
 * developer.paddle.com/webhooks/signature-verification; verified 2026-07-01). The earlier 300s
 * default here silently inherited Stripe's window and left a 5-minute replay envelope. A delivery
 * rejected for skew is retried by Paddle with a FRESH signature (60 attempts over 3 days on live),
 * so the tight window costs nothing durable.
 */
export function verifyPaddleWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  { toleranceSec = 5, now = Math.floor(Date.now() / 1000) }: VerifyOptions = {},
): void {
  const { timestamp, h1 } = parsePaddleSignatureHeader(signatureHeader);
  if (!Number.isFinite(timestamp) || h1.length === 0) {
    throw new AuthnError("Malformed Paddle signature header");
  }
  if (Math.abs(now - timestamp) > toleranceSec) {
    throw new AuthnError("Paddle signature timestamp outside tolerance");
  }
  // Paddle's signed payload is `${ts}:${rawBody}` — confirmed colon-joined (developer.paddle.com,
  // "Verify webhook signatures" — manual verification steps), unlike Stripe's period-joined scheme.
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`)
    .digest("hex");
  let ok = false;
  for (const candidate of h1) {
    if (safeEqualFixed(expected, candidate)) ok = true;
  }
  if (!ok) throw new AuthnError("Invalid Paddle signature");
}
