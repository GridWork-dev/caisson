// Runtime wiring for the ADR-0220 mutation surface: it assembles the injected `AdminMutationDeps`
// (@caisson/service-license owns the orchestration + dual-log; apps/admin owns the auth gate
// (ADR-0283), the DB seam, and this provisioning). Three pieces:
//   - db   — the admin `Transactor` (ADR-0141 `getAdminDb`); the connecting role must be able to
//            `SET ROLE admin_write` (mutations), `app` (the WORM chain's withTenant), and `admin`
//            (reads). Provisioned on the Railway PG at DEPLOY.
//   - worm — an `AuditChainStore` over an `ArtifactStore`; the tamper-evident half of the dual log.
//   - issue — the server-side `/issue` reissue proxy, authenticated with the DISTINCT admin-scoped
//            credential (`ADMIN_ISSUE_TOKEN`), never `LICENSE_ISSUE_TOKEN` and never the browser.
import { join } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import {
  AuditChainStore,
  LocalArtifactStore,
  S3ArtifactStore,
  type ArtifactStore,
} from "@caisson/audit-worm";
import { ConfigError, fetchWithTimeout } from "@caisson/kernel";
import {
  BUNDLE_IDS,
  loadRegistryIndexFromFile,
  RESERVED_MODULE_ENTITLEMENT_IDS,
  type RegistryIndex,
} from "@caisson/registry-schema";
import type {
  AdminMutationDeps,
  ReissueProxyResult,
} from "@caisson/service-license";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import { getAdminDb, readAdmin } from "./admin-db.ts";
import { adminAuditAnchorTrustFromEnv } from "./audit-anchor-trust.ts";
import { normalizeHttpsUrl } from "./https-url.ts";

/**
 * The WORM object store for the mutation service's audit chain (Fork AM-4 provisioning).
 *
 * CAISSON-18: env-gated — `CAISSON_ADMIN_WORM_BUCKET` set selects the compliance-grade
 * `S3ArtifactStore` (S3 Object-Lock, GOVERNANCE default; credentials/region via the standard AWS
 * env chain on the service), unset falls back to the dev `LocalArtifactStore` (write-once and
 * tamper-evident, but not time-locked). `AuditChainStore` is store-agnostic, so the deploy swap is
 * this gate plus a deploy-time env set — exported for the gate test.
 */
export function wormStore(): ArtifactStore {
  const bucket = process.env.CAISSON_ADMIN_WORM_BUCKET?.trim() ?? "";
  if (bucket.length > 0) {
    return new S3ArtifactStore({
      client: new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" }),
      bucket,
    });
  }
  if (process.env.NODE_ENV === "production") {
    throw new ConfigError(
      "CAISSON_ADMIN_WORM_BUCKET is required in production; local storage is not compliance-grade",
      { keys: ["CAISSON_ADMIN_WORM_BUCKET"] },
    );
  }
  const dir =
    process.env.CAISSON_ADMIN_WORM_DIR?.trim() ||
    join(process.cwd(), ".caisson-admin-worm");
  return new LocalArtifactStore(dir);
}

type LicenseProxyPath = "/issue" | "/admin/affiliate/mint";

async function licenseServiceProxy<T>(
  path: LicenseProxyPath,
  body: unknown,
  { timeoutMs }: { timeoutMs: number },
): Promise<T> {
  const base = normalizeHttpsUrl(process.env.CAISSON_LICENSE_ISSUE_URL);
  const token = process.env.ADMIN_ISSUE_TOKEN?.trim() ?? "";
  if (base === null || token === "") {
    throw new Error(
      path === "/issue"
        ? "license reissue is not configured (set CAISSON_LICENSE_ISSUE_URL + ADMIN_ISSUE_TOKEN)"
        : "affiliate minting is not configured (set CAISSON_LICENSE_ISSUE_URL + ADMIN_ISSUE_TOKEN)",
    );
  }
  const res = await fetchWithTimeout(
    `${base}${path}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    { timeoutMs },
  );
  if (!res.ok) {
    const operation = path === "/issue" ? "license /issue" : "affiliate mint";
    throw new Error(`${operation} proxy returned ${String(res.status)}`);
  }
  return (await res.json()) as T;
}

/** Server-side `/issue` reissue proxy (Fork AM-5). Throws on any non-2xx so a failed reissue writes
 *  no audit rows (the orchestration only logs after this resolves). The bearer never leaves here.
 *  `rotate: true` (the rotation lever) rides through to `/issue`'s forced re-mint; omitted, the
 *  JSON body carries no key and the re-serve semantics are byte-identical to before. */
async function issueProxy(req: {
  accountId: string;
  tier: string;
  major: number;
  expiry: string | null;
  rotate?: boolean;
}): Promise<ReissueProxyResult> {
  const body = await licenseServiceProxy<{
    token?: unknown;
    licenseId?: unknown;
  }>("/issue", req, { timeoutMs: 10_000 });
  if (typeof body.token !== "string" || typeof body.licenseId !== "string") {
    throw new Error("license /issue proxy returned an unexpected body");
  }
  return { token: body.token, licenseId: body.licenseId };
}

/** Server-side affiliate-mint proxy (ADR-0315/0320) — the exact `issueProxy` shape, pointed at the
 *  license service's `POST /admin/affiliate/mint`. That endpoint holds `PADDLE_API_KEY` and calls
 *  the billing driver's `createDiscount`, so this admin app never carries the Paddle credential.
 *  Reuses the SAME base + admin token the reissue proxy uses (`CAISSON_LICENSE_ISSUE_URL` +
 *  `ADMIN_ISSUE_TOKEN`); no new env. Throws on any non-2xx so a failed mint writes no affiliate_code
 *  row (the orchestrator only registers after this resolves). */
async function mintDiscountProxy(input: {
  code: string;
  description: string;
}): Promise<{ discountId: string; code: string }> {
  const body = await licenseServiceProxy<{
    discountId?: unknown;
    code?: unknown;
  }>("/admin/affiliate/mint", input, { timeoutMs: 15_000 });
  if (typeof body.discountId !== "string" || typeof body.code !== "string") {
    throw new Error("affiliate mint proxy returned an unexpected body");
  }
  return { discountId: body.discountId, code: body.code };
}

/**
 * G38 (buyer-lifecycle audit 2026-07-07) — the deny-set PUT below is last-write-wins: two
 * concurrent revokes (different accounts) each capture their OWN full cross-tenant snapshot at
 * their commit and PUT it post-commit; out-of-order network completion can let the earlier/
 * smaller snapshot land LAST, transiently un-denying the second account at the edge until the
 * next revoke republishes. Self-healing (the DB `license_revocation` table stays truth) and
 * operator-only/low-volume, so this is a real but bounded fix, not a no-op: a MODULE-LEVEL chain
 * serializes every publish attempt in ENQUEUE order — each call awaits the previous one's settle
 * (success OR failure) before firing its own PUT — so two revokes handled by THIS admin process
 * can never complete out of order over the network. It does NOT close the CROSS-PROCESS case (a
 * second admin instance/pod racing this one): the PUT target is an opaque operator-provided URL
 * (a pre-signed R2 URL or a small authed shim) with no guaranteed ETag/If-Match to build a real
 * CAS on top of. Upgrade path: real conditional writes if/when the operator's R2 target exposes
 * one, or a periodic full-republish cron as a cheap cross-process backstop.
 */
let publishChain: Promise<void> = Promise.resolve();

/**
 * Chain `fn` onto the shared publish order. `publishChain` is NEVER allowed to become a rejected
 * promise — a rejection would make every LATER `.then()` skip its fulfillment handler entirely,
 * silently breaking every future publish for the rest of the process's life.
 *
 * Exported for `admin-mutations-runtime.test.ts` (G38) — the generic ordering/never-wedges
 * property is what actually needs pinning, not a real R2 PUT round trip.
 */
export function serializePublish(fn: () => Promise<void>): Promise<void> {
  const attempt = publishChain.then(fn);
  publishChain = attempt.catch(() => undefined);
  return attempt;
}

/**
 * The edge deny-set publisher (ADR-0225 R-4 = B) — the WRITE side of the registry Worker's R2 read
 * (`registry/worker/deploy-entry.ts` reads `revocations/deny-set.json`). Called post-commit + best-
 * effort by `revokePurchaseAdmin` with the FULL cross-tenant set of revoked `license_id`s; it PUTs
 * `{ revokedLicenseIds }` (the exact shape the Worker's `revocationArtifactSchema` validates).
 *
 * OPERATOR-GATED: returns `undefined` (→ the mutation reports `edgePublish: "skipped"`, the DB
 * `license_revocation` table stays the truth, the Worker fails OPEN) until `CAISSON_REVOCATIONS_PUT_URL`
 * is set on `caisson-admin` to an authorized PUT target for that object. The real R2 bucket/binding is
 * provisioned at DEPLOY, not here (docs/ops/launch-runbook.md §8).
 *
 * // ponytail: a `fetchWithTimeout` PUT to an operator-provided URL — a pre-signed R2 URL or a small
 * // authed shim in front of the bucket. Keeps aws-sdk / SigV4 OUT of the admin blast radius; swap for
 * // a direct R2 S3 PutObject if the operator prefers a long-lived credential over a managed URL.
 */
export function denySetPublisher(): AdminMutationDeps["publishDenySet"] {
  const configuredUrl = process.env.CAISSON_REVOCATIONS_PUT_URL?.trim() ?? "";
  if (configuredUrl === "") return undefined;
  const url = normalizeHttpsUrl(configuredUrl);
  if (url === null) {
    throw new ConfigError("CAISSON_REVOCATIONS_PUT_URL must be an HTTPS URL", {
      keys: ["CAISSON_REVOCATIONS_PUT_URL"],
    });
  }
  const token = process.env.CAISSON_REVOCATIONS_PUT_TOKEN?.trim() ?? "";
  return (revokedLicenseIds: string[]): Promise<void> =>
    serializePublish(async () => {
      const res = await fetchWithTimeout(
        url,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...(token === "" ? {} : { authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ revokedLicenseIds }),
        },
        { timeoutMs: 10_000 },
      );
      if (!res.ok) {
        throw new Error(`deny-set publish returned ${String(res.status)}`);
      }
    });
}

let cachedIndex: RegistryIndex | undefined;

/**
 * The built registry index (ADR-0071/0278 F1), loaded once and cached. The comp-grant boundary
 * (`grantEntitlementAdmin`) reads it to reject an unresolvable entitlement id BEFORE any row is
 * written. `CAISSON_REGISTRY_INDEX_PATH` — set by `apps/admin/Dockerfile`'s runtime ENV to
 * `/app/registry/index.json` — is read FIRST and is what production actually uses: Next's generated
 * standalone `server.js` calls `process.chdir(__dirname)` on boot (cwd becomes `/app/apps/admin`),
 * so the `process.cwd()`-relative fallback below resolves to a path that does not exist in the
 * runtime image and only serves local `bun dev`/tests run from the repo root. This is NOT the same
 * mechanism `services/license/src/server.ts` uses for `/issue`'s own pre-sign validation — that
 * service resolves the index via `import.meta.dir`-relative path math over its own unbundled
 * source, which is cwd-independent by construction and has no chdir footgun; it is not a precedent
 * for cwd-relative resolution here.
 */
export function registryIndex(): RegistryIndex {
  if (cachedIndex === undefined) {
    const path =
      process.env.CAISSON_REGISTRY_INDEX_PATH?.trim() ||
      join(process.cwd(), "registry", "index.json");
    cachedIndex = loadRegistryIndexFromFile(path);
  }
  return cachedIndex;
}

/**
 * The full set of ids the grant-entitlement mutation would actually accept (G42) — the SAME
 * vocabulary `assertGrantableEntitlementIds` validates a typed id against (bundle ids, indexed
 * module ids, reserved sold-not-yet-published ids), so the datalist can never suggest an id the
 * mutation would then reject. Legacy aliases are deliberately excluded — the datalist should steer
 * the operator toward the CANONICAL id, not a deprecated one (a typed alias still resolves fine;
 * this only affects what's suggested). Sorted for a stable, scannable dropdown.
 */
export function grantableEntitlementIds(): string[] {
  const index = registryIndex();
  const ids = new Set<string>([
    ...BUNDLE_IDS,
    ...RESERVED_MODULE_ENTITLEMENT_IDS,
    ...index.modules.map((m) => m.id),
  ]);
  return [...ids].sort();
}

export async function getAdminMutationDeps(): Promise<AdminMutationDeps> {
  const db = await getAdminDb();
  const anchorTrust = adminAuditAnchorTrustFromEnv();
  return {
    db,
    worm: new AuditChainStore({
      db,
      store: wormStore(),
      ...(anchorTrust === null ? {} : { signer: anchorTrust.signer }),
    }),
    issue: issueProxy,
    mintDiscount: mintDiscountProxy,
    publishDenySet: denySetPublisher(),
    // Lazy getter, not a resolved value (ADR-0278 I-1): a missing/corrupt baked index must not 500
    // every mutation type — only `grantEntitlementAdmin` ever reads `deps.index`, so a broken index
    // file surfaces there (the un-bricking lever: revoke/adjust/reissue/purchase-revoke stay live).
    get index(): RegistryIndex {
      return registryIndex();
    },
  };
}

export interface LicenseForReissue {
  tier: string;
  /** ISO-8601 with offset, or null (perpetual) — normalized for the `/issue` body's datetime schema. */
  expiry: string | null;
  /** The stored grant's CURRENT licenseId — the key a rotation denies at the edge. */
  licenseId: string;
}

/**
 * Read the stored license grant's tier/expiry/licenseId for (account, major) via the ADR-0141
 * admin READ role — reissue v1 re-serves an EXISTING token only, so a route 404s when this is
 * null. tier/expiry are supplied to `/issue` (which requires them to parse) and then ignored by
 * its idempotent re-serve. The first-mint route (ADR-0292) reads this too, INVERTED: a non-null
 * result means a grant already exists for that (account, major), so first-mint is the wrong lever
 * — reissue is. The rotate route reads `licenseId` as the old key its deny-set insert targets.
 */
export async function readLicenseForReissue(
  accountId: string,
  major: number,
): Promise<LicenseForReissue | null> {
  return readAdmin(async (tx: TenantExecutor) => {
    const r = await tx.query<{
      tier: string;
      expiry: unknown;
      license_id: string;
    }>(
      `SELECT tier, expiry, license_id FROM license_grant WHERE account_id = $1 AND major = $2`,
      [accountId, major],
    );
    const row = r.rows[0];
    if (row === undefined) return null;
    const expiry =
      row.expiry === null || row.expiry === undefined
        ? null
        : new Date(row.expiry as string | number | Date).toISOString();
    return { tier: row.tier, expiry, licenseId: row.license_id };
  });
}

/**
 * Read an account's ACTIVE entitlement ids via the ADR-0141 admin READ role. Two callers: the
 * first-mint route (ADR-0292) — an account with none is the wrong target for a rescue mint, there
 * is nothing to license — and the resend-email route (G40), which needs the current set to build
 * the resend notice's line items.
 */
export async function readActiveEntitlementIds(
  accountId: string,
): Promise<string[]> {
  return readAdmin(async (tx: TenantExecutor) => {
    const r = await tx.query<{ entitlement_id: string }>(
      `SELECT entitlement_id FROM entitlement_grant WHERE account_id = $1 AND status = 'active' ORDER BY entitlement_id`,
      [accountId],
    );
    return r.rows.map((row) => row.entitlement_id);
  });
}
