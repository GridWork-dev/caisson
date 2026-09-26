// src/tenant-db.ts — the local/SQLite tenant-isolation floor (ADR-0073). The local tier has NO RLS,
// so the ADR-0005 fail-closed `WHERE` floor does not exist there; isolation is instead PHYSICAL —
// ONE SQLite DB file per tenant, and the resolved file path IS the boundary. A connection opens
// exactly one tenant's file, so a cross-tenant query is not even expressible.
//
// The `tenant_id → path` mapping is a TRUSTED server-side seam: `tenantId` is derived from an
// AUTHENTICATED context, never raw user input. The resolver still guards fail-closed — a malformed
// id is a boundary breach, not a lookup miss — by rejecting `..` / null-byte / absolute / separator
// ids and asserting the resolved path stays under the tenant-data root + `path.sep` (ADR-0073), the
// same reject-`..`/null/absolute + `path.resolve` + root-prefix-assert pattern used across the base.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { TenancyError } from "@caisson-sh/kernel";

/** Fail-closed denial: a category reason only — NEVER the raw id (which could leak a tenant id). */
function deny(reason: string): never {
  // TenancyError is the canonical fail-closed boundary (404 / not_found, ADR-0019/0005) — the
  // local-tier mirror of an RLS denial. We do not reveal that the id was malformed vs unknown.
  throw new TenancyError("tenant database resolution denied", { reason });
}

/**
 * Resolve the absolute DB file path for a tenant — a PURE function (no filesystem access), so it can
 * reject a bad id BEFORE anything is opened. The resolved path is the isolation boundary (ADR-0073):
 * one file per tenant, always under `root`.
 */
export function tenantDbPath(root: string, tenantId: string): string {
  if (tenantId.length === 0) deny("empty");
  if (tenantId.includes("\0")) deny("null-byte");
  if (tenantId.includes("..")) deny("traversal");
  if (tenantId.includes("/") || tenantId.includes("\\")) deny("separator");
  if (isAbsolute(tenantId)) deny("absolute");

  const rootResolved = resolve(root);
  const candidate = resolve(rootResolved, `${tenantId}.db`);
  // The authoritative guard: the resolved path MUST stay under the tenant-data root + separator.
  // (The separator rejection above already guarantees this; the assert is the security-floor backstop
  // that survives any future change to the filename scheme.)
  if (!candidate.startsWith(rootResolved + sep)) deny("escaped-root");
  return candidate;
}

/**
 * Open exactly ONE tenant's SQLite DB file (creating it on first use). The path is resolved +
 * traversal-guarded first, so a malformed `tenantId` throws BEFORE any file is opened or created.
 * The returned connection is bound to a single tenant's file — a cross-tenant read is inexpressible.
 *
 * Callers wanting hybrid retrieval wire the resolved path into the store:
 *   `LocalStore.open({ dim, path: tenantDbPath(root, tenantId) })`.
 */
export function openTenantDb(root: string, tenantId: string): Database {
  const path = tenantDbPath(root, tenantId); // throws (fail-closed) before any open on a bad id
  mkdirSync(resolve(root), { recursive: true });
  return new Database(path, { create: true });
}
