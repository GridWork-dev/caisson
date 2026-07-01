// Registry Worker entitlement filtering (ADR-0008/0047/0071, code-wiring B2). Drives createIndexHandler
// with an INJECTED fake resolver (no crypto here — the Ed25519 verify path is covered in
// entitlement-filter.test.ts). Asserts: a licensed caller sees base ∪ their edition; community sees
// base only; the bundle sees everything; an unentitled known module is 404 (invisible, ADR-0076); a
// stale/forged entitlement fails SAFE to base (never 500); filtered responses are non-cacheable
// (private, no-store + Vary); and with NO resolver the full catalog is served unfiltered (Wave-0).
import { describe, expect, test } from "bun:test";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "../schema/registry-index";
import { licenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";

// A real PRODUCTION-signed license (minted offline with CAISSON_LICENSE_SIGNING_KEY; public-safe) —
// signs entitlements ["local-ai"], pro, non-expiring. The verifier bakes the production public key
// (ADR-0110). Keep in sync with the baked key in license-verify/src/verify.ts. Drives the REAL
// verifier→expand→filter end to end.
const PROD_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJtYWpvciI6MSwidGllciI6InBybyJ9JCCq8unU9ASs7NpgsOQSFpKl6Bti7J41yCKbLV8-1q0HbeUzZ-K7cfdaBge2_gyn38fKvEomzkH35GRQ0RbFBA";

function entry(
  id: string,
  editions: readonly ("compliance" | "ai-kit" | "local-ai" | "agent-dev")[],
): RegistryIndex["modules"][number] {
  const open = editions.length === 0;
  return {
    id,
    latest: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        publishedAt: "2026-01-01T00:00:00.000Z",
        gateAttestation: "ci-run-1@deadbeef",
        manifest: {
          id,
          version: "1.0.0",
          kind: "base",
          tier: open ? "oss" : "paid",
          license: open ? "Apache-2.0" : "LicenseRef-Caisson-Commercial",
          priceCents: open ? null : 4900,
          editions: [...editions],
          description: id,
        },
      },
    ],
  } as RegistryIndex["modules"][number];
}

const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    entry("@caisson/kernel", []), // base — free, always served
    entry("@caisson/compliance", ["compliance"]),
    entry("@caisson/ai-kit", ["ai-kit"]),
  ],
});

/** A handler whose injected resolver returns a FIXED purchased-id set (or null = community). */
const handlerFor = (purchased: readonly string[] | null) =>
  createIndexHandler(index, { resolveEntitlements: () => purchased });

const req = (path: string) => new Request(`https://registry.caisson.sh${path}`);

const ids = async (res: Response): Promise<string[]> => {
  const body = (await res.json()) as { modules: { id: string }[] };
  return body.modules.map((m) => m.id).sort();
};

describe("Worker entitlement filtering (ADR-0071)", () => {
  test("a licensed caller sees base ∪ their edition (GET /)", async () => {
    const res = handlerFor(["compliance"])(req("/"));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["@caisson/compliance", "@caisson/kernel"]);
  });

  test("community (null) sees the free base only", async () => {
    expect(await ids(handlerFor(null)(req("/")))).toEqual(["@caisson/kernel"]);
  });

  test("the bundle sees every module", async () => {
    expect(await ids(handlerFor(["bundle"])(req("/")))).toEqual([
      "@caisson/ai-kit",
      "@caisson/compliance",
      "@caisson/kernel",
    ]);
  });

  test("GET /index.json is filtered to the entitled modules", async () => {
    const res = handlerFor(["compliance"])(req("/index.json"));
    const body = (await res.json()) as { modules: { id: string }[] };
    expect(body.modules.map((m) => m.id).sort()).toEqual([
      "@caisson/compliance",
      "@caisson/kernel",
    ]);
  });

  test("a base module is served to community (GET /modules/:id)", async () => {
    const res = handlerFor(null)(req("/modules/@caisson%2Fkernel"));
    expect(res.status).toBe(200);
  });

  test("a known-but-unentitled module is 404 — invisible (ADR-0076)", async () => {
    // ai-kit IS in the index, but a compliance-only buyer is not entitled → indistinguishable from
    // an unknown id. Never leak that an unentitled module exists.
    const res = handlerFor(["compliance"])(req("/modules/@caisson%2Fai-kit"));
    expect(res.status).toBe(404);
  });

  test("an entitled edition module is served (GET /modules/:id)", async () => {
    const res = handlerFor(["compliance"])(
      req("/modules/@caisson%2Fcompliance"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("@caisson/compliance");
  });

  test("a stale/forged entitlement fails SAFE to base (never 500)", async () => {
    // expandEntitlements throws on an unknown purchased id; the handler must degrade to base-only.
    const res = handlerFor(["not-an-edition"])(req("/"));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["@caisson/kernel"]);
  });

  test("a THROWING resolver fails SAFE to base (never 500)", async () => {
    // The resolver runs inside the fail-safe boundary — even a buggy injected resolver degrades to
    // the community (base-only) view rather than 500ing the edge (ADR-0010/0047 fail-safe).
    const handler = createIndexHandler(index, {
      resolveEntitlements: () => {
        throw new Error("boom");
      },
    });
    const res = handler(req("/"));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["@caisson/kernel"]);
  });

  test("filtered responses are non-cacheable (private, no-store + Vary)", () => {
    const res = handlerFor(["compliance"])(req("/"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Authorization");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("with NO resolver the full catalog is served + publicly cacheable (Wave-0 contract)", async () => {
    const unfiltered = createIndexHandler(index); // no options
    const res = unfiltered(req("/"));
    expect(await ids(res)).toEqual([
      "@caisson/ai-kit",
      "@caisson/compliance",
      "@caisson/kernel",
    ]);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    expect(res.headers.get("vary")).toBeNull();
  });

  test("a non-GET method is still 405 under filtering", () => {
    const res = handlerFor(["compliance"])(
      new Request("https://registry.caisson.sh/index.json", { method: "POST" }),
    );
    expect(res.status).toBe(405);
  });
});

describe("Worker filtering composed with the REAL license verifier (end-to-end seam)", () => {
  // An index that actually contains a local-ai member, so the prod token's signed entitlement
  // (["local-ai"]) expands to a non-empty member set — proving verify → expand → filter end to end.
  const localAiIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []), // base
      entry("@caisson/local-store", ["local-ai"]),
      entry("@caisson/ai-kit", ["ai-kit"]),
    ],
  });
  const realHandler = createIndexHandler(localAiIndex, {
    resolveEntitlements: licenseEntitlementResolver,
  });

  test("a real production-signed license sees base ∪ its entitled edition (local-ai), not other editions", async () => {
    const res = realHandler(
      new Request("https://registry.caisson.sh/", {
        headers: { authorization: `Bearer ${PROD_TOKEN}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["@caisson/kernel", "@caisson/local-store"]);
  });

  test("no license → base only, even when editions exist", async () => {
    const res = realHandler(new Request("https://registry.caisson.sh/"));
    expect(await ids(res)).toEqual(["@caisson/kernel"]);
  });
});

describe("Worker gates COMMERCIAL base-kind modules (ADR-0094/0097 open-core, Q1 lock)", () => {
  // A commercial module scoped to NO edition (editions[]===[] BUT LicenseRef-Caisson-Commercial) — the
  // à-la-carte compliance/AI primitives (field-crypto, ai-meter, …) + bundle-only tooling (cli, migrate,
  // license-verify, pricebook). Under the OLD "editions[]===[] ⇒ free base" rule these LEAKED to
  // anonymous callers; the license-keyed free-view floor now gates them behind their own Ed25519
  // entitlement. The `entry()` helper above hard-ties open↔editions[]===[], so a commercial base module
  // needs its own explicit builder.
  // Returns a plain literal (not the cast `RegistryIndex["modules"][number]` the `entry()` helper uses:
  // its ternaries widen tier/license to the full unions, giving the cast enough overlap; these FIXED
  // commercial literals do not). `loadRegistryIndex` takes `unknown` and parse-validates, so no cast is
  // needed or wanted here.
  const commercialBase = (id: string) => ({
    id,
    latest: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        publishedAt: "2026-01-01T00:00:00.000Z",
        gateAttestation: "ci-run-1@deadbeef",
        manifest: {
          id,
          version: "1.0.0",
          kind: "base",
          tier: "paid",
          license: "LicenseRef-Caisson-Commercial",
          priceCents: 4900,
          editions: [] as const,
          description: id,
        },
      },
    ],
  });

  const gatedIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []), // OPEN Apache-2.0 base — free-view
      commercialBase("@caisson/field-crypto"), // commercial base-kind — gated
      entry("@caisson/ai-kit", ["ai-kit"]), // edition — gated
    ],
  });
  const gatedHandlerFor = (purchased: readonly string[] | null) =>
    createIndexHandler(gatedIndex, { resolveEntitlements: () => purchased });

  test("(a) unauthenticated does NOT receive a paid base-kind module (was served, now gated)", async () => {
    const listed = await ids(gatedHandlerFor(null)(req("/")));
    expect(listed).toEqual(["@caisson/kernel"]); // ONLY the open base
    expect(listed).not.toContain("@caisson/field-crypto");
    // invisible at the item route too (404, indistinguishable from unknown — ADR-0076).
    expect(
      gatedHandlerFor(null)(req("/modules/@caisson%2Ffield-crypto")).status,
    ).toBe(404);
  });

  test("(b) an entitled (bare-slug) license DOES receive the commercial base-kind module", async () => {
    const res = gatedHandlerFor(["field-crypto"])(req("/"));
    expect(await ids(res)).toEqual([
      "@caisson/field-crypto",
      "@caisson/kernel",
    ]);
    expect(
      gatedHandlerFor(["field-crypto"])(req("/modules/@caisson%2Ffield-crypto"))
        .status,
    ).toBe(200);
  });

  test("(c) the OPEN Apache-2.0 base is still served unauthenticated", async () => {
    expect(
      gatedHandlerFor(null)(req("/modules/@caisson%2Fkernel")).status,
    ).toBe(200);
  });

  test("(d) a malformed/unknown entitlement fails SAFE to the OPEN base only — zero paid leak", async () => {
    const res = gatedHandlerFor(["not-a-real-entitlement"])(req("/"));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(["@caisson/kernel"]); // never field-crypto on error
  });

  test("(e) the bundle still receives the commercial base-kind module (gated, not removed)", async () => {
    expect(await ids(gatedHandlerFor(["bundle"])(req("/")))).toEqual([
      "@caisson/ai-kit",
      "@caisson/field-crypto",
      "@caisson/kernel",
    ]);
  });
});
