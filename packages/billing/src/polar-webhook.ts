// Polar / Standard Webhooks signature verification (ADR-0175). Extracted into its own open verify-only
// file (billing carve, ADR-0249 G3 — uniform rule: signature-verify open for all four providers). NO SDK
// — hand-rolled over the raw request body + the Standard Webhooks scheme (https://www.standardwebhooks.com),
// mirroring the Stripe/Paddle/LemonSqueezy verifiers' no-SDK posture.
import { createHmac } from "node:crypto";
import { AuthnError, safeEqualFixed } from "@caisson-sh/kernel/node";
import type { VerifyOptions } from "./webhook.ts";

/**
 * Parses the ONE `signatureHeader` string the shared `BillingProvider` port passes into the three
 * separate headers the Standard Webhooks spec requires (`webhook-id`, `webhook-timestamp`,
 * `webhook-signature`) — unlike Stripe/Paddle, which carry the timestamp inline in their one signature
 * header, Polar/Standard-Webhooks splits it across three. The caller joins them in the SAME order the
 * spec signs them in: `${webhook-id}.${webhook-timestamp}.${webhook-signature}` (period-joined — the
 * signature value itself is base64 and never contains a period, so splitting on the first two periods
 * unambiguously recovers all three fields).
 */
function parsePolarSignatureHeader(header: string): {
  id: string;
  timestamp: string;
  signatures: string[];
} {
  const firstDot = header.indexOf(".");
  const secondDot = firstDot === -1 ? -1 : header.indexOf(".", firstDot + 1);
  if (firstDot === -1 || secondDot === -1) {
    return { id: "", timestamp: "", signatures: [] };
  }
  const id = header.slice(0, firstDot);
  const timestamp = header.slice(firstDot + 1, secondDot);
  const signatures = header
    .slice(secondDot + 1)
    .split(" ")
    .map((token) => token.split(","))
    .filter((parts) => parts.length === 2 && parts[0] === "v1")
    .map((parts) => parts[1] ?? "");
  return { id, timestamp, signatures };
}

/** Standard Webhooks secrets are base64 (optionally `whsec_`-prefixed — strip before decoding). */
function decodeStandardWebhooksSecret(secret: string): Buffer {
  const stripped = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  return Buffer.from(stripped, "base64");
}

/** Throws `AuthnError` unless `signatureHeader` (the joined `id.timestamp.signature` — see
 * `parsePolarSignatureHeader`) is a valid, in-tolerance Standard Webhooks signature. */
export function verifyPolarWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  {
    toleranceSec = 300,
    now = Math.floor(Date.now() / 1000),
  }: VerifyOptions = {},
): void {
  const { id, timestamp, signatures } =
    parsePolarSignatureHeader(signatureHeader);
  const ts = Number(timestamp);
  if (id === "" || !Number.isFinite(ts) || signatures.length === 0) {
    throw new AuthnError("Malformed Polar signature header");
  }
  if (Math.abs(now - ts) > toleranceSec) {
    throw new AuthnError("Polar signature timestamp outside tolerance");
  }
  const key = decodeStandardWebhooksSecret(secret);
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  let ok = false;
  for (const candidate of signatures) {
    if (safeEqualFixed(expected, candidate)) ok = true;
  }
  if (!ok) throw new AuthnError("Invalid Polar signature");
}
