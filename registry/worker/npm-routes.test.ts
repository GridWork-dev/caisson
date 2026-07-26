// npm-protocol surface tests (ADR-0223). Drives createNpmHandler with an INJECTED fake resolver +
// an injected MOCK R2 bucket — no crypto, no network (the Ed25519 verify path is covered in
// entitlement-filter.test.ts; deploy-entry.test.ts pins the live wiring). Asserts the full surface:
// abbreviated packument (dist-tags.latest + dist.{tarball,shasum,integrity}); the vendor Accept header
// never 406s; Fork-D3 statuses (401 bare / 404 with token); base 200 anonymous; the literal-slash
// tarball path re-checks entitlement; /-/ping 200; writes 404/501; and the gated response headers.
import { describe, expect, test } from "bun:test";
import { loadRegistryIndex } from "../schema/registry-index";
import {
  type NpmEnv,
  type TarballBucket,
  createNpmHandler,
  isNpmPath,
  loadTarballSidecar,
} from "./npm-routes";

// --- fixtures -------------------------------------------------------------------------------------
// Plain literals (NO cast): `loadRegistryIndex` takes `unknown` and parse-validates, so the fixed
// tier/license/editions literals need no `as` — same convention as handler-filter.test.ts.
// An OPEN Apache base module (free, always served) — editions[]===[] + Apache-2.0.
function openBase(id: string) {
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
          tier: "oss",
          license: "Apache-2.0",
          priceCents: null,
          editions: [],
          description: id,
        },
      },
    ],
  };
}

// A COMMERCIAL base-kind module (editions[]===[] BUT LicenseRef-Caisson-Commercial) — gated behind
// an entitlement, NOT free (the à-la-carte field-crypto primitive, ADR-0094/0097).
function commercialBase(id: string) {
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
          tier: "paid",
          license: "LicenseRef-Caisson-Commercial",
          priceCents: 4900,
          editions: [],
          description: id,
        },
      },
    ],
  };
}

const index = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    openBase("@caisson/kernel"), // free base
    commercialBase("@caisson/field-crypto"), // commercial, à-la-carte "field-crypto"
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
            members: { "@caisson/field-crypto": "1.0.0" },
            description: "Everything bundle fixture.",
          },
        },
      ],
    },
  ],
});

// Sidecar: real dist metadata for the two @1.0.0 tarballs (what CI would write).
const sidecar = loadTarballSidecar({
  $comment: "test sidecar",
  tarballs: {
    "@caisson/kernel@1.0.0": {
      key: "kernel/kernel-1.0.0.tgz",
      shasum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      integrity: "sha512-kernelSRIplaceholder==",
      size: 1024,
    },
    "@caisson/field-crypto@1.0.0": {
      key: "field-crypto/field-crypto-1.0.0.tgz",
      shasum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      integrity: "sha512-fieldCryptoSRIplaceholder==",
      size: 2048,
      // Resolved install fields (workspace:* already concrete) — what CI lifts from the packed
      // tarball's package.json so the client can build the dependency tree.
      meta: {
        dependencies: {
          "@caisson/kernel": "1.0.0",
          zod: "^3.23.8",
          "@noble/ed25519": "^3.1.0",
        },
        bin: { "field-crypto": "./bin/fc.js" },
        engines: { node: ">=18" },
      },
    },
  },
});

// Mock R2: returns bytes for the two known keys, null otherwise.
const TGZ = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00]); // gzip magic — stand-in tarball bytes
const bucket: TarballBucket = {
  get(key: string) {
    if (
      key === "kernel/kernel-1.0.0.tgz" ||
      key === "field-crypto/field-crypto-1.0.0.tgz"
    ) {
      // A Uint8Array is a valid BodyInit (what the real R2 stream also satisfies) — the Worker feeds
      // it straight into `new Response(body)`.
      return Promise.resolve({ body: TGZ });
    }
    return Promise.resolve(null);
  },
};
const env: NpmEnv = { TARBALLS: bucket };

/** A handler whose injected resolver returns a FIXED purchased-id set (or null = community). */
const handlerFor = (purchased: readonly string[] | null) =>
  createNpmHandler(index, sidecar, { resolveEntitlements: () => purchased });

const req = (path: string, init?: RequestInit) =>
  new Request(`https://registry.caisson.sh${path}`, init);

const assertGatedHeaders = (res: Response) => {
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("vary")).toBe("Authorization");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("strict-transport-security")).toBe(
    "max-age=31536000; includeSubDomains",
  );
};

const AUTH = { authorization: "Bearer CAISSON-PRO-sometoken" };

describe("isNpmPath dispatch predicate", () => {
  test("claims @caisson + /-/ paths, leaves the index routes alone", () => {
    expect(isNpmPath("/@caisson%2ffield-crypto")).toBe(true);
    expect(isNpmPath("/@caisson/field-crypto/-/field-crypto-1.0.0.tgz")).toBe(
      true,
    );
    expect(isNpmPath("/-/ping")).toBe(true);
    expect(isNpmPath("/")).toBe(false);
    expect(isNpmPath("/index.json")).toBe(false);
    expect(isNpmPath("/modules/@caisson%2Fkernel")).toBe(false);
  });
});

describe("abbreviated packument", () => {
  test("an entitled module carries dist-tags.latest + dist.{tarball,shasum,integrity}", async () => {
    const res = await handlerFor(["field-crypto"])(
      req("/@caisson%2ffield-crypto"),
    );
    expect(res.status).toBe(200);
    assertGatedHeaders(res);
    const body = (await res.json()) as {
      name: string;
      "dist-tags": { latest: string };
      versions: Record<
        string,
        { dist: { tarball: string; shasum: string; integrity: string } }
      >;
    };
    expect(body.name).toBe("@caisson/field-crypto");
    expect(body["dist-tags"].latest).toBe("1.0.0");
    const v = body.versions["1.0.0"];
    expect(v).toBeDefined();
    expect(v?.dist.tarball).toBe(
      "https://registry.caisson.sh/@caisson/field-crypto/-/field-crypto-1.0.0.tgz",
    );
    expect(v?.dist.shasum).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(v?.dist.integrity).toBe("sha512-fieldCryptoSRIplaceholder==");
  });

  test("a version carries the resolved dependency tree (deps/bin/engines), not just dist — else the tarball installs with ZERO deps", async () => {
    const res = await handlerFor(["field-crypto"])(
      req("/@caisson%2ffield-crypto"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      versions: Record<
        string,
        {
          dist: { tarball: string };
          dependencies?: Record<string, string>;
          bin?: unknown;
          engines?: unknown;
        }
      >;
    };
    const v = body.versions["1.0.0"];
    expect(v?.dependencies).toEqual({
      "@caisson/kernel": "1.0.0",
      zod: "^3.23.8",
      "@noble/ed25519": "^3.1.0",
    });
    expect(v?.bin).toEqual({ "field-crypto": "./bin/fc.js" });
    expect(v?.engines).toEqual({ node: ">=18" });
    // dist is still present alongside the deps.
    expect(v?.dist.tarball).toContain("field-crypto-1.0.0.tgz");
  });

  test("a meta-less version (kernel) stays {name,version,dist} — no spurious dep keys", async () => {
    const res = await handlerFor(null)(req("/@caisson%2fkernel"));
    const body = (await res.json()) as {
      versions: Record<string, Record<string, unknown>>;
    };
    const v = body.versions["1.0.0"];
    expect(v).toBeDefined();
    expect("dependencies" in (v as object)).toBe(false);
    expect(Object.keys(v as object).sort()).toEqual([
      "dist",
      "name",
      "version",
    ]);
  });

  test("the vendor Accept header returns 200, never 406 (the bun-breaking bug)", async () => {
    const res = await handlerFor(null)(
      req("/@caisson%2fkernel", {
        headers: { accept: "application/vnd.npm.install-v1+json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(406);
  });

  test("the encoded and literal scope-slash both resolve the same packument", async () => {
    const encoded = await handlerFor(null)(req("/@caisson%2fkernel"));
    const literal = await handlerFor(null)(req("/@caisson/kernel"));
    expect(encoded.status).toBe(200);
    expect(literal.status).toBe(200);
  });
});

describe("Fork D3 — 401 bare / 404 with token / base 200 anonymous", () => {
  test("commercial packument with NO token → 401 (npm/bun retries with auth)", async () => {
    const res = await handlerFor(null)(req("/@caisson%2ffield-crypto"));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
    assertGatedHeaders(res);
  });

  test("token present but not entitled → 404 (no existence leak, ADR-0076)", async () => {
    // Resolver returns null (forged/unentitled) BUT the request carries an Authorization header.
    const res = await handlerFor(null)(
      req("/@caisson%2ffield-crypto", { headers: AUTH }),
    );
    expect(res.status).toBe(404);
  });

  test("base package is 200 anonymous (B1) — packument served without a token", async () => {
    const res = await handlerFor(null)(req("/@caisson%2fkernel"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("@caisson/kernel");
  });

  test("an entitled buyer's Authorization header still yields their commercial packument (200)", async () => {
    const res = await handlerFor(["field-crypto"])(
      req("/@caisson%2ffield-crypto", { headers: AUTH }),
    );
    expect(res.status).toBe(200);
  });
});

describe("tarball — literal-slash path, re-checked entitlement, R2 bytes", () => {
  const TARBALL = "/@caisson/field-crypto/-/field-crypto-1.0.0.tgz";

  test("entitled → 200 octet-stream bytes served from R2 (A1 same-origin)", async () => {
    const res = await handlerFor(["field-crypto"])(req(TARBALL), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    assertGatedHeaders(res);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBe(TGZ.length);
    expect(bytes[0]).toBe(0x1f);
  });

  test("the GET re-checks entitlement — no token → 401 even for a real tarball path", async () => {
    const res = await handlerFor(null)(req(TARBALL), env);
    expect(res.status).toBe(401);
  });

  test("token present but unentitled → 404 (re-check, no packument-implies-tarball trust)", async () => {
    const res = await handlerFor(null)(req(TARBALL, { headers: AUTH }), env);
    expect(res.status).toBe(404);
  });

  test("base tarball is served anonymously (B1)", async () => {
    const res = await handlerFor(null)(
      req("/@caisson/kernel/-/kernel-1.0.0.tgz"),
      env,
    );
    expect(res.status).toBe(200);
  });

  test("an entitled but absent R2 object → 404 (unknown version)", async () => {
    const res = await handlerFor(["field-crypto"])(
      req("/@caisson/field-crypto/-/field-crypto-9.9.9.tgz"),
      env,
    );
    expect(res.status).toBe(404);
  });

  test("a filename whose name ≠ the scope segment → 404 (no arbitrary key fetch)", async () => {
    const res = await handlerFor(["bundle"])(
      req("/@caisson/field-crypto/-/kernel-1.0.0.tgz"),
      env,
    );
    expect(res.status).toBe(404);
  });
});

describe("ADR-0384 parent purchases install the carved OSCAL package", () => {
  const oscalVersions = [
    {
      version: "1.0.0",
      publishedAt: "2026-01-01T00:00:00.000Z",
      gateAttestation: "ci-run-1@deadbeef",
      manifest: commercialBase("@caisson/oscal-spine").versions[0]?.manifest,
    },
    {
      version: "2.0.0",
      publishedAt: "2027-01-01T00:00:00.000Z",
      gateAttestation: "ci-run-2@deadbeef",
      manifest: {
        ...commercialBase("@caisson/oscal-spine").versions[0]?.manifest,
        version: "2.0.0",
      },
    },
  ];
  const compatibilityIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      commercialBase("@caisson/compliance-core"),
      commercialBase("@caisson/frameworks-pack"),
      {
        id: "@caisson/compliance",
        latest: "1.0.0",
        versions: [
          {
            version: "1.0.0",
            publishedAt: "2026-01-01T00:00:00.000Z",
            gateAttestation: "ci-run-1@deadbeef",
            manifest: {
              id: "@caisson/compliance",
              version: "1.0.0",
              kind: "bundle",
              tier: "paid",
              license: "LicenseRef-Caisson-Commercial",
              priceCents: 164900,
              editions: [],
              members: {
                "@caisson/compliance-core": "1.0.0",
                "@caisson/frameworks-pack": "1.0.0",
                "@caisson/oscal-spine": "1.0.0",
              },
              description: "Compliance bundle compatibility fixture.",
            },
          },
        ],
      },
      {
        id: "@caisson/oscal-spine",
        latest: "2.0.0",
        versions: oscalVersions,
      },
    ],
  });
  const compatibilitySidecar = loadTarballSidecar({
    $comment: "ADR-0384 compatibility fixture",
    tarballs: Object.fromEntries(
      ["1.0.0", "2.0.0"].map((version) => [
        `@caisson/oscal-spine@${version}`,
        {
          key: `oscal-spine/oscal-spine-${version}.tgz`,
          shasum: "dddddddddddddddddddddddddddddddddddddddd",
          integrity: "sha512-oscalCompatibilitySRI==",
          size: 1,
        },
      ]),
    ),
  });
  const compatibilityEnv: NpmEnv = {
    TARBALLS: { get: () => Promise.resolve({ body: TGZ }) },
  };
  const WINDOW = "2026-12-31T00:00:00.000Z";

  for (const parent of ["compliance-core", "frameworks-pack"] as const) {
    const parentHandler = createNpmHandler(
      compatibilityIndex,
      compatibilitySidecar,
      {
        resolveEntitlements: () => ({
          entitlements: [parent],
          updatesWindows: { [parent]: WINDOW },
        }),
      },
    );

    test(`${parent} grants the OSCAL packument under the parent's updates window`, async () => {
      const response = await parentHandler(
        req("/@caisson%2foscal-spine", { headers: AUTH }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        "dist-tags": { latest: string };
        versions: Record<string, unknown>;
      };
      expect(Object.keys(body.versions)).toEqual(["1.0.0"]);
      expect(body["dist-tags"].latest).toBe("1.0.0");
    });

    test(`${parent} serves in-window OSCAL bytes and rejects out-of-window bytes`, async () => {
      const inWindow = await parentHandler(
        req("/@caisson/oscal-spine/-/oscal-spine-1.0.0.tgz", {
          headers: AUTH,
        }),
        compatibilityEnv,
      );
      expect(inWindow.status).toBe(200);
      const outOfWindow = await parentHandler(
        req("/@caisson/oscal-spine/-/oscal-spine-2.0.0.tgz", {
          headers: AUTH,
        }),
        compatibilityEnv,
      );
      expect(outOfWindow.status).toBe(404);
    });
  }

  test("a pre-carve Compliance snapshot keeps OSCAL through packument, tarball, and update-window gates", async () => {
    const bundleHandler = createNpmHandler(
      compatibilityIndex,
      compatibilitySidecar,
      {
        resolveEntitlements: () => ({
          entitlements: ["compliance"],
          entitledSince: {
            compliance: "2026-07-24T00:00:00.000Z",
          },
          updatesWindows: { compliance: WINDOW },
        }),
      },
    );

    const packument = await bundleHandler(
      req("/@caisson%2foscal-spine", { headers: AUTH }),
    );
    expect(packument.status).toBe(200);
    const body = (await packument.json()) as {
      "dist-tags": { latest: string };
      versions: Record<string, unknown>;
    };
    expect(Object.keys(body.versions)).toEqual(["1.0.0"]);
    expect(body["dist-tags"].latest).toBe("1.0.0");

    const inWindow = await bundleHandler(
      req("/@caisson/oscal-spine/-/oscal-spine-1.0.0.tgz", {
        headers: AUTH,
      }),
      compatibilityEnv,
    );
    expect(inWindow.status).toBe(200);

    const outOfWindow = await bundleHandler(
      req("/@caisson/oscal-spine/-/oscal-spine-2.0.0.tgz", {
        headers: AUTH,
      }),
      compatibilityEnv,
    );
    expect(outOfWindow.status).toBe(404);
  });
});

describe("diagnostics + writes", () => {
  test("GET /-/ping → 200 {}", async () => {
    const res = await handlerFor(null)(req("/-/ping"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  test("a write (PUT publish) → 501, never touches install", async () => {
    const res = await handlerFor(["bundle"])(
      req("/@caisson/field-crypto", { method: "PUT" }),
    );
    expect(res.status).toBe(501);
  });

  test("POST /-/npm/v1/security/audits → 501 (degrades npm audit only)", async () => {
    const res = await handlerFor(null)(
      req("/-/npm/v1/security/audits", { method: "POST" }),
    );
    expect(res.status).toBe(501);
  });

  test("GET /-/npm/v1/keys → 404 (unknown npm read, never install)", async () => {
    const res = await handlerFor(null)(req("/-/npm/v1/keys"));
    expect(res.status).toBe(404);
  });
});

describe("fail-safe entitlement (never 500)", () => {
  test("a throwing resolver degrades to base-only — base still 200, commercial 401", async () => {
    const handler = createNpmHandler(index, sidecar, {
      resolveEntitlements: () => {
        throw new Error("boom");
      },
    });
    expect((await handler(req("/@caisson%2fkernel"))).status).toBe(200);
    expect((await handler(req("/@caisson%2ffield-crypto"))).status).toBe(401);
  });

  test("a stale/unknown entitlement fails SAFE to base (commercial stays 401 bare)", async () => {
    const res = await handlerFor(["not-a-real-entitlement"])(
      req("/@caisson%2ffield-crypto"),
    );
    expect(res.status).toBe(401);
  });

  test("the everything bundle entitles the commercial packument", async () => {
    const res = await handlerFor(["everything"])(
      req("/@caisson%2ffield-crypto"),
    );
    expect(res.status).toBe(200);
  });

  test("a purged legacy 'bundle' id fails SAFE to bare 401, never over-grants (ADR-0270)", async () => {
    const res = await handlerFor(["bundle"])(req("/@caisson%2ffield-crypto"));
    expect(res.status).toBe(401);
  });
});

describe("updates-window filtering (ADR-0244/0255)", () => {
  // A multi-version commercial module: 1.0.0 + 1.1.0 published 2026, 2.0.0 published 2027.
  const multiVersion = {
    id: "@caisson/field-crypto",
    latest: "2.0.0",
    versions: ["1.0.0", "1.1.0", "2.0.0"].map((version, i) => ({
      version,
      publishedAt:
        ["2026-01-01", "2026-06-01", "2027-06-01"][i] + "T00:00:00.000Z",
      gateAttestation: "ci-run-1@deadbeef",
      manifest: {
        id: "@caisson/field-crypto",
        version,
        kind: "base",
        tier: "paid",
        license: "LicenseRef-Caisson-Commercial",
        priceCents: 4900,
        editions: [],
        description: "field-crypto",
      },
    })),
  };
  const winIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [openBase("@caisson/kernel"), multiVersion],
  });
  const winSidecar = loadTarballSidecar({
    tarballs: Object.fromEntries(
      [
        ["@caisson/kernel@1.0.0", "kernel/kernel-1.0.0.tgz"],
        ["@caisson/field-crypto@1.0.0", "field-crypto/field-crypto-1.0.0.tgz"],
        ["@caisson/field-crypto@1.1.0", "field-crypto/field-crypto-1.1.0.tgz"],
        ["@caisson/field-crypto@2.0.0", "field-crypto/field-crypto-2.0.0.tgz"],
      ].map(([name, key]) => [
        name,
        {
          key,
          shasum: "cccccccccccccccccccccccccccccccccccccccc",
          integrity: "sha512-windowSRIplaceholder==",
          size: 1,
        },
      ]),
    ),
  });
  // Permissive mock R2 — every key resolves, so a 404 can only come from the window gate.
  const anyBucket: TarballBucket = {
    get: () => Promise.resolve({ body: TGZ }),
  };
  const winEnv: NpmEnv = { TARBALLS: anyBucket };
  const winHandlerFor = (window: string | null) =>
    createNpmHandler(winIndex, winSidecar, {
      resolveEntitlements: () => ({
        entitlements: ["field-crypto"],
        updatesWindows: window === null ? {} : { "field-crypto": window },
      }),
    });
  const WINDOW = "2026-12-31T00:00:00.000Z";

  test("the packument serves only IN-WINDOW versions and recomputes dist-tags.latest", async () => {
    const res = await winHandlerFor(WINDOW)(
      req("/@caisson%2ffield-crypto", { headers: AUTH }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      "dist-tags": { latest: string };
      versions: Record<string, unknown>;
    };
    expect(Object.keys(body.versions).sort()).toEqual(["1.0.0", "1.1.0"]);
    expect(body["dist-tags"].latest).toBe("1.1.0"); // NOT the catalog's global 2.0.0
  });

  test("a null window (absent claim) is UNBOUNDED — all versions, catalog latest", async () => {
    const res = await winHandlerFor(null)(
      req("/@caisson%2ffield-crypto", { headers: AUTH }),
    );
    const body = (await res.json()) as {
      "dist-tags": { latest: string };
      versions: Record<string, unknown>;
    };
    expect(Object.keys(body.versions).sort()).toEqual([
      "1.0.0",
      "1.1.0",
      "2.0.0",
    ]);
    expect(body["dist-tags"].latest).toBe("2.0.0");
  });

  test("an in-window tarball serves; an OUT-OF-WINDOW tarball 404s before the R2 fetch", async () => {
    const inWindow = await winHandlerFor(WINDOW)(
      req("/@caisson/field-crypto/-/field-crypto-1.1.0.tgz", {
        headers: AUTH,
      }),
      winEnv,
    );
    expect(inWindow.status).toBe(200);
    const outOfWindow = await winHandlerFor(WINDOW)(
      req("/@caisson/field-crypto/-/field-crypto-2.0.0.tgz", {
        headers: AUTH,
      }),
      winEnv,
    );
    expect(outOfWindow.status).toBe(404); // the mock R2 would have served it — the window gate said no
  });

  test("BASE modules are never window-filtered (community pulls stay whole)", async () => {
    // A window far in the past would filter kernel@1.0.0 out if the filter applied to base.
    const past = winHandlerFor("2020-01-01T00:00:00.000Z");
    const pack = await past(req("/@caisson%2fkernel", { headers: AUTH }));
    const body = (await pack.json()) as { versions: Record<string, unknown> };
    expect(Object.keys(body.versions)).toEqual(["1.0.0"]);
    const tarball = await past(
      req("/@caisson/kernel/-/kernel-1.0.0.tgz", { headers: AUTH }),
      winEnv,
    );
    expect(tarball.status).toBe(200);
  });

  test("a fully out-of-window entitled module packument is 404 — indistinguishable from unentitled", async () => {
    // Never a 200 that confirms an out-of-window module exists (ADR-0251/0255 fail-closed posture,
    // matching /modules/:id, the catalog listings, and the tarball route).
    const res = await winHandlerFor("2020-01-01T00:00:00.000Z")(
      req("/@caisson%2ffield-crypto", { headers: AUTH }),
    );
    expect(res.status).toBe(404);
    const unentitled = await createNpmHandler(winIndex, winSidecar, {
      resolveEntitlements: () => ({ entitlements: [], updatesWindows: {} }),
    })(req("/@caisson%2ffield-crypto", { headers: AUTH }));
    expect(unentitled.status).toBe(404);
    expect(await res.text()).toBe(await unentitled.text());
  });

  test("the bare purchased-id array resolver shape still works (pre-window contract = unbounded)", async () => {
    const arrayHandler = createNpmHandler(winIndex, winSidecar, {
      resolveEntitlements: () => ["field-crypto"],
    });
    const res = await arrayHandler(
      req("/@caisson/field-crypto/-/field-crypto-2.0.0.tgz", {
        headers: AUTH,
      }),
      winEnv,
    );
    expect(res.status).toBe(200);
  });
});

// npm-surface route-class rate limits (CAISSON-55): packument reads and tarball bytes are TWO
// independent bindings/namespaces (see wrangler.toml), checked BEFORE resolveGate (the entitlement
// gate) — same fail-open contract as the catalog class (deploy-entry.test.ts) and the shared helper
// (rate-limit.test.ts). The real Cloudflare binding isn't available under `bun test`; every case here
// injects a fake binding via `env`, same convention as the mock R2 `bucket` above.
describe("npm route-class rate limits (CAISSON-55)", () => {
  const community = handlerFor(null);
  const deny = { limit: async () => ({ success: false }) };
  const throwing = {
    limit: async () => {
      throw new Error("rate limiting API unavailable");
    },
  };

  test("no bindings provisioned (pre-DEPLOY) — packument + tarball both served normally", async () => {
    const pk = await community(req("/@caisson%2fkernel"), env);
    expect(pk.status).toBe(200);
    const tb = await community(req("/@caisson/kernel/-/kernel-1.0.0.tgz"), env);
    expect(tb.status).toBe(200);
  });

  test("RATE_LIMIT_NPM_PACKUMENT denies → 429, never reaches the entitlement gate", async () => {
    const res = await community(req("/@caisson%2fkernel"), {
      ...env,
      RATE_LIMIT_NPM_PACKUMENT: deny,
    });
    expect(res.status).toBe(429);
    // CAISSON-87: npm/bun back off on Retry-After instead of treating the deny as forbidden.
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  test("RATE_LIMIT_TARBALL denies → 429, never reaches R2", async () => {
    const res = await community(req("/@caisson/kernel/-/kernel-1.0.0.tgz"), {
      ...env,
      RATE_LIMIT_TARBALL: deny,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });

  test("a packument deny leaves the TARBALL budget untouched — separate namespaces", async () => {
    const pk = await community(req("/@caisson%2fkernel"), {
      ...env,
      RATE_LIMIT_NPM_PACKUMENT: deny,
    });
    expect(pk.status).toBe(429);
    const tb = await community(req("/@caisson/kernel/-/kernel-1.0.0.tgz"), {
      ...env,
      RATE_LIMIT_NPM_PACKUMENT: deny, // same env object shape; tarball route never reads this binding
    });
    expect(tb.status).toBe(200);
  });

  test("a tarball deny leaves the PACKUMENT budget untouched — separate namespaces", async () => {
    const tb = await community(req("/@caisson/kernel/-/kernel-1.0.0.tgz"), {
      ...env,
      RATE_LIMIT_TARBALL: deny,
    });
    expect(tb.status).toBe(429);
    const pk = await community(req("/@caisson%2fkernel"), {
      ...env,
      RATE_LIMIT_TARBALL: deny, // packument route never reads this binding
    });
    expect(pk.status).toBe(200);
  });

  test("a throwing binding fails OPEN on both route classes — never a 500", async () => {
    const pk = await community(req("/@caisson%2fkernel"), {
      ...env,
      RATE_LIMIT_NPM_PACKUMENT: throwing,
    });
    expect(pk.status).toBe(200);
    const tb = await community(req("/@caisson/kernel/-/kernel-1.0.0.tgz"), {
      ...env,
      RATE_LIMIT_TARBALL: throwing,
    });
    expect(tb.status).toBe(200);
  });

  test("/-/ping is unaffected by either binding (only tb/pk paths are rate-limited)", async () => {
    const res = await community(req("/-/ping"), {
      ...env,
      RATE_LIMIT_NPM_PACKUMENT: deny,
      RATE_LIMIT_TARBALL: deny,
    });
    expect(res.status).toBe(200);
  });
});

describe("dist-tags.latest recompute over the SERVED set (CAISSON-85)", () => {
  // The audit's P0 shape: the ledger-built index says latest=X while X has no sidecar row (a
  // republish wave advanced metadata without packing). The packument must never advertise a
  // latest its own versions{} does not carry.
  const twoVersions = (id: string, latest: string) => ({
    id,
    latest,
    versions: ["0.9.0", latest].map((version) => ({
      version,
      publishedAt:
        version === latest
          ? "2026-02-01T00:00:00.000Z"
          : "2026-01-01T00:00:00.000Z",
      gateAttestation: "ci-run-1@deadbeef",
      manifest: {
        id,
        version,
        kind: "base",
        tier: "oss",
        license: "Apache-2.0",
        priceCents: null,
        editions: [],
        description: id,
      },
    })),
  });
  const staleIndex = loadRegistryIndex({
    schemaVersion: 1,
    modules: [
      twoVersions("@caisson/kernel", "1.0.0"), // latest ROWLESS, 0.9.0 rowed
      twoVersions("@caisson/rowless", "1.0.0"), // NO rows at all
    ],
  });
  const partialSidecar = loadTarballSidecar({
    tarballs: {
      "@caisson/kernel@0.9.0": {
        key: "kernel/kernel-0.9.0.tgz",
        shasum: "cccccccccccccccccccccccccccccccccccccccc",
        integrity: "sha512-kernel090placeholder==",
        size: 512,
      },
    },
  });
  const community = createNpmHandler(staleIndex, partialSidecar, {
    resolveEntitlements: () => null,
  });

  test("a rowless entry.latest falls back to the newest SERVED version — never a dangling tag", async () => {
    const res = await community(req("/@caisson%2fkernel"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      "dist-tags": { latest: string };
      versions: Record<string, unknown>;
      modified: string;
    };
    expect(body.versions["1.0.0"]).toBeUndefined(); // rowless → omitted
    expect(body.versions["0.9.0"]).toBeDefined();
    expect(body["dist-tags"].latest).toBe("0.9.0"); // recomputed, resolvable
    expect(body.modified).toBe("2026-01-01T00:00:00.000Z"); // tracks the recomputed latest
  });

  test("a module with ZERO served versions gets the 0.0.0 sentinel, not a phantom latest", async () => {
    const res = await community(req("/@caisson%2frowless"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      "dist-tags": { latest: string };
      versions: Record<string, unknown>;
    };
    expect(Object.keys(body.versions)).toEqual([]);
    expect(body["dist-tags"].latest).toBe("0.0.0");
  });

  test("a fully-served entry keeps its true latest (no behavior change on the healthy path)", async () => {
    const res = await handlerFor(null)(req("/@caisson%2fkernel"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { "dist-tags": { latest: string } };
    expect(body["dist-tags"].latest).toBe("1.0.0");
  });
});
