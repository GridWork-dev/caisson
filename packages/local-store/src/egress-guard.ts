// src/egress-guard.ts — the cloud-egress secret-scrub guard (ADR-0067 · T8 SECURITY). The Embedder
// PORT is the ONE path that can carry buyer content OFF the box (to a cloud embedder). Before any such
// egress, credential-bearing spans MUST be scrubbed, and the embed transport stays a TEST-DOUBLED
// seam — no live cloud call ever runs in CI (the live transport is the only un-exercised path).
//
// Threats this guard models (PLAN T8): (1) PII/credential content egressing to a cloud embedder —
// every text is run through `scrubForEgress` BEFORE it leaves; (2) a secret landing in a log/sink —
// nothing here logs the input, and thrown errors carry only a status/dim, never the content, the
// `apiKey`, or the rejected value; (3) a live cloud call sneaking into CI — the transport defaults to
// `fetchWithTimeout` but is an injectable seam tests replace with a double.
//
// Scrub contract (golden-pinned at `src/__golden__/scrub.json`, applied in this fixed order, each
// secret span collapsing to the constant sentinel `[REDACTED]` — no entropy is ever echoed):
//   A. PEM private-key block  → the whole armored block to the sentinel.
//   B. URL userinfo password  (`scheme://user:pass@host`) → `scheme://user:[REDACTED]@host`.
//   C. Secret-NAMED assignment(`<key><=|: ><value>`, key in the secret-name set) → drop the value.
//   D. Bare inline token shape (AWS / GitHub / OpenAI / JWT, no key=value context) → the sentinel.
// Non-secret text passes through unchanged (no false-positive redaction).
import { z } from "zod";
import {
  fetchWithTimeout,
  InternalError,
  parseStrict,
  strictObject,
} from "@caisson/kernel";
import { assertEmbeddingDim } from "./embedder.ts";
import type { Embedder } from "./embedder.ts";

/** The single redaction sentinel every secret span collapses to (constant — never leaks entropy). */
const REDACTION = "[REDACTED]";

// A — any armored "... PRIVATE KEY ..." block (RSA/EC/OPENSSH/PGP) collapses whole.
const PEM_PRIVATE_KEY =
  /-----BEGIN [^\n-]*PRIVATE KEY-----[\s\S]*?-----END [^\n-]*PRIVATE KEY-----/g;

// B — URL userinfo: drop ONLY the password, keep the scheme, username, and host/port/path.
const URL_USERINFO_PASSWORD = /([a-z][a-z0-9+.-]*:\/\/[^/:@\s]+:)[^/@\s]+(@)/gi;

// C — a `<key><sep><value>` assignment whose KEY names a secret; the whole value is dropped, the key
// and its exact separator (`=` or `: `) are preserved. `value` runs to end-of-line (single line).
const SECRET_ASSIGNMENT =
  /\b([A-Za-z][A-Za-z0-9_-]*)([ \t]*=[ \t]*|:[ \t]+)(\S[^\n]*)/g;
// Case-insensitive substring set of secret-bearing key names (ADR-0067 scrub contract).
const SECRET_NAME =
  /api[_-]?key|secret|token|passwd|password|pwd|authorization|bearer|access[_-]?key|private[_-]?key/i;

// D — bare inline token shapes with no key=value context (the fallback once A–C have run).
const INLINE_TOKENS: readonly RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access-key id
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, // GitHub fine-grained PAT
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub classic token (ghp_/gho_/ghu_/ghs_/ghr_)
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, // OpenAI secret key
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // JWT (header.payload.signature)
];

/**
 * Scrub credential-bearing spans from `text` before it egresses to a cloud embedder. Pure +
 * deterministic (no clock/randomness/env) and idempotent — re-scrubbing already-scrubbed text is a
 * no-op. The exact input→output table is pinned by the `scrub` golden so the contract cannot drift.
 */
export function scrubForEgress(text: string): string {
  let out = text.replace(PEM_PRIVATE_KEY, REDACTION);
  out = out.replace(URL_USERINFO_PASSWORD, `$1${REDACTION}$2`);
  out = out.replace(SECRET_ASSIGNMENT, (match, key: string, sep: string) =>
    SECRET_NAME.test(key) ? `${key}${sep}${REDACTION}` : match,
  );
  for (const re of INLINE_TOKENS) out = out.replace(re, REDACTION);
  return out;
}

/**
 * `true` when `text` carries a span the egress scrub would redact — a `looksLikeSecret`-style
 * predicate a caller can use to refuse or flag content before it ever reaches a backend.
 */
export function looksLikeSecret(text: string): boolean {
  return scrubForEgress(text) !== text;
}

/**
 * Wrap ANY embedder so every text is scrubbed BEFORE it reaches the backend (the cloud-egress guard).
 * Engine-neutral — works for a local or cloud backend; the wrapped embedder never sees a raw secret,
 * and nothing here logs the input. This is the reusable primitive the cloud transport composes.
 */
export function guardEmbedder(inner: Embedder): Embedder {
  return {
    dim: inner.dim,
    embed: (text: string): Promise<number[]> =>
      inner.embed(scrubForEgress(text)),
  };
}

/** Buyer config for the reference guarded cloud embedder — validated `.strict()` at the boundary. */
const CloudEmbedConfigSchema = strictObject({
  /** HTTPS embedding endpoint. Non-https (incl. `http:`/`file:`/`data:`) is rejected fail-closed. */
  endpoint: z
    .string()
    .url()
    .refine((u) => {
      try {
        return new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    }, "endpoint must be https"),
  /** Bearer credential for the endpoint — the legitimate egress credential; never logged. */
  apiKey: z.string().min(1),
  /** Model identifier forwarded to the endpoint. */
  model: z.string().min(1),
  /** Fixed embedding width; the returned vector is asserted to this dim (fail-closed). */
  dim: z.number().int().positive(),
  /** Optional request timeout (ms) for the embed fetch; absent ⇒ the `fetchWithTimeout` default. */
  timeoutMs: z.number().int().positive().max(120_000).optional(),
});

/** Boundary-valid cloud-embedder config. */
export type CloudEmbedConfig = z.infer<typeof CloudEmbedConfigSchema>;

/**
 * The embed transport seam. Defaults to `fetchWithTimeout` (the only sanctioned outbound-fetch path
 * on Bun); tests inject a double with the same signature, so CI never makes a live cloud call.
 */
export type EmbedFetch = typeof fetchWithTimeout;

/** The canonical wire response `createCloudEmbedder`'s endpoint must return — strict boundary. */
const EmbedResponseSchema = strictObject({
  embedding: z.array(z.number()),
});

/**
 * Build a reference guarded cloud embedder: it scrubs content (via `guardEmbedder`) BEFORE the body
 * leaves the box, POSTs the scrubbed text over `fetchWithTimeout` (injectable for tests — no live CI
 * call), and validates the response against `config.dim` (a wrong-width vector throws, never silently
 * corrupts the index). The endpoint's response contract is the strict `{ embedding: number[] }` shape;
 * a backend with a different response shape is wired through `guardEmbedder` around its own client.
 *
 * Redaction-safe throughout: nothing logs the content or the `apiKey`, and a failed transport throws
 * an `InternalError` carrying only the HTTP status — never the body, the key, or the input.
 */
export function createCloudEmbedder(
  rawConfig: unknown,
  fetchImpl: EmbedFetch = fetchWithTimeout,
): Embedder {
  const config = parseStrict(CloudEmbedConfigSchema, rawConfig);
  return guardEmbedder({
    dim: config.dim,
    // `text` is ALREADY scrubbed by the `guardEmbedder` wrapper — scrub-before-egress is structural.
    embed: async (text: string): Promise<number[]> => {
      // Omit `timeoutMs` entirely when unset (exactOptionalPropertyTypes) ⇒ the fetchWithTimeout default.
      const timeout =
        config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs };
      const res = await fetchImpl(
        config.endpoint,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({ model: config.model, input: text }),
        },
        timeout,
      );
      if (!res.ok) {
        // Status only — never the response body, the key, or the content.
        throw new InternalError("cloud embed request failed", {
          status: res.status,
        });
      }
      const json: unknown = await res.json();
      const { embedding } = parseStrict(EmbedResponseSchema, json);
      assertEmbeddingDim(config.dim, embedding);
      return embedding;
    },
  });
}
