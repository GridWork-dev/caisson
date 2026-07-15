import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadRegistryIndexFromFile } from "../schema/registry-index";
import { createIndexHandler } from "./handler";

const index = loadRegistryIndexFromFile(
  join(import.meta.dir, "..", "index.json"),
);

const get = (
  handler: (r: Request) => Response,
  path: string,
  method = "GET",
): Response =>
  handler(new Request(`https://registry.caisson.sh${path}`, { method }));

describe("registry Worker /health route (ADR-0348)", () => {
  test("GET /health is 200 with { status: 'ok', version } and never caches", async () => {
    const res = get(createIndexHandler(index), "/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    // A caller-varying header would let a shared cache serve one probe's body to another — health
    // must be caller-independent, so it carries no Vary at all.
    expect(res.headers.get("vary")).toBeNull();
    const body = (await res.json()) as { status: string; version: number };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(index.schemaVersion);
  });

  test("health returns before the entitlement gate — the resolver is never invoked", async () => {
    let called = false;
    const handler = createIndexHandler(index, {
      resolveEntitlements: () => {
        called = true;
        return null;
      },
    });
    const res = get(handler, "/health");
    expect(res.status).toBe(200);
    expect(called).toBe(false);
  });

  test("a non-GET /health is 405, not a health 200", () => {
    const res = get(createIndexHandler(index), "/health", "POST");
    expect(res.status).toBe(405);
  });
});
