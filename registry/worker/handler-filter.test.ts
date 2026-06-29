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

// The committed KAT license (license-verify/src/token.test.ts) — signs entitlements ["local-ai"], pro,
// non-expiring. A TEST vector, never a production secret. Lets us drive the REAL verifier→expand→filter.
const KAT_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiJmNDdhYzEwYi01OGNjLTQzNzItYTU2Ny0wZTAyYjJjM2Q0NzkiLCJtYWpvciI6MSwidGllciI6InBybyJ9mLtVqk-91jkIh6xD8M0BPmwVbwZfFtH9A0hnBM7zNgI6C1BHuiZEdyBYBtj2dftdSQRNPX9RnIjV21FDEfgdBQ";

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
  // An index that actually contains a local-ai member, so the KAT token's signed entitlement
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

  test("a real KAT-signed license sees base ∪ its entitled edition (local-ai), not other editions", async () => {
    const res = realHandler(
      new Request("https://registry.caisson.sh/", {
        headers: { authorization: `Bearer ${KAT_TOKEN}` },
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
