// Tenant-isolation tests (ADR-0073). A malformed tenant id is rejected BEFORE any open; two tenants
// resolve to distinct files; a cross-tenant query is not expressible (separate connections, separate
// files). In-process, deterministic, no network.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { TenancyError } from "@caisson-sh/kernel";
import { openTenantDb, tenantDbPath } from "./tenant-db.ts";

/** A real NUL char, built so the SOURCE stays clean ASCII (no raw control byte in the file). */
const NUL = String.fromCharCode(0);

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "caisson-tenants-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("tenant-db file-per-tenant isolation (ADR-0073)", () => {
  const badIds: ReadonlyArray<readonly [string, string]> = [
    ["empty", ""],
    ["null byte", `tenant${NUL}id`],
    ["traversal", "../evil"],
    ["nested traversal", "a/../../etc"],
    ["separator", "a/b"],
    ["backslash", "a\\b"],
    ["absolute", "/etc/passwd"],
  ];

  test.each(badIds)(
    "rejects a %s tenant id before any open",
    (_label, badId) => {
      // tenantDbPath is pure — it can never open anything.
      expect(() => tenantDbPath(root, badId)).toThrow(TenancyError);
      // openTenantDb resolves first, so it throws before mkdir/Database — nothing lands under root.
      expect(() => openTenantDb(root, badId)).toThrow(TenancyError);
      expect(readdirSync(root)).toHaveLength(0);
    },
  );

  test("two tenants resolve to distinct files under the tenant-data root", () => {
    const a = tenantDbPath(root, "tenant-a");
    const b = tenantDbPath(root, "tenant-b");
    expect(a).not.toBe(b);
    expect(a.startsWith(resolve(root) + sep)).toBe(true);
    expect(b.startsWith(resolve(root) + sep)).toBe(true);
  });

  test("a cross-tenant query is not expressible (separate connections, separate files)", () => {
    const a = openTenantDb(root, "tenant-a");
    a.exec("CREATE TABLE secrets (v TEXT)");
    a.exec("INSERT INTO secrets(v) VALUES ('alpha-only')");
    a.close();

    // tenant B opens its OWN file — tenant A's table/rows simply do not exist in this connection.
    const b = openTenantDb(root, "tenant-b");
    expect(() => b.query("SELECT v FROM secrets").all()).toThrow();
    b.close();

    // Distinct files actually landed on disk.
    const files = readdirSync(root).sort();
    expect(files).toEqual(["tenant-a.db", "tenant-b.db"]);
  });
});
