import { expect, test } from "bun:test";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import { NextRequest, type NextResponse } from "next/server";

const previousNodeEnv = process.env.NODE_ENV;
const previousOriginMode = process.env.ORIGIN_SECRET_MODE;
Reflect.set(process.env, "NODE_ENV", "test");
Reflect.set(process.env, "ORIGIN_SECRET_MODE", "disabled");
const proxyModule = await import("../proxy.ts").catch(() => null);
if (previousNodeEnv === undefined)
  Reflect.deleteProperty(process.env, "NODE_ENV");
else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
if (previousOriginMode === undefined)
  Reflect.deleteProperty(process.env, "ORIGIN_SECRET_MODE");
else Reflect.set(process.env, "ORIGIN_SECRET_MODE", previousOriginMode);
const createSiteProxy =
  proxyModule === null
    ? undefined
    : (Reflect.get(proxyModule, "createSiteProxy") as
        | ((
            config: ReturnType<typeof loadOriginGateConfig>,
          ) => (request: NextRequest) => NextResponse | Promise<NextResponse>)
        | undefined);
const proxyConfig = Reflect.get(proxyModule ?? {}, "config") as
  | { matcher?: readonly string[] }
  | undefined;
const HEALTH_PROBE_PATH = Reflect.get(
  proxyModule ?? {},
  "HEALTH_PROBE_PATH",
) as string | undefined;

const CURRENT = Buffer.alloc(32, 0x41).toString("base64url");
const NEXT = Buffer.alloc(32, 0x42).toString("base64url");
const WRONG = Buffer.alloc(32, 0x43).toString("base64url");
function requireProxy(
  env: Record<string, string | undefined>,
): (request: NextRequest) => NextResponse | Promise<NextResponse> {
  expect(createSiteProxy).toBeFunction();
  if (createSiteProxy === undefined) {
    throw new Error("site proxy factory is not implemented");
  }
  return createSiteProxy(loadOriginGateConfig(env));
}

test("site proxy permits the explicit nonproduction opt-out", async () => {
  const response = await requireProxy({
    NODE_ENV: "test",
    ORIGIN_SECRET_MODE: "disabled",
  })(new NextRequest("https://caisson.sh/healthz"));
  expect(response.status).toBe(200);
});

test("site proxy matches API and metadata routes instead of excluding security-relevant paths", () => {
  expect(proxyConfig?.matcher).toEqual(["/:path*"]);
});

test("site proxy exempts the exact health probe path from the origin gate", async () => {
  // ADR-0416 ruling 1. Railway's platform healthcheck reaches the container internally and cannot
  // carry the Worker-injected secret; gating it made `main` undeployable and froze the whole
  // fleet, since apps/admin is the fail-fast first leg. This test previously asserted the 403 on
  // purpose — the carve is the deliberate reversal, not a regression.
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const missing = await proxy(new NextRequest("https://caisson.sh/healthz"));
  const wrong = await proxy(
    new NextRequest("https://caisson.sh/healthz", {
      headers: { "x-gridwork-origin-secret": WRONG },
    }),
  );

  // A wrong secret is not rejected either: the path answers ahead of the gate, so the header is
  // never read. That is the honest contract — the route is a bare `{ ok: true }` with nothing to
  // protect. Anything that ever needs protecting must not live on this path.
  expect(missing.status).toBe(200);
  expect(wrong.status).toBe(200);
});

test("the site health carve is exact — near-miss paths stay behind the origin gate", async () => {
  // The carve's whole risk is width. A prefix match would hand `/healthz/../api/ask` and every
  // `/healthz*` route to the raw *.up.railway.app origin, which the Worker never sees.
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  for (const path of ["/healthz/", "/healthzz", "/healthz/x", "/api/healthz"]) {
    const response = await proxy(new NextRequest(`https://caisson.sh${path}`));
    expect({ path, status: response.status }).toEqual({ path, status: 403 });
  }
});

test("the carved path equals the healthcheckPath Railway actually probes", async () => {
  // Drift here silently re-freezes the deploy with no local signal: the code would exempt a path
  // nothing probes while the probed path 403s. Derived from the manifest, not restated.
  const manifest = await Bun.file(
    new URL("../railway.toml", import.meta.url),
  ).text();
  const probed = /^healthcheckPath\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
  expect(probed).toBe(HEALTH_PROBE_PATH);
});

test("site proxy independently rejects a direct /api request without the origin secret", async () => {
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET_MODE: "enabled",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const response = await proxy(new NextRequest("https://caisson.sh/api/ask"));
  expect(response.status).toBe(403);
});

test("site proxy rejects trailing-slash paths that Next used to redirect pre-gate", async () => {
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET_MODE: "enabled",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  // Next's internal `/:path+/` rule resolved ahead of the proxy and answered 308 on the raw
  // origin for EVERY path. `skipTrailingSlashRedirect` moves normalization behind this gate.
  for (const path of ["/healthz/", "/api/ask/", "/dashboard/"]) {
    const response = await proxy(new NextRequest(`https://caisson.sh${path}`));
    expect(response.status).toBe(403);
  }
});

test("site proxy still normalizes a trailing slash once the origin secret checks out", async () => {
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET_MODE: "enabled",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const response = await proxy(
    new NextRequest("https://caisson.sh/updates/", {
      headers: { "x-gridwork-origin-secret": CURRENT },
    }),
  );

  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://caisson.sh/updates");
});

test("the doc 04 §4 pre-gate redirect exception stays exactly the enumerated set", async () => {
  // Config redirects resolve before the proxy, so every source here answers 308 on the raw origin
  // without the secret. That is a NAMED exception in doc 04 §4 and the T29 release sweep asserts
  // these and only these. Set equality, not a count: a 12th rule must amend the doc first.
  const configModule = await import("../next.config.ts");
  const nextConfig = configModule.default as {
    redirects?: () => Promise<ReadonlyArray<{ source: string }>>;
    skipTrailingSlashRedirect?: boolean;
  };

  expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  const sources = (await nextConfig.redirects?.())?.map((r) => r.source) ?? [];
  expect(new Set(sources)).toEqual(
    new Set([
      "/pricing",
      "/modules",
      "/build",
      "/marketplace/modules",
      "/marketplace/build",
      "/changelog",
      "/changelog/rss.xml",
      "/docs/ai-kit",
      "/docs/ai-kit/:path*",
      "/docs/base/credits",
      "/docs/compliance/compliance",
    ]),
  );
});

test("site proxy accepts current and next origin secrets during rotation", async () => {
  const proxy = requireProxy({
    NODE_ENV: "production",
    ORIGIN_SECRET_MODE: "enabled",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const current = await proxy(
    new NextRequest("https://caisson.sh/healthz", {
      headers: { "x-gridwork-origin-secret": CURRENT },
    }),
  );
  const next = await proxy(
    new NextRequest("https://caisson.sh/healthz", {
      headers: { "x-gridwork-origin-secret": NEXT },
    }),
  );

  expect(current.status).toBe(200);
  expect(next.status).toBe(200);
});
