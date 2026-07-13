// The cassette boundary for the judged intel replay harness (CAISSON-101, ADR-0286 §eval).
//
// A cassette is the sanitized, byte-reproducible record of ONE watcher run: the config it saw, the
// watch_state it read, every HTTP exchange it made, and the raw findings it produced. The replay
// harness (intel-briefs.eval.test.ts) reconstructs the watcher's exact world from a cassette and
// re-runs the REAL watcher code with zero watcher-network and zero watcher tokens. Accuracy +
// grounding remain deterministic; brief composition and actionability judging are deliberately live
// model calls in the credentialed eval lane (CAISSON-102). Model outputs never enter this dataset.
//
// Recording is an OPERATOR act (record.cli.ts). A cassette may be committed only with the baseline
// after deterministic replay and the live judged run are green (green-only dataset discipline). The
// scrub gate below (`assertScrubbed`) is the fail-closed guarantee that no secret VALUE survives into
// a written cassette.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";
import { FindingSchema } from "../finding.ts";
import { loadConfig } from "../config.ts";
import type { Config } from "../config.ts";
import type { Fetcher } from "../http.ts";

// --- Schema (strict boundary — a cassette is a shape WE own) -------------------------------------

/** One captured HTTP exchange. Request HEADERS are never recorded (they carry Bearer tokens); only
 *  method + url + the response status/content-type/body, which the scrub pass sanitizes. */
export const cassetteExchangeSchema = strictObject({
  method: z.string().trim().min(1),
  url: z.string().trim().min(1),
  status: z.number().int(),
  contentType: z.string().optional(),
  body: z.string(),
});
export type CassetteExchange = z.infer<typeof cassetteExchangeSchema>;

/** The non-secret config the watcher saw, plus a boolean-only note of which credential legs were
 *  present. The booleans (not the secret values) drive replay's dummy-cred injection below — a
 *  watcher self-skips a leg whose cred is absent, so replay must re-present a placeholder to walk
 *  the same fetch code path, with the replay fetcher intercepting the (never-dialed) call. */
export const cassetteConfigSchema = strictObject({
  competitorUrls: z.array(z.string()),
  githubOrg: z.string(),
  posthogApiHost: z.string(),
  posthogProjectId: z.string(),
  plausibleApiHost: z.string(),
  plausibleSiteId: z.string().optional(),
  credsPresent: strictObject({
    githubToken: z.boolean(),
    posthogApiKey: z.boolean(),
    plausibleApiKey: z.boolean(),
  }),
});
export type CassetteConfig = z.infer<typeof cassetteConfigSchema>;

export const intelCassetteSchema = strictObject({
  schemaVersion: z.literal(2),
  watcher: z.string().min(1),
  recordedAt: z.string().datetime(),
  config: cassetteConfigSchema,
  watchState: z.record(z.string(), z.string()),
  exchanges: z.array(cassetteExchangeSchema),
  findings: z.array(FindingSchema),
});
export type IntelCassette = z.infer<typeof intelCassetteSchema>;

/** Strict-parse a cassette document (from a file or a fixture). Rejects unknown keys and a malformed
 *  finding/verdict — a cassette is fully validated before any replay reads it. */
export function parseCassetteFile(raw: unknown): IntelCassette {
  return parseStrict(intelCassetteSchema, raw);
}

/** Read + strict-parse a cassette JSON file from disk. */
export function readCassetteFile(path: string): IntelCassette {
  return parseCassetteFile(JSON.parse(readFileSync(path, "utf8")));
}

// --- Scrub (the fail-closed write gate) ----------------------------------------------------------

// Generic token shapes that must never survive into a cassette even if an operator forgot to list
// one as a secret value. Deliberately broad (matches placeholders like "replay-dummy" too — a
// harmless over-redaction): a false redaction is cheap, a leaked token is not.
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g;
const KEY_PREFIXED_RE =
  /(?:phc_|phx_|lin_api_|sk-|ghp_|github_pat_)[A-Za-z0-9._-]{8,}/g;
// A pragmatic email shape — an operator email in a payload/body is PII, redacted to a stable token.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Replace every occurrence of each known secret VALUE with `[redacted]`, then sweep generic
 *  token/email patterns. Literal (non-regex) replacement for the known values so a secret containing
 *  regex metacharacters is still fully removed. */
export function scrubText(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    out = out.split(secret).join("[redacted]");
  }
  out = out.replace(BEARER_RE, "[redacted]");
  out = out.replace(KEY_PREFIXED_RE, "[redacted]");
  out = out.replace(EMAIL_RE, "[redacted-email]");
  return out;
}

/** THROWS if any known secret VALUE survives anywhere in the final serialized cassette — the
 *  fail-closed gate `record.cli.ts` runs immediately before `writeFileSync`. The error never echoes
 *  the surviving value (that would defeat the purpose); it reports only that the gate tripped. */
export function assertScrubbed(
  serialized: string,
  secrets: readonly string[],
): void {
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    if (serialized.includes(secret)) {
      throw new Error(
        `scrub gate failed: a secret value (length ${String(secret.length)}) survived in the serialized cassette — refusing to write`,
      );
    }
  }
}

// --- Replay (fail-closed reconstruction of the watcher's world) ----------------------------------

/** Normalize any `Fetcher` input form to the string URL used as the replay match key. */
function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * A `Fetcher` that answers only from the cassette's recorded exchanges, matched by `METHOD url` with
 * a FIFO queue per key (so two calls to the same endpoint replay in recorded order). A MISS THROWS:
 * a replayed watcher may NEVER reach the live network, so an unrecorded request is a hard, loud error
 * rather than a silent live fetch. The recorded content-type is echoed back so the watcher's own
 * `res.json()` / `res.text()` paths behave exactly as they did at record time.
 */
export function buildReplayFetcher(
  exchanges: readonly CassetteExchange[],
): Fetcher {
  const queues = new Map<string, CassetteExchange[]>();
  for (const ex of exchanges) {
    const key = `${ex.method.toUpperCase()} ${ex.url}`;
    const queue = queues.get(key) ?? [];
    queue.push(ex);
    queues.set(key, queue);
  }
  const fetcher: Fetcher = (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const key = `${method} ${urlOf(input)}`;
    const ex = queues.get(key)?.shift();
    if (ex === undefined) {
      throw new Error(
        `cassette replay miss: no recorded exchange for "${key}" — a replayed watcher must never reach the network`,
      );
    }
    const headers: Record<string, string> = {};
    if (ex.contentType !== undefined) headers["content-type"] = ex.contentType;
    return Promise.resolve(
      new Response(ex.body, { status: ex.status, headers }),
    );
  };
  return fetcher;
}

/**
 * Reconstruct the `Config` a watcher must see to replay deterministically. Starts from `loadConfig`
 * with a single throwaway DSN (the store is never dialed in replay — the InMemoryStore stands in),
 * overrides the recorded non-secret fields, and re-injects a DUMMY value for exactly the credential
 * legs the recording marked present. WHY the dummies: a watcher self-skips a leg whose credential is
 * absent (analytics' Plausible leg, github's token leg, …); replay must walk the SAME code path the
 * recording did, and the replay fetcher — not the credential — is what makes the call safe. `llmEnabled`
 * is forced OFF: enrichment is a separate token-spending seam that the cassette records pre-enrichment.
 */
export function replayConfig(cassette: IntelCassette): Config {
  const base = loadConfig({
    INTEL_DATABASE_URL: "postgres://replay-never-dialed",
  });
  const c = cassette.config;
  return {
    ...base,
    competitorUrls: c.competitorUrls,
    githubOrg: c.githubOrg,
    posthogApiHost: c.posthogApiHost,
    posthogProjectId: c.posthogProjectId,
    plausibleApiHost: c.plausibleApiHost,
    llmEnabled: false,
    // exactOptionalPropertyTypes: only add optional keys when present, never as explicit `undefined`.
    ...(c.plausibleSiteId !== undefined
      ? { plausibleSiteId: c.plausibleSiteId }
      : {}),
    ...(c.credsPresent.githubToken ? { githubToken: "replay-dummy" } : {}),
    ...(c.credsPresent.posthogApiKey ? { posthogApiKey: "replay-dummy" } : {}),
    ...(c.credsPresent.plausibleApiKey
      ? { plausibleApiKey: "replay-dummy" }
      : {}),
  };
}
