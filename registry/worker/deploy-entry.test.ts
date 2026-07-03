// deploy-entry live-seam pin (ADR-0047/0071, code-wiring B2b). entitlement-filter.test.ts drives the
// REAL verifier; handler-filter.test.ts drives the handler with a FAKE resolver — neither composes the
// two. This pins the LIVE edge: deploy-entry wiring the real licenseEntitlementResolver into
// createIndexHandler over the committed registry/index.json. The seam-trap guard (W2/B1 class): a
// regression dropping the optional `resolveEntitlements` option (TypeScript would NOT flag an omitted
// optional) flips the edge to the unfiltered full-catalog branch — leaking every paid/edition module
// to anonymous callers with public cache headers. Any one of the assertions below fails loudly if so.
import { describe, expect, test } from "bun:test";
import worker from "./deploy-entry";

const get = (init?: RequestInit): Response =>
  worker.fetch(new Request("https://registry.caisson.sh/", init));

const idsOf = async (res: Response): Promise<string[]> =>
  ((await res.json()) as { modules: { id: string }[] }).modules.map(
    (m) => m.id,
  );

describe("deploy-entry live composition root (B2b seam pin)", () => {
  test("an anonymous caller sees the OPEN base only — editions AND commercial base-kind are filtered out", async () => {
    const res = get();
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
    const res = get({
      headers: { authorization: "Bearer CAISSON-PRO-not-a-real-token" },
    });
    expect(res.status).toBe(200);
    expect(await idsOf(res)).not.toContain("@caisson/ai-kit");
  });
});

// A real PRODUCTION-signed local-ai license (same token as entitlement-filter.test.ts); its signed
// claims.licenseId is the deny-set key. Anonymous callers never see @caisson/local-ai; a valid holder
// does — UNLESS the operator revoked it (ADR-0225 R-4=B), which the wired R2 deny-set enforces here.
const PROD_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJtYWpvciI6MSwidGllciI6InBybyJ9JCCq8unU9ASs7NpgsOQSFpKl6Bti7J41yCKbLV8-1q0HbeUzZ-K7cfdaBge2_gyn38fKvEomzkH35GRQ0RbFBA";
const PROD_LICENSE_ID = "22222222-2222-4222-8222-222222222222";

// An injected R2-object double + a ctx that lets the test await the background deny-set refresh.
const envWith = (revokedLicenseIds: string[]) => ({
  REVOCATIONS: {
    get: async (_key: string) => ({
      json: async () => ({ revokedLicenseIds }),
    }),
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
    headers: { authorization: `Bearer ${PROD_TOKEN}` },
  });

// NOTE: the deny-set cache is a module singleton with a 60s TTL, so these two tests share it and MUST
// run in order — the first asserts the pristine (never-loaded, empty) state, the second performs the
// FIRST real load (fetchedAt = -Infinity → always fetches regardless of TTL) and asserts the revoke.
describe("deploy-entry edge revocation deny-set (ADR-0225 R-4=B)", () => {
  test("a valid holder is entitled before any deny-set loads (empty cache)", async () => {
    // One-arg fetch: no env, no ctx → no refresh kicked → deny-set stays empty → holder entitled.
    const res = worker.fetch(tokenReq());
    expect(res.status).toBe(200);
    expect(await idsOf(res)).toContain("@caisson/local-ai");
  });

  test("once the holder's license is revoked and the list loads, the edition is hidden", async () => {
    // First request kicks the background refresh (served stale/empty); settle it, then re-request.
    const load = drainCtx();
    worker.fetch(
      new Request("https://registry.caisson.sh/"),
      envWith([PROD_LICENSE_ID]),
      load.ctx,
    );
    await load.settle();

    const res = worker.fetch(
      tokenReq(),
      envWith([PROD_LICENSE_ID]),
      drainCtx().ctx,
    );
    expect(res.status).toBe(200);
    expect(await idsOf(res)).not.toContain("@caisson/local-ai"); // revoked → base-only
  });
});
