// At-rest field encryption over the per-tenant local SQLite store (ADR-0055/0064 — threat TM-REST).
//
// A COMPOSITION, not a new crypto stack (ADR-0055): @caisson/field-crypto supplies per-tenant HKDF
// key derivation + AES-256-GCM behind the AeadCipher seam + a self-describing envelope;
// @caisson/local-store supplies the file-per-tenant isolation floor (`openTenantDb` — the resolved
// path IS the boundary, ADR-0073). This edition seam binds the two: a sensitive column is SEALED
// (`sealField`) under the writing tenant's derived key BEFORE it ever reaches the SQLite file, and
// OPENED (`openField`) under the same tenant's context on read.
//
// Two independent bindings make a tenant-B file unable to open a tenant-A ciphertext (defense in
// depth): (1) the AES key is HKDF-derived with `tenant_id` in the `info` (ADR-0043) — tenant B
// derives a DIFFERENT key; (2) `tenant_id` is bound into the GCM AAD (ADR-0045) — even an identical
// key would fail to authenticate. Either way `openField` THROWS (AEAD auth-fail): an exfiltrated
// tenant-B database file cannot decrypt a copied-in tenant-A row.
//
// `tenantId`/`columnContext` are TRUSTED server-side seams (ADR-0073/0043), never raw user input, so
// no boundary Zod parse lives here — the only external input is the local-deployment master secret,
// which `DerivedKeyProvider.fromEnv` validates (and fails closed on) before any key is derived.
import type { Database } from "bun:sqlite";
import {
  type FieldCryptoContext,
  type SyncFieldKeyProvider,
  DerivedKeyProvider,
  derivedContext,
  openField,
  sealField,
} from "@caisson/field-crypto";
import { openTenantDb } from "@caisson/local-store";

/**
 * At-rest encryption bound to the file-per-tenant local store. One instance carries the tenant-data
 * root (the ADR-0073 isolation root) + the local key provider (the local-deployment master-key
 * source). Every seal/open is tenant-scoped: `tenantId` flows into both the HKDF `info` and the GCM
 * AAD, so a ciphertext sealed for one tenant cannot be opened under another tenant's context.
 */
export class AtRestStore {
  readonly #root: string;
  readonly #provider: SyncFieldKeyProvider;

  constructor(root: string, provider: SyncFieldKeyProvider) {
    this.#root = root;
    this.#provider = provider;
  }

  /**
   * Build an at-rest store whose provider derives per-tenant keys from the local-deployment master
   * secret in the validated env (`MASTER_FIELD_KEY` / `FIELD_CRYPTO_SALT`, each 64 hex chars).
   * Fail-closed: a missing/malformed secret throws at construction — never a silent unkeyed write.
   * The master key is read once and never logged (`DerivedKeyProvider` keeps it private).
   */
  static fromEnv(
    root: string,
    env: Record<string, string | undefined> = process.env,
  ): AtRestStore {
    return new AtRestStore(root, DerivedKeyProvider.fromEnv(env));
  }

  /**
   * Open exactly ONE tenant's isolated SQLite file (creating it on first use). `openTenantDb`
   * resolves + traversal-guards the path BEFORE any open, so a malformed `tenantId` throws
   * fail-closed; the returned connection is bound to a single tenant's file (ADR-0073), so a
   * cross-tenant read is not even expressible.
   */
  openDb(tenantId: string): Database {
    return openTenantDb(this.#root, tenantId);
  }

  /** The per-tenant field-crypto context (synchronous key derivation) used to seal/open fields. */
  contextFor(tenantId: string): FieldCryptoContext {
    return derivedContext(this.#provider, tenantId);
  }

  /**
   * Seal a sensitive column value for a tenant → the self-describing base64 envelope to store at
   * rest. `columnContext` is the column's stable identity (e.g. `"note.secret"`), bound into the AAD
   * so a ciphertext cannot be relocated to another column.
   */
  seal(tenantId: string, columnContext: string, plaintext: string): string {
    return sealField(this.contextFor(tenantId), columnContext, plaintext);
  }

  /**
   * Open a stored at-rest envelope for a tenant + column → plaintext. THROWS (AEAD auth-fail) if the
   * envelope was sealed for a different tenant or column — the at-rest guarantee behind TM-REST.
   */
  open(tenantId: string, columnContext: string, stored: string): string {
    return openField(this.contextFor(tenantId), columnContext, stored);
  }
}
