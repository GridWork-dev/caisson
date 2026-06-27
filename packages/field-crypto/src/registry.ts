// Key-version rotation registry (ADR-0006/0043). Tracks the CURRENT key version per tenant. Older
// versions stay decryptable: an existing envelope carries its own `key_version` (ADR-0046), and the
// derived-key path can re-derive any past version on read. Rotation is a version BUMP — there is no
// bulk re-encrypt. Lazy re-encrypt: the next WRITE to a field re-encrypts it under the new current
// version (a read leaves the old version in place). For a stored-key (KMS) provider the same
// registry tracks which wrapped DEK is current.

/** Persistence seam for the per-tenant current version. In-memory default; DB-backed later (P2). */
export interface KeyVersionStore {
  get(tenantId: string): number | undefined;
  set(tenantId: string, version: number): void;
}

export class InMemoryKeyVersionStore implements KeyVersionStore {
  private readonly versions = new Map<string, number>();
  get(tenantId: string): number | undefined {
    return this.versions.get(tenantId);
  }
  set(tenantId: string, version: number): void {
    this.versions.set(tenantId, version);
  }
}

export class KeyVersionRegistry {
  constructor(
    private readonly store: KeyVersionStore = new InMemoryKeyVersionStore(),
    /** The version a tenant starts at before any rotation. */
    private readonly initialVersion = 1,
  ) {}

  /** The tenant's current key version (the version a new write encrypts under). */
  currentVersion(tenantId: string): number {
    return this.store.get(tenantId) ?? this.initialVersion;
  }

  /**
   * Bump the tenant to the next version and return it. New writes immediately use it; existing
   * envelopes keep their old `key_version` and still decrypt (lazy re-encrypt on next write).
   * Bounded by the envelope's uint16 key-version field (ADR-0046).
   */
  rotate(tenantId: string): number {
    const next = this.currentVersion(tenantId) + 1;
    if (next > 0xffff) {
      throw new Error(
        `field-crypto: key version overflow for tenant ${JSON.stringify(tenantId)}`,
      );
    }
    this.store.set(tenantId, next);
    return next;
  }
}
