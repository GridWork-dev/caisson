// deploy-entry live-seam pin (ADR-0047/0071, code-wiring B2b). entitlement-filter.test.ts drives the
// REAL verifier; handler-filter.test.ts drives the handler with a FAKE resolver — neither composes the
// two. This pins the LIVE edge: deploy-entry wiring the real licenseEntitlementResolver into
// createIndexHandler over the committed registry/index.json. The seam-trap guard (W2/B1 class): a
// regression dropping the optional `resolveEntitlements` option (TypeScript would NOT flag an omitted
// optional) flips the edge to the unfiltered full-catalog branch — leaking every paid/edition module
// to anonymous callers with public cache headers. Any one of the assertions below fails loudly if so.
import { describe, expect, test } from "bun:test";
import worker, { buildLicenseEntitlementResolver } from "./deploy-entry";
import { devVerify, mintDevToken } from "./dev-license";

// worker.fetch is genuinely async (CAISSON-55 added a real per-request rate-limit binding call in the
// catalog branch — see deploy-entry.ts), so this pre-existing helper now awaits it. `env` defaults to
// `{}` (no RATE_LIMIT_CATALOG binding), which fails open per rate-limit.ts — every test below except
// the dedicated rate-limit block runs unthrottled, unchanged from before.
const get = (init?: RequestInit): Promise<Response> =>
  worker.fetch(new Request("https://registry.caisson.sh/", init));

const idsOf = async (res: Response): Promise<string[]> =>
  ((await res.json()) as { modules: { id: string }[] }).modules.map(
    (m) => m.id,
  );

describe("deploy-entry live composition root (B2b seam pin)", () => {
  test("an anonymous caller sees the OPEN base only — editions AND commercial base-kind are filtered out", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const ids = await idsOf(res);
    expect(ids).not.toContain("@caisson/ai-kit"); // edition-scoped → must never leak to community
    expect(ids).toContain("@caisson/kernel"); // an OPEN Apache-2.0 base module is still served free
    // The ships-with-generator tooling is OPEN Apache-2.0 Base (ADR-0136) — served free, same as the
    // rest of the open substrate: every buyer's generated repo embeds cli·migrate·license-verify.
    expect(ids).toContain("@caisson/cli");
    // Commercial base-kind modules (editions[]===[] but LicenseRef-Caisson-Commercial) are NOT free
    // base — 404/invisible to an anonymous caller. Regression pin for the CLOSED leak (ADR-0094/0097):
    // field-crypto (à-la-carte primitive) was served free before the license-keyed floor closed it.
    expect(ids).not.toContain("@caisson/field-crypto");
    // The per-caller (non-cacheable) headers prove the resolver is actually wired — not the
    // public-catalog branch that a dropped option would silently fall back to.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Authorization");
  });

  test("a forged Bearer license still fails SAFE to base — the edition module stays hidden", async () => {
    const res = await get({
      headers: { authorization: "Bearer CAISSON-PRO-not-a-real-token" },
    });
    expect(res.status).toBe(200);
    expect(await idsOf(res)).not.toContain("@caisson/ai-kit");
  });
});

// A RUNTIME-MINTED dev-key local-ai license (documented KAT seed; NO committed prod token — a real
// entitlement token is itself the leak, the P0 incident class); its signed claims.licenseId is the
// deny-set key. The shipped worker REJECTS this token (bake pin below); the deny-set flow is driven
// through the exported buildLicenseEntitlementResolver — the SAME factory (and the same live
// denySet.get) the shipped resolver is built from, with the dev verifier injected.
const DEV_LICENSE_ID = "22222222-2222-4222-8222-222222222222";
const DEV_TOKEN = await mintDevToken({
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: DEV_LICENSE_ID,
  major: 1,
  tier: "pro",
});

// An injected R2-object double + a ctx that lets the test await the background deny-set refresh.
const envWith = (revokedLicenseIds: string[]) => ({
  REVOCATIONS: {
    get: async (_key: string) => ({
      json: async () => ({ revokedLicenseIds }),
    }),
    // The publisher shim (revocations-put.ts) puts the write half on the binding type; these
    // read-path tests never PUT.
    put: (_key: string, _value: string) => Promise.resolve(undefined),
  },
});
const drainCtx = () => {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => void pending.push(p) },
    settle: () => Promise.all(pending),
  };
};

const tokenReq = () =>
  new Request("https://registry.caisson.sh/", {
    headers: { authorization: `Bearer ${DEV_TOKEN}` },
  });

// NOTE: the deny-set cache is a module singleton with a 60s TTL, so these two tests share it and MUST
// run in order — the first asserts the pristine (never-loaded, empty) state, the second performs the
// FIRST real load (fetchedAt = -Infinity → always fetches regardless of TTL) and asserts the revoke.
describe("deploy-entry edge revocation deny-set (ADR-0225 R-4=B)", () => {
  test("the SHIPPED worker rejects a dev-signed token (the production-key bake is wired live)", async () => {
    // The bake pin, proven negatively: if deploy-entry ever wired a non-baked verifier, this
    // dev-signed token would be accepted and @caisson/local-ai would leak into the response.
    const res = await worker.fetch(tokenReq());
    expect(res.status).toBe(200);
    expect(await idsOf(res)).not.toContain("@caisson/local-ai");
  });

  test("a valid holder is entitled before any deny-set loads (empty cache)", () => {
    // The exported factory composes the LIVE denySet.get with the dev verifier — same wiring as
    // the shipped resolver, minus the baked key a committed fixture would require.
    const resolve = buildLicenseEntitlementResolver(devVerify);
    expect(resolve(tokenReq())).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: {},
      entitledSince: {},
    });
  });

  test("once the holder's license is revoked and the list loads, the edition is hidden", async () => {
    // First request kicks the background refresh (served stale/empty); settle it, then re-resolve.
    const load = drainCtx();
    worker.fetch(
      new Request("https://registry.caisson.sh/"),
      envWith([DEV_LICENSE_ID]),
      load.ctx,
    );
    await load.settle();

    const resolve = buildLicenseEntitlementResolver(devVerify);
    expect(resolve(tokenReq())).toBeNull(); // revoked → community (base-only view)
  });
});

// Catalog-class rate limit (CAISSON-55): the check wired into deploy-entry's fetch(), BEFORE the
// handler(request) call that runs the entitlement gate. Injected fake binding — the real Cloudflare
// Rate Limiting binding is a Workers-runtime-only API unavailable under `bun test` (rate-limit.test.ts
// unit-tests the shared helper itself; this pins the LIVE wiring).
describe("deploy-entry catalog rate limit (CAISSON-55)", () => {
  test("no binding provisioned (pre-DEPLOY) — every request served normally", async () => {
    const res = await worker.fetch(new Request("https://registry.caisson.sh/"));
    expect(res.status).toBe(200);
  });

  test("a binding that denies (bucket empty) → 429, never reaches the entitlement gate", async () => {
    const res = await worker.fetch(
      new Request("https://registry.caisson.sh/"),
      {
        RATE_LIMIT_CATALOG: { limit: async () => ({ success: false }) },
      },
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  test("a binding that throws (limiter outage) fails OPEN — served normally, not a 500", async () => {
    const res = await worker.fetch(
      new Request("https://registry.caisson.sh/"),
      {
        RATE_LIMIT_CATALOG: {
          limit: async () => {
            throw new Error("rate limiting API unavailable");
          },
        },
      },
    );
    expect(res.status).toBe(200);
  });

  test("the catalog binding is independent of the npm surface's — a catalog deny never blocks /-/ping", async () => {
    const denyEverything = { limit: async () => ({ success: false }) };
    const res = await worker.fetch(
      new Request("https://registry.caisson.sh/-/ping"),
      { RATE_LIMIT_CATALOG: denyEverything },
    );
    // /-/ping is dispatched to the npm surface (isNpmPath), which only ever consults
    // RATE_LIMIT_NPM_PACKUMENT/RATE_LIMIT_TARBALL — the catalog binding above must have zero effect.
    expect(res.status).toBe(200);
  });
});
