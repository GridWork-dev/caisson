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
    // Commercial base-kind modules (editions[]===[] but LicenseRef-Caisson-Commercial) are NOT free
    // base — 404/invisible to an anonymous caller. Regression pin for the CLOSED leak (ADR-0094/0097):
    // field-crypto (à-la-carte primitive) + cli (bundle-only commercial tooling) were served free.
    expect(ids).not.toContain("@caisson/field-crypto");
    expect(ids).not.toContain("@caisson/cli");
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
