// Edge license-revocation deny-set (ADR-0225 R-4=B). The operator `purchase_revoke` mutation writes
// the FULL current set of revoked license ids to a fixed artifact (an R2 object in the live deploy);
// this module is the Worker's read side. The DB table `license_revocation` is the truth — this is its
// edge projection. Keyed on the SIGNED `claims.licenseId` (a UUID), because that is the ONLY per-license
// stable identifier the offline token verifiably carries (@caisson/license-verify claims.licenseId) —
// the token has no accountId, and the Worker never reads the DB.
//
// STRICT FAIL-OPEN is the binding invariant: a deny-set fetch/parse failure must NEVER break installs.
// Any transport or validation error keeps the PRIOR set (empty on first failure = nothing denied), so a
// missing binding / network blip / malformed artifact degrades to "nobody revoked", never a 500 and
// never a blocked buyer. The staleness cost of that choice is documented in docs/state/launch-runbook.md.
import { z } from "zod";

/**
 * The published deny-set artifact. `.strict()` — it crosses a trust boundary (fetched over the network
 * from R2 and parsed at the edge), so an unexpected shape fails closed to the fail-OPEN path (keep the
 * prior set) rather than being trusted. Ids are the signed `licenseId` UUIDs; the mutation republishes
 * the whole set on every revoke (low-volume operator action — no delta protocol).
 */
export const revocationArtifactSchema = z
  .object({
    revokedLicenseIds: z.array(z.string().uuid()).max(100_000),
  })
  .strict();

export type RevocationArtifact = z.infer<typeof revocationArtifactSchema>;

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * Injected fetch of the raw (unvalidated) artifact JSON. The live deploy supplies an R2-backed impl;
 * tests supply a double. It MAY reject or return garbage — the cache validates + fails open around it.
 */
export type DenySetFetcher = () => Promise<unknown>;

export interface RevocationDenySet {
  /** The current deny-set, served SYNCHRONOUSLY (the entitlement resolver is sync). */
  get(): ReadonlySet<string>;
  /**
   * Refresh from the fetcher iff the TTL has lapsed (stale-while-revalidate — callers kick this in the
   * background via `ctx.waitUntil` and never await it before serving). Concurrent calls share one
   * in-flight fetch. STRICT fail-open: any fetch/parse error keeps the prior set and never throws.
   * `now` is injectable for deterministic TTL tests.
   */
  maybeRefresh(now?: number): Promise<void>;
}

/**
 * Build a TTL-cached revocation deny-set over an injected fetcher. `ttlMs` bounds how stale the edge
 * view can be after a revoke publishes; on failure the cache backs off a full TTL (fetchedAt advances
 * whether the fetch succeeded or failed) so a broken artifact does not hammer the fetcher every request.
 */
export function makeRevocationDenySet(
  fetcher: DenySetFetcher,
  ttlMs: number,
): RevocationDenySet {
  let set: ReadonlySet<string> = EMPTY;
  let fetchedAt = Number.NEGATIVE_INFINITY; // force the first refresh
  let inflight: Promise<void> | null = null;

  return {
    get: (): ReadonlySet<string> => set,
    maybeRefresh(now = Date.now()): Promise<void> {
      if (now - fetchedAt < ttlMs) return Promise.resolve();
      if (inflight !== null) return inflight;
      const run = (async (): Promise<void> => {
        try {
          const parsed = revocationArtifactSchema.parse(await fetcher());
          set = new Set(parsed.revokedLicenseIds);
        } catch {
          // ponytail: STRICT fail-open (ADR-0225 R-4). Keep the prior set; never surface the error.
        } finally {
          fetchedAt = now; // back off one full TTL on success OR failure — don't retry every request.
          inflight = null;
        }
      })();
      inflight = run;
      return run;
    },
  };
}
