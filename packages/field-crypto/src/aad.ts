// Additional Authenticated Data (AAD) construction (ADR-0045/0055). GCM authenticates but does not
// encrypt the AAD. Binding `tenant_id || key_version || column-context` as AAD is Tink's defense
// against moving a ciphertext to another TENANT or another COLUMN: a relocated ciphertext fails to
// authenticate because its AAD no longer matches (and a cross-tenant move ALSO fails because the
// per-tenant derived key differs, ADR-0043). A JSON tuple binds the fields unambiguously (JSON's
// own quoting/escaping separates them — no delimiter-injection surface).
//
// ROW BINDING (ADR-0055, closes threat-model gaps TM2/TM-E). The optional 4th element `rowId` binds the
// ciphertext to ONE row: with it present the AAD becomes the 4-tuple `tenant∥kv∥column∥rowId`, so a
// cell relocated to (or rolled back from) another row of the SAME tenant+column+key_version fails to
// authenticate. SEC/HIPAA columns MUST take this path via `encryptField`/`decryptField`
// (encrypt-field.ts), passing the row's `crypto.randomUUID()` PK as `rowId`.
//
// SCOPE — the transparent Drizzle `customType` seam (column.ts) CANNOT supply a row id (it sees only
// the cell value, never the PK), so it stays on the 3-tuple and provides NO cross-row tamper-evidence
// — it is for low-sensitivity fields only. The 3-tuple wire is left byte-identical when `rowId` is
// omitted (the element is not appended, never serialized as `null`), so existing ciphertexts and the
// transparent column are unchanged.

/**
 * Build the canonical AAD for a field. `columnContext` is the column's stable identity (e.g. "ssn").
 * Pass `rowId` (the row's stable PK) for row-bound SEC/HIPAA fields → a 4-tuple; omit it for the
 * transparent low-sensitivity column → the unchanged 3-tuple.
 */
export function buildAad(
  tenantId: string,
  keyVersion: number,
  columnContext: string,
  rowId?: string,
): Buffer {
  // Conditional construction: omitting `rowId` must yield the SAME bytes as the legacy 3-tuple —
  // pushing `undefined` would serialize as `null` and break every existing ciphertext + golden.
  const tuple =
    rowId === undefined
      ? [tenantId, keyVersion, columnContext]
      : [tenantId, keyVersion, columnContext, rowId];
  return Buffer.from(JSON.stringify(tuple), "utf8");
}
