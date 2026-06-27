// Additional Authenticated Data (AAD) construction (ADR-0045). GCM authenticates but does not
// encrypt the AAD. Binding `tenant_id || key_version || column-context` as AAD is Tink's defense
// against moving a ciphertext between rows, tenants, or columns: a relocated ciphertext fails to
// authenticate because its AAD no longer matches. A JSON 2-/3-tuple binds the fields unambiguously
// (JSON's own quoting/escaping separates them — no delimiter-injection surface).

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
