// Edge revocation deny-set cache (ADR-0225 R-4=B). Proves the load/deny path, the STRICT fail-open
// invariant (a fetch OR parse failure denies NOBODY — installs never break), and TTL caching. All
// injected doubles: no R2, no network, no verifier.
import { describe, expect, test } from "bun:test";
import { makeRevocationDenySet } from "./revocation-list";

const ID_A = "22222222-2222-4222-8222-222222222222";
const ID_B = "33333333-3333-4333-8333-333333333333";
const TTL = 60_000;

describe("makeRevocationDenySet (ADR-0225 R-4=B)", () => {
  test("empty until loaded; a revoked id is denied once the list loads", async () => {
    const deny = makeRevocationDenySet(
      async () => ({ revokedLicenseIds: [ID_A] }),
      TTL,
    );
    expect(deny.get().size).toBe(0); // stale-while-revalidate: empty before the first refresh
    await deny.maybeRefresh(0);
    expect(deny.get().has(ID_A)).toBe(true);
    expect(deny.get().has(ID_B)).toBe(false); // an unrevoked id is unaffected
  });

  test("fetch failure fails OPEN — deny-set stays empty, never throws", async () => {
    const deny = makeRevocationDenySet(async () => {
      throw new Error("R2 unavailable");
    }, TTL);
    await deny.maybeRefresh(0); // must not reject
    expect(deny.get().size).toBe(0); // nothing denied → installs never break
  });

  test("malformed artifact fails OPEN and keeps the PRIOR set", async () => {
    let payload: unknown = { revokedLicenseIds: [ID_A] };
    const deny = makeRevocationDenySet(async () => payload, TTL);
    await deny.maybeRefresh(0);
    expect(deny.get().has(ID_A)).toBe(true);
    // Next refresh returns garbage (non-uuid + unknown key → strict-parse throws) → keep the good set.
    payload = { revokedLicenseIds: ["not-a-uuid"], extra: 1 };
    await deny.maybeRefresh(TTL);
    expect(deny.get().has(ID_A)).toBe(true);
  });

  test("TTL respected — no refetch inside the window, refetch after it", async () => {
    let calls = 0;
    const deny = makeRevocationDenySet(async () => {
      calls += 1;
      return { revokedLicenseIds: [] };
    }, TTL);
    await deny.maybeRefresh(0);
    expect(calls).toBe(1);
    await deny.maybeRefresh(TTL - 1); // inside the window → no fetch
    expect(calls).toBe(1);
    await deny.maybeRefresh(TTL); // window elapsed → refetch
    expect(calls).toBe(2);
  });
});
