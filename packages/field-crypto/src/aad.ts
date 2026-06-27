// Additional Authenticated Data (AAD) construction (ADR-0045). GCM authenticates but does not
// encrypt the AAD. Binding `tenant_id || key_version || column-context` as AAD is Tink's defense
// against moving a ciphertext to another TENANT or another COLUMN: a relocated ciphertext fails to
// authenticate because its AAD no longer matches (and a cross-tenant move ALSO fails because the
// per-tenant derived key differs, ADR-0043). A JSON 2-/3-tuple binds the fields unambiguously
// (JSON's own quoting/escaping separates them — no delimiter-injection surface).
//
// SCOPE — this AAD carries NO row identity, so it does NOT prevent relocating a ciphertext between
// two ROWS of the SAME tenant+column+key_version (an attacker with storage write access could swap
// or roll back one cell). Row-level binding needs a stable per-row id threaded into the AAD, which
// the transparent Drizzle `customType` seam cannot supply (it sees only the cell value, never the
// PK). That is an OPEN design item for the Compliance edition (decisions-and-forks board), not a
// guarantee Wave 0 provides — do not assert cross-row tamper-evidence on this construction.

/** Build the canonical AAD for a field. `columnContext` is the column's stable identity (e.g. "ssn"). */
export function buildAad(
  tenantId: string,
  keyVersion: number,
  columnContext: string,
): Buffer {
  return Buffer.from(
    JSON.stringify([tenantId, keyVersion, columnContext]),
    "utf8",
  );
}
