// Runtime wiring for the ADR-0220 mutation surface: it assembles the injected `AdminMutationDeps`
// (@caisson/service-license owns the orchestration + dual-log; apps/admin owns the CF-Access gate,
// the DB seam, and this provisioning). Three pieces:
//   - db   — the admin `Transactor` (ADR-0141 `getAdminDb`); the connecting role must be able to
//            `SET ROLE admin_write` (mutations), `app` (the WORM chain's withTenant), and `admin`
//            (reads). Provisioned on the Railway PG at DEPLOY.
//   - worm — an `AuditChainStore` over an `ArtifactStore`; the tamper-evident half of the dual log.
//   - issue — the server-side `/issue` reissue proxy, authenticated with the DISTINCT admin-scoped
//            credential (`ADMIN_ISSUE_TOKEN`), never `LICENSE_ISSUE_TOKEN` and never the browser.
import { join } from "node:path";
import { AuditChainStore, LocalArtifactStore } from "@caisson/audit-worm";
import { fetchWithTimeout } from "@caisson/kernel";
import type {
  AdminMutationDeps,
  ReissueProxyResult,
} from "@caisson/service-license";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { getAdminDb, readAdmin } from "./admin-db.ts";

/**
 * The WORM object store for the mutation service's audit chain (Fork AM-4 provisioning).
 *
 * // ponytail: LocalArtifactStore is write-once (tamper-evident — the substantive property for an
 * // operator log), but NOT time-locked, so it is not court-admissible. Swap for `S3ArtifactStore`
 * // (Object-Lock, @caisson/audit-worm) at DEPLOY when compliance-grade retention is required —
 * // AuditChainStore is store-agnostic, so it is an env-gated one-liner, no code change here.
 */
function wormStore(): LocalArtifactStore {
  const dir =
    process.env.CAISSON_ADMIN_WORM_DIR?.trim() ||
    join(process.cwd(), ".caisson-admin-worm");
  return new LocalArtifactStore(dir);
}

/** Server-side `/issue` reissue proxy (Fork AM-5). Throws on any non-2xx so a failed reissue writes
 *  no audit rows (the orchestration only logs after this resolves). The bearer never leaves here. */
async function issueProxy(req: {
  accountId: string;
  tier: string;
  major: number;
  expiry: string | null;
}): Promise<ReissueProxyResult> {
  const base = process.env.CAISSON_LICENSE_ISSUE_URL?.trim() ?? "";
  const token = process.env.ADMIN_ISSUE_TOKEN?.trim() ?? "";
  if (base === "" || token === "") {
    throw new Error(
      "license reissue is not configured (set CAISSON_LICENSE_ISSUE_URL + ADMIN_ISSUE_TOKEN)",
    );
  }
  const res = await fetchWithTimeout(
    `${base.replace(/\/$/, "")}/issue`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
    },
    { timeoutMs: 10_000 },
  );
  if (!res.ok) {
    throw new Error(`license /issue proxy returned ${String(res.status)}`);
  }
  const body = (await res.json()) as { token?: unknown; licenseId?: unknown };
  if (typeof body.token !== "string" || typeof body.licenseId !== "string") {
    throw new Error("license /issue proxy returned an unexpected body");
  }
  return { token: body.token, licenseId: body.licenseId };
}

export async function getAdminMutationDeps(): Promise<AdminMutationDeps> {
  const db = await getAdminDb();
  return {
    db,
    worm: new AuditChainStore({ db, store: wormStore() }),
    issue: issueProxy,
  };
}

export interface LicenseForReissue {
  tier: string;
  /** ISO-8601 with offset, or null (perpetual) — normalized for the `/issue` body's datetime schema. */
  expiry: string | null;
}

/**
 * Read the stored license grant's tier/expiry for (account, major) via the ADR-0141 admin READ role
 * — reissue v1 re-serves an EXISTING token only, so a route 404s when this is null. tier/expiry are
 * supplied to `/issue` (which requires them to parse) and then ignored by its idempotent re-serve.
 */
export async function readLicenseForReissue(
  accountId: string,
  major: number,
): Promise<LicenseForReissue | null> {
  return readAdmin(async (tx: TenantExecutor) => {
    const r = await tx.query<{ tier: string; expiry: unknown }>(
      `SELECT tier, expiry FROM license_grant WHERE account_id = $1 AND major = $2`,
      [accountId, major],
    );
    const row = r.rows[0];
    if (row === undefined) return null;
    const expiry =
      row.expiry === null || row.expiry === undefined
        ? null
        : new Date(row.expiry as string | number | Date).toISOString();
    return { tier: row.tier, expiry };
  });
}
