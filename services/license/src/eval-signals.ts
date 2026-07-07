// The NETWORK half of eval verification (ADR-0280): resolve a domain's signals — MX presence,
// registration age, optional enrichment risk — for the pure scorer in `eval-verification.ts`. Kept
// in its own file so the scorer stays deterministic + network-free in tests and this file is the one
// place outbound calls live.
//
// FAIL-CLOSED-AS-UNCERTAINTY: any lookup that errors / times out / is not configured resolves to
// `undefined`, which the scorer reads as UNCERTAINTY (widen toward the operator review queue), never
// as a pass (ADR-0280: "fail-toward-manual, never fail-open"). Only a DEFINITIVE empty-MX answer
// resolves `mx: false` (the hard pre-gate reject); a DNS error stays `undefined` (a transient blip
// must not auto-reject a legitimate work domain).
//
// EGRESS: MX is a standard DNS lookup (system resolver). RDAP + enrichment are HTTP and CONFIG-GATED
// — with `EVAL_RDAP_URL` / `EVAL_ENRICHMENT_URL` unset there is NO outbound HTTP at all, and the
// scorer runs on MX alone (borderline → review). Enabling either adds an external egress sink: record
// the host in the surfaces ledger at that time (identity/security-surfaces.md).
import { Resolver } from "node:dns/promises";
import { fetchWithTimeout } from "@caisson/kernel";
import { z } from "zod";
import type { DomainSignals } from "./eval-verification.ts";

/** Config for the network resolver (separate from the scoring thresholds in `eval-verification.ts`). */
export interface EvalSignalsConfig {
  /** RDAP base URL (e.g. `https://rdap.org`) — domain age is looked up at `${base}/domain/<domain>`.
   *  Empty ⇒ no RDAP call, `ageDays` stays undefined (borderline → review). */
  readonly rdapBaseUrl: string;
  /** Optional enrichment endpoint — GET `${url}?domain=<domain>` expecting JSON `{ risk: 0..100 }`.
   *  Empty ⇒ no enrichment call, `enrichmentRisk` stays undefined. */
  readonly enrichmentUrl: string;
  /** Bearer for the enrichment endpoint (optional; only sent when both it and the URL are set). */
  readonly enrichmentToken: string;
  /** Per-lookup timeout in ms (DNS + HTTP). */
  readonly timeoutMs: number;
  /** DNS resolver tries before giving up (fail-closed to undefined on exhaustion). */
  readonly dnsTries: number;
}

const EvalSignalsEnv = z.object({
  EVAL_RDAP_URL: z.string().trim().default(""),
  EVAL_ENRICHMENT_URL: z.string().trim().default(""),
  EVAL_ENRICHMENT_TOKEN: z.string().trim().default(""),
  EVAL_SIGNALS_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  EVAL_DNS_TRIES: z.coerce.number().int().positive().max(5).default(2),
});

/** Load the network-resolver config from env. A present-but-invalid value fails startup closed. */
export function loadEvalSignalsConfig(
  env: NodeJS.ProcessEnv = process.env,
): EvalSignalsConfig {
  const parsed = EvalSignalsEnv.parse(env);
  // Reject a non-https RDAP/enrichment URL outright (security floor — never talk to a plaintext /
  // javascript:/file: endpoint). Empty is fine (feature off).
  for (const url of [parsed.EVAL_RDAP_URL, parsed.EVAL_ENRICHMENT_URL]) {
    if (url.length > 0 && new URL(url).protocol !== "https:") {
      throw new Error("EVAL_RDAP_URL / EVAL_ENRICHMENT_URL must be https");
    }
  }
  return {
    rdapBaseUrl: parsed.EVAL_RDAP_URL,
    enrichmentUrl: parsed.EVAL_ENRICHMENT_URL,
    enrichmentToken: parsed.EVAL_ENRICHMENT_TOKEN,
    timeoutMs: parsed.EVAL_SIGNALS_TIMEOUT_MS,
    dnsTries: parsed.EVAL_DNS_TRIES,
  };
}

/**
 * MX presence for `domain`. Resolves `true` (>=1 MX record), `false` (a DEFINITIVE empty answer —
 * ENODATA/ENOTFOUND), or `undefined` (any other error / timeout — transient, do NOT auto-reject).
 * The distinction matters: `false` is the hard reject pre-gate; `undefined` only widens to review.
 */
async function resolveMx(
  domain: string,
  config: EvalSignalsConfig,
): Promise<boolean | undefined> {
  const resolver = new Resolver({
    timeout: config.timeoutMs,
    tries: config.dnsTries,
  });
  try {
    const records = await resolver.resolveMx(domain);
    return records.length > 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // A DEFINITIVE "this domain has no MX / does not exist" — safe to treat as a hard reject signal.
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "NODATA") {
      return false;
    }
    // ETIMEOUT / SERVFAIL / anything else: transient — unknown, never a reject.
    return undefined;
  }
}

const RdapResponse = z.object({
  events: z
    .array(z.object({ eventAction: z.string(), eventDate: z.string() }))
    .optional(),
});

/** Domain registration age in whole days via RDAP, or undefined on any failure / when RDAP is off. */
async function resolveAgeDays(
  domain: string,
  config: EvalSignalsConfig,
  now: Date,
): Promise<number | undefined> {
  if (config.rdapBaseUrl.length === 0) return undefined;
  try {
    const url = `${config.rdapBaseUrl.replace(/\/+$/, "")}/domain/${encodeURIComponent(domain)}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { accept: "application/rdap+json" } },
      { timeoutMs: config.timeoutMs },
    );
    if (!res.ok) return undefined;
    const parsed = RdapResponse.safeParse(await res.json());
    if (!parsed.success) return undefined;
    const registration = parsed.data.events?.find(
      (e) => e.eventAction === "registration",
    );
    if (registration === undefined) return undefined;
    const registered = Date.parse(registration.eventDate);
    if (Number.isNaN(registered)) return undefined;
    const days = Math.floor((now.getTime() - registered) / 86_400_000);
    return days >= 0 ? days : undefined;
  } catch {
    return undefined;
  }
}

const EnrichmentResponse = z.object({ risk: z.coerce.number() });

/** Optional enrichment risk (0..100), or undefined on any failure / when enrichment is off. */
async function resolveEnrichmentRisk(
  domain: string,
  config: EvalSignalsConfig,
): Promise<number | undefined> {
  if (config.enrichmentUrl.length === 0) return undefined;
  try {
    const url = new URL(config.enrichmentUrl);
    url.searchParams.set("domain", domain);
    const headers: Record<string, string> = { accept: "application/json" };
    if (config.enrichmentToken.length > 0) {
      headers.authorization = `Bearer ${config.enrichmentToken}`;
    }
    const res = await fetchWithTimeout(
      url,
      { headers },
      { timeoutMs: config.timeoutMs },
    );
    if (!res.ok) return undefined;
    const parsed = EnrichmentResponse.safeParse(await res.json());
    if (!parsed.success) return undefined;
    return Math.max(0, Math.min(100, parsed.data.risk));
  } catch {
    return undefined;
  }
}

/** The MX-lookup signature — injectable so tests never touch real DNS (default = {@link resolveMx}). */
export type MxResolver = (
  domain: string,
  config: EvalSignalsConfig,
) => Promise<boolean | undefined>;

/**
 * Resolve all three domain signals concurrently. Never throws — each leg fails closed to its
 * uncertain value (undefined) independently, so one slow/failed lookup never blocks or fails the
 * others. `now` is injectable for deterministic age tests; `mxResolver` is injectable so unit tests
 * exercise the RDAP/enrichment parsing without a live DNS round-trip.
 */
export async function resolveDomainSignals(
  domain: string,
  config: EvalSignalsConfig,
  now: Date = new Date(),
  mxResolver: MxResolver = resolveMx,
): Promise<DomainSignals> {
  const [mx, ageDays, enrichmentRisk] = await Promise.all([
    mxResolver(domain, config),
    resolveAgeDays(domain, config, now),
    resolveEnrichmentRisk(domain, config),
  ]);
  return { mx, ageDays, enrichmentRisk };
}
