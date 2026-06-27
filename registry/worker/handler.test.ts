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

describe("registry read Worker handler (ADR-0047 seam)", () => {
  test("GET / lists module ids + latest", async () => {
    const res = get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = (await res.json()) as { modules: { id: string }[] };
    expect(body.modules.map((m) => m.id)).toContain("@caisson/field-crypto");
  });

  test("GET /index.json serves the full validated index", async () => {
    const res = get("/index.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { schemaVersion: number };
    expect(body.schemaVersion).toBe(1);
  });

  test("GET /modules/:id returns the entry for a known module", async () => {
    const res = get(`/modules/${encodeURIComponent("@caisson/field-crypto")}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("@caisson/field-crypto");
  });

  test("an unknown module id is 404 (allowlist)", async () => {
    const res = get(`/modules/${encodeURIComponent("@caisson/not-published")}`);
    expect(res.status).toBe(404);
  });

  test("a malformed module id is 404, not a crash", async () => {
    const res = get(`/modules/${encodeURIComponent("@stack/evil")}`);
    expect(res.status).toBe(404);
  });

  test("a non-GET method is 405", () => {
    expect(get("/index.json", "POST").status).toBe(405);
  });

  test("an unknown path is 404", () => {
    expect(get("/nope").status).toBe(404);
  });
});
