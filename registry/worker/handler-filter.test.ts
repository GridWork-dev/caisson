// Registry Worker entitlement filtering (ADR-0008/0047/0071, code-wiring B2). Drives createIndexHandler
// with an INJECTED fake resolver (no crypto here — the Ed25519 verify path is covered in
// entitlement-filter.test.ts). Asserts: a licensed caller sees base ∪ their edition; community sees
// base only; an absent everything bundle fails closed; an unentitled known module is 404 (invisible,
// ADR-0076); a stale/forged entitlement fails SAFE to base (never 500); filtered responses are
// non-cacheable (private, no-store + Vary); and with NO resolver the full catalog is served
// unfiltered (Wave-0).
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type RegistryIndex,
  loadRegistryIndex,
  loadRegistryIndexFromFile,
} from "../schema/registry-index";
import { devVerify, mintDevToken } from "./dev-license";
import { makeLicenseEntitlementResolver } from "./entitlement-filter";
import { createIndexHandler } from "./handler";

// A RUNTIME-MINTED dev-key license (documented KAT seed; no committed token string — a real
// entitlement token is itself the leak, the P0 incident class). Signs entitlements ["local-first"]
// (the canonical bundle id — tokens sign PURCHASED ids; the dissolved edition ids were purged,
// ADR-0270), pro, non-expiring; drives the REAL verify logic → expand → filter end to end through
// the injectable verify seam. The production-key bake is pinned negatively in entitlement-filter.test.ts.
const DEV_TOKEN = await mintDevToken({
  entitlements: ["local-first"],
  expiry: null,
  licenseId: "22222222-2222-4222-8222-222222222222",
  major: 1,
  tier: "pro",
});

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

  test("a missing everything bundle entry fails closed to the free base", async () => {
    expect(await ids(handlerFor(["everything"])(req("/")))).toEqual([
      "@caisson/kernel",
    ]);
  });

  test("a purged legacy 'bundle' id degrades to the free base, never over-grants (ADR-0270)", async () => {
    // The dissolved-edition purchase ids and the legacy everything-sentinel no longer alias
    // (grants are drained at deploy behind a prove-empty gate); an undrained id hits the
    // fail-closed expansion and the worker fail-safes to base — under-grant, never over-grant.
    expect(await ids(handlerFor(["bundle"])(req("/")))).toEqual([
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

  test("a throw AFTER entitlement expansion still degrades to base-only (fresh set, audit P2-1)", async () => {
    // resolveGate mutates its entitled set during expansion BEFORE the window fold; a throw between
    // the two (here: a Proxy updatesWindows whose key probe explodes) must return a FRESH base-only
    // set — never the half-built one, which would leak commercial modules with UNBOUNDED windows.
    const poisonedWindows = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("boom after expansion");
        },
        has() {
          throw new Error("boom after expansion");
        },
      },
    ) as Record<string, string>;
    const handler = createIndexHandler(index, {
      resolveEntitlements: () => ({
        entitlements: ["compliance"],
        updatesWindows: poisonedWindows,
      }),
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
  // An index that actually contains a local-ai-edition member, so the minted token's signed
  // canonical bundle id (["local-first"]) folds that edition's members via the decoupled
  // EDITION_BUNDLE_ID relation — proving verify → expand → filter end to end.
  const localAiIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []), // base
      entry("@caisson/local-store", ["local-ai"]),
      entry("@caisson/ai-kit", ["ai-kit"]),
    ],
  });
  const realHandler = createIndexHandler(localAiIndex, {
    resolveEntitlements: makeLicenseEntitlementResolver(
      () => new Set(),
      devVerify,
    ),
  });

  test("a real dev-signed license sees base ∪ its entitled bundle (local-first), not other editions", async () => {
    const res = realHandler(
      new Request("https://registry.caisson.sh/", {
        headers: { authorization: `Bearer ${DEV_TOKEN}` },
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

  test("(e) a missing everything bundle entry never widens to commercial base-kind modules", async () => {
    expect(await ids(gatedHandlerFor(["everything"])(req("/")))).toEqual([
      "@caisson/kernel",
    ]);
  });
});

describe("Worker delivers an edition's COMMERCIAL members via the sentinel — real index (ADR-0077)", () => {
  // Acceptance over the REAL committed registry/index.json: an edition license carrying ONLY its
  // sentinel (entitlements:["compliance"]) must still deliver the edition's commercial member modules
  // (field-crypto, audit-worm), which carry editions[]===[] and are gated from the anonymous free floor.
  // Membership resolves from the edition meta-package's ADR-0077 `members` map (no license re-issue).
  const realIndex = loadRegistryIndexFromFile(
    join(import.meta.dir, "..", "index.json"),
  );
  const realHandlerFor = (purchased: readonly string[] | null) =>
    createIndexHandler(realIndex, { resolveEntitlements: () => purchased });

  test("a Compliance sentinel (['compliance']) delivers field-crypto + audit-worm + compliance", async () => {
    const served = await ids(realHandlerFor(["compliance"])(req("/")));
    expect(served).toContain("@caisson/field-crypto");
    expect(served).toContain("@caisson/audit-worm");
    expect(served).toContain("@caisson/compliance");
  });

  test("an anonymous caller over the real index gets NONE of those commercial members (still gated)", async () => {
    const served = await ids(realHandlerFor(null)(req("/")));
    expect(served).not.toContain("@caisson/field-crypto");
    expect(served).not.toContain("@caisson/audit-worm");
    expect(served).not.toContain("@caisson/compliance");
    expect(served).toContain("@caisson/kernel"); // Apache-2.0 free floor still served
  });

  test("an ai-production bundle delivers its metered members (ai-meter, guardrails, prompt-registry)", async () => {
    const served = await ids(realHandlerFor(["ai-production"])(req("/")));
    for (const id of [
      "@caisson/ai-meter",
      "@caisson/guardrails",
      "@caisson/prompt-registry",
    ]) {
      expect(served).toContain(id);
    }
    // The delisted edition meta contributes no served entry (ADR-0271); the bundle's own members
    // map carries every real member (delist-equality proof, 2026-07-07).
    expect(served).not.toContain("@caisson/ai-kit");
  });

  test("a purged legacy 'ai-kit' purchase id degrades to the free base floor (ADR-0270 + 0271)", async () => {
    // ADR-0270 purged the alias (no bundle expansion) and ADR-0271 delisted the meta-package
    // itself (no index entry left to resolve). The id now fail-safes to the anonymous base floor,
    // exactly like the purged legacy 'bundle' id — under-grant, never over-grant.
    const served = await ids(realHandlerFor(["ai-kit"])(req("/")));
    expect(served).toContain("@caisson/kernel"); // the free floor still serves
    expect(served).not.toContain("@caisson/ai-kit");
    expect(served).not.toContain("@caisson/ai-meter");
    expect(served).not.toContain("@caisson/guardrails");
  });

  test("a Compliance buyer still does NOT receive an unrelated edition's member (ai-kit's ai-meter)", async () => {
    // The sentinel grants ONLY the purchased edition's members ∪ the Apache floor — never another
    // edition's commercial modules (fail-closed, exact expansion).
    const served = await ids(realHandlerFor(["compliance"])(req("/")));
    expect(served).not.toContain("@caisson/ai-meter");
  });

  test("the à-la-carte bare-slug path still delivers exactly one module (unchanged)", async () => {
    const served = await ids(realHandlerFor(["field-crypto"])(req("/")));
    expect(served).toContain("@caisson/field-crypto");
    expect(served).not.toContain("@caisson/audit-worm"); // no edition-sibling bleed
  });

  test("the everything bundle delivers every module in the real index except the rider-3 unpublished set", async () => {
    // Indexed-but-unpublished modules (ADR-0351 rider 3) sit in the index with sellable:false and
    // deliberately join NO bundle members map — not even everything — until their publish gate.
    // Explicit allowlist on purpose: a future module missing from everything's members that is NOT
    // named here still fails, so the completeness guard survives the exception.
    // Named allowlist, filtered against everything's REAL index members so the two-phase
    // graduation holds: a source-manifest membership only realizes in the index at the next
    // consume (ADR-0178 lesson) — the `!everythingMembers.has` term makes a graduated name a
    // no-op, and a graduated name is then PRUNED from the allowlist (agent-trajectory rode
    // this path at its encRef first-publish; the three compliance-gap SKUs — access-review,
    // risk-register, trust-page — completed the same two-consume arming 2026-07-20).
    // agent-usage stays indexed sellable:false with no membership until its own publish gate
    // (2026-07-18 operator lock).
    //
    // artifact-render LEFT this allowlist when oscal-spine graduated in the 2026-07-27 cut. It is
    // still published-never-sold and still appears in no members map anywhere — but it is now
    // DELIVERED to an everything buyer, because the spine names it in INTERNAL_RUNTIME_ENTITLEMENTS
    // and everything names the spine. Delivered is not sold: sellable:false is unchanged, and no
    // price or bundle-membership row exists for it. Excepting it here would now under-count the
    // served set and mask a real regression in the spine's renderer edge.
    //
    // Any OTHER module missing from everything's members and NOT named here still fails the guard.
    const RIDER3_UNPUBLISHED = new Set(["@caisson/agent-usage"]);
    const everything = realIndex.modules.find(
      (m) => m.id === "@caisson/everything",
    );
    const everythingMembers = new Set(
      Object.keys(
        everything?.versions.find((v) => v.version === everything.latest)
          ?.manifest.members ?? {},
      ),
    );
    const served = await ids(realHandlerFor(["everything"])(req("/")));
    const expected = realIndex.modules
      .map((m) => m.id)
      .filter(
        (id) => !(RIDER3_UNPUBLISHED.has(id) && !everythingMembers.has(id)),
      );
    expect(served.sort()).toEqual(expected.sort());
  });

  test("a purged legacy 'bundle' id over the real index degrades to the anonymous free floor (ADR-0270)", async () => {
    const served = await ids(realHandlerFor(["bundle"])(req("/")));
    expect(served).toEqual(await ids(realHandlerFor(null)(req("/"))));
  });
});

describe("updates-window filtering on /modules/:id (ADR-0244/0255)", () => {
  // A multi-version commercial edition member: two 2026 versions + one 2027 version.
  const multiVersion = {
    id: "@caisson/compliance",
    latest: "2.0.0",
    versions: ["1.0.0", "1.1.0", "2.0.0"].map((version, i) => ({
      version,
      publishedAt:
        ["2026-01-01", "2026-06-01", "2027-06-01"][i] + "T00:00:00.000Z",
      gateAttestation: "ci-run-1@deadbeef",
      manifest: {
        id: "@caisson/compliance",
        version,
        kind: "base",
        tier: "paid",
        license: "LicenseRef-Caisson-Commercial",
        priceCents: 4900,
        editions: ["compliance"],
        description: "compliance",
      },
    })),
  };
  const winIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []),
      multiVersion,
      {
        id: "@caisson/everything",
        latest: "1.0.0",
        versions: [
          {
            version: "1.0.0",
            publishedAt: "2026-01-01T00:00:00.000Z",
            gateAttestation: "ci-run-1@deadbeef",
            manifest: {
              id: "@caisson/everything",
              version: "1.0.0",
              kind: "bundle",
              tier: "paid",
              license: "LicenseRef-Caisson-Commercial",
              priceCents: 225900,
              editions: [],
              members: { "@caisson/compliance": "2.0.0" },
              description: "everything bundle fixture",
            },
          },
        ],
      },
    ],
  });
  const winHandlerFor = (window: string | null) =>
    createIndexHandler(winIndex, {
      resolveEntitlements: () => ({
        entitlements: ["compliance"],
        updatesWindows: window === null ? {} : { compliance: window },
      }),
    });
  const WINDOW = "2026-12-31T00:00:00.000Z";

  test("an entitled commercial module serves only IN-WINDOW versions, latest recomputed", async () => {
    const res = winHandlerFor(WINDOW)(req("/modules/@caisson%2Fcompliance"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      latest: string;
      versions: { version: string }[];
    };
    expect(body.versions.map((v) => v.version).sort()).toEqual([
      "1.0.0",
      "1.1.0",
    ]);
    expect(body.latest).toBe("1.1.0"); // NOT the catalog's global 2.0.0
  });

  test("a null window (absent claim) is UNBOUNDED — full entry served", async () => {
    const res = winHandlerFor(null)(req("/modules/@caisson%2Fcompliance"));
    const body = (await res.json()) as {
      latest: string;
      versions: { version: string }[];
    };
    expect(body.versions.length).toBe(3);
    expect(body.latest).toBe("2.0.0");
  });

  test("a module with NO in-window version is 404 — indistinguishable from unentitled", () => {
    const res = winHandlerFor("2020-01-01T00:00:00.000Z")(
      req("/modules/@caisson%2Fcompliance"),
    );
    expect(res.status).toBe(404);
  });

  test("BASE modules are never window-filtered", async () => {
    const res = winHandlerFor("2020-01-01T00:00:00.000Z")(
      req("/modules/@caisson%2Fkernel"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { versions: { version: string }[] };
    expect(body.versions.length).toBe(1);
  });

  test("the bare purchased-id array resolver shape still works (pre-window contract = unbounded)", async () => {
    const arrayHandler = createIndexHandler(winIndex, {
      resolveEntitlements: () => ["compliance"],
    });
    const res = arrayHandler(req("/modules/@caisson%2Fcompliance"));
    const body = (await res.json()) as { latest: string };
    expect(body.latest).toBe("2.0.0");
  });

  test("MOST FAVORABLE (ADR-0255 D3): two grantors' windows → the module serves under the LARGER instant", async () => {
    // Bought BOTH the compliance bundle (older window) AND everything (newer window) — both grant
    // @caisson/compliance. The better (newer, more permissive) window applies.
    const handler = createIndexHandler(winIndex, {
      resolveEntitlements: () => ({
        entitlements: ["compliance", "everything"],
        updatesWindows: {
          compliance: "2026-01-15T00:00:00.000Z", // would allow only 1.0.0
          everything: WINDOW, // allows 1.0.0 + 1.1.0 — the more favorable grantor
        },
      }),
    });
    const res = handler(req("/modules/@caisson%2Fcompliance"));
    const body = (await res.json()) as {
      latest: string;
      versions: { version: string }[];
    };
    expect(body.versions.map((v) => v.version).sort()).toEqual([
      "1.0.0",
      "1.1.0",
    ]);
    expect(body.latest).toBe("1.1.0");
  });

  test("MOST FAVORABLE (ADR-0255 D3): a grantor with NO key (unbounded) beats a windowed grantor", async () => {
    // The everything purchase carries no key for itself (unbounded) even though the compliance
    // purchase has a narrow window — the unbounded grantor wins, serving every version.
    const handler = createIndexHandler(winIndex, {
      resolveEntitlements: () => ({
        entitlements: ["compliance", "everything"],
        updatesWindows: { compliance: "2020-01-01T00:00:00.000Z" }, // everything: no key = unbounded
      }),
    });
    const res = handler(req("/modules/@caisson%2Fcompliance"));
    const body = (await res.json()) as {
      latest: string;
      versions: { version: string }[];
    };
    expect(body.versions.length).toBe(3);
    expect(body.latest).toBe("2.0.0");
  });

  test("the / catalog listing applies the window — latest never advertises an out-of-window version", async () => {
    const res = winHandlerFor(WINDOW)(req("/"));
    const body = (await res.json()) as {
      modules: { id: string; latest: string }[];
    };
    const compliance = body.modules.find((m) => m.id === "@caisson/compliance");
    expect(compliance?.latest).toBe("1.1.0"); // NOT the catalog's global 2.0.0
  });

  test("a fully-out-of-window module vanishes from / and /index.json (metadata matches the pull gates)", async () => {
    const handler = winHandlerFor("2020-01-01T00:00:00.000Z");
    const root = (await handler(req("/")).json()) as {
      modules: { id: string }[];
    };
    expect(root.modules.map((m) => m.id)).toEqual(["@caisson/kernel"]);
    const full = (await handler(req("/index.json")).json()) as {
      modules: { id: string }[];
    };
    expect(full.modules.map((m) => m.id)).toEqual(["@caisson/kernel"]);
  });

  test("/index.json narrows an entitled module's versions to the window", async () => {
    const res = winHandlerFor(WINDOW)(req("/index.json"));
    const body = (await res.json()) as {
      modules: { id: string; versions: { version: string }[] }[];
    };
    const compliance = body.modules.find((m) => m.id === "@caisson/compliance");
    expect(compliance?.versions.map((v) => v.version).sort()).toEqual([
      "1.0.0",
      "1.1.0",
    ]);
  });
});

describe("snapshot-at-sale member filter (ADR-0257 §1.2 — the wired D-axis)", () => {
  // A compliance bundle whose members carry REAL pricebook join dates: audit-worm joined at
  // GENESIS (2026-06-01), compliance-core at the catalog rework (2026-07-06). The Worker injects
  // the pricebook membership timeline at expansion, so a buyer's signed `entitledSince` filters it.
  // oscal-spine + artifact-render are present but incidental to this suite: since the spine
  // graduated (indexed, no longer reserved) it is a named `compliance` member, so an index missing
  // it makes the whole bundle expansion throw and the Worker fail-safes to the base floor — every
  // assertion below would 404 for a reason that has nothing to do with snapshot-at-sale filtering.
  const snapIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      entry("@caisson/kernel", []),
      entry("@caisson/audit-worm", ["compliance"]),
      entry("@caisson/compliance-core", ["compliance"]),
      entry("@caisson/oscal-spine", ["compliance"]),
      entry("@caisson/artifact-render", []),
    ],
  });
  const handlerSince = (since: string) =>
    createIndexHandler(snapIndex, {
      resolveEntitlements: () => ({
        entitlements: ["compliance"],
        updatesWindows: {},
        entitledSince: { compliance: since },
      }),
    });

  test("a buyer whose entitledSince PREDATES a member's join does NOT get that member (404)", () => {
    // Bought 2026-06-15 — after audit-worm's GENESIS join, before compliance-core's rework join.
    const handler = handlerSince("2026-06-15T00:00:00.000Z");
    // The pre-existing member is served …
    expect(handler(req("/modules/@caisson%2Faudit-worm")).status).toBe(200);
    // … the LATER-added member is invisible (404 — indistinguishable from unentitled, ADR-0076).
    expect(handler(req("/modules/@caisson%2Fcompliance-core")).status).toBe(
      404,
    );
  });

  test("a buyer who purchased AFTER the member joined DOES get it (expanded)", () => {
    const handler = handlerSince("2026-07-10T00:00:00.000Z"); // after the catalog-rework join
    expect(handler(req("/modules/@caisson%2Fcompliance-core")).status).toBe(
      200,
    );
    expect(handler(req("/modules/@caisson%2Faudit-worm")).status).toBe(200);
  });

  test("absent entitledSince grandfathers every member (fail-soft — no snapshot data)", () => {
    const handler = createIndexHandler(snapIndex, {
      resolveEntitlements: () => ({
        entitlements: ["compliance"],
        updatesWindows: {},
      }),
    });
    expect(handler(req("/modules/@caisson%2Fcompliance-core")).status).toBe(
      200,
    );
  });
});
