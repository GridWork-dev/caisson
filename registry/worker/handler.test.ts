import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadRegistryIndexFromFile } from "../schema/registry-index";
import { createIndexHandler } from "./handler";

const index = loadRegistryIndexFromFile(
  join(import.meta.dir, "..", "index.json"),
);
const handler = createIndexHandler(index);

const get = (path: string, method = "GET"): Response =>
  handler(new Request(`https://registry.caisson.sh${path}`, { method }));

const assertSecurityHeaders = (res: Response) => {
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-frame-options")).toBe("DENY");
  expect(res.headers.get("strict-transport-security")).toBe(
    "max-age=31536000; includeSubDomains",
  );
};

describe("registry read Worker handler (ADR-0047 seam)", () => {
  test("GET / lists module ids + latest", async () => {
    const res = get("/");
    expect(res.status).toBe(200);
    assertSecurityHeaders(res);
    const body = (await res.json()) as { modules: { id: string }[] };
    expect(body.modules.map((m) => m.id)).toContain("@caisson/field-crypto");
  });

  test("GET /index.json serves the full validated index", async () => {
    const res = get("/index.json");
    expect(res.status).toBe(200);
    assertSecurityHeaders(res);
    const body = (await res.json()) as { schemaVersion: number };
    expect(body.schemaVersion).toBe(1);
  });

  test("GET /modules/:id returns the entry for a known module", async () => {
    const res = get(`/modules/${encodeURIComponent("@caisson/field-crypto")}`);
    expect(res.status).toBe(200);
    assertSecurityHeaders(res);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("@caisson/field-crypto");
  });

  test("an unknown module id is 404 (allowlist)", async () => {
    const res = get(`/modules/${encodeURIComponent("@caisson/not-published")}`);
    expect(res.status).toBe(404);
    assertSecurityHeaders(res);
  });

  test("a malformed module id is 404, not a crash", async () => {
    const res = get(`/modules/${encodeURIComponent("@stack/evil")}`);
    expect(res.status).toBe(404);
    assertSecurityHeaders(res);
  });

  test("a malformed %-encoding is 404, not a 500 (URIError guarded)", () => {
    // decodeURIComponent throws URIError on these; the handler must catch → 404, never crash.
    for (const bad of ["/modules/%", "/modules/%ZZ", "/modules/abc%2"]) {
      const res = get(bad);
      expect(res.status).toBe(404);
      assertSecurityHeaders(res);
    }
  });

  test("a non-GET method is 405", () => {
    const res = get("/index.json", "POST");
    expect(res.status).toBe(405);
    assertSecurityHeaders(res);
  });

  test("an unknown path is 404", () => {
    const res = get("/nope");
    expect(res.status).toBe(404);
    assertSecurityHeaders(res);
  });
});
