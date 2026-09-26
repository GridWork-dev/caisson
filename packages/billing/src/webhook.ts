// Stripe webhook signature verification (ADR-0017). Re-implements Stripe's documented scheme over
// the RAW request body — HMAC-SHA256 of `${t}.${rawBody}`, timing-safe compared to the header's
// v1 signatures, with timestamp-tolerance replay protection. The raw body is mandatory: a parsed
// + re-serialized body would not match. No Stripe SDK needed for verification.
import { createHmac } from "node:crypto";
import { AuthnError, safeEqualFixed } from "@caisson-sh/kernel/node";

export interface VerifyOptions {
  /** Max age of the signature, seconds. Default 300 (Stripe's recommendation). */
  toleranceSec?: number;
  /** Override "now" (seconds). For tests. */
  now?: number;
}

function parseSignatureHeader(header: string): {
  timestamp: number;
  v1: string[];
} {
  let timestamp = Number.NaN;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && value.length > 0) v1.push(value);
  }
  return { timestamp, v1 };
}

/** Throws `AuthnError` unless `signatureHeader` is a valid, in-tolerance Stripe signature. */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  {
    toleranceSec = 300,
    now = Math.floor(Date.now() / 1000),
  }: VerifyOptions = {},
): void {
  const { timestamp, v1 } = parseSignatureHeader(signatureHeader);
  if (!Number.isFinite(timestamp) || v1.length === 0) {
    throw new AuthnError("Malformed Stripe signature header");
  }
  if (Math.abs(now - timestamp) > toleranceSec) {
    throw new AuthnError("Stripe signature timestamp outside tolerance");
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  let ok = false;
  for (const candidate of v1) {
    if (safeEqualFixed(expected, candidate)) ok = true;
  }
  if (!ok) throw new AuthnError("Invalid Stripe signature");
}
