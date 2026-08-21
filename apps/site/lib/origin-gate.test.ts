import { expect, test } from "bun:test";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import { NextRequest, type NextResponse } from "next/server";

const proxyModule = await import("../proxy.ts").catch(() => null);
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

test("site proxy leaves the current Railway runtime unchanged when the gate flag is absent", async () => {
  const response = await requireProxy({})(
    new NextRequest("https://caisson.sh/healthz"),
  );
  expect(response.status).toBe(200);
});

test("site proxy matches API and metadata routes instead of excluding security-relevant paths", () => {
  expect(proxyConfig?.matcher).toEqual(["/:path*"]);
});

test("site proxy rejects missing and wrong origin secrets on /healthz", async () => {
  const proxy = requireProxy({
    ORIGIN_SECRET_REQUIRED: "true",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const missing = await proxy(new NextRequest("https://caisson.sh/healthz"));
  const wrong = await proxy(
    new NextRequest("https://caisson.sh/healthz", {
      headers: { "x-gridwork-origin-secret": WRONG },
    }),
  );

  expect(missing.status).toBe(403);
  expect(wrong.status).toBe(403);
});

test("site proxy independently rejects a direct /api request without the origin secret", async () => {
  const proxy = requireProxy({
    ORIGIN_SECRET_REQUIRED: "true",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const response = await proxy(new NextRequest("https://caisson.sh/api/ask"));
  expect(response.status).toBe(403);
});

test("site proxy accepts current and next origin secrets during rotation", async () => {
  const proxy = requireProxy({
    ORIGIN_SECRET_REQUIRED: "true",
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
