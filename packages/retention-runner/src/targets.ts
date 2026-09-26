// @caisson-sh/retention-runner — the `ErasureTarget` port + drivers (ADR-0135). Each target erases one
// store for a subject; `runErasure` (`./run-erasure.ts`) fans out to every registered target with
// per-target error isolation. The three reference drivers below take an INJECTED minimal client
// interface — the real S3/pg client is a documented seam (no aws-sdk/pg dependency in this package,
// mirroring `@caisson-sh/email`'s Resend seam and ADR-0150's single-install invariant).

/** The port every erasure store implements: erase one subject's data, or throw. */
export interface ErasureTarget {
  name: string;
  erase(subjectId: string, tenantId: string): Promise<void>;
}

/** A test driver that records every erase call in memory; never throws, never touches a store. */
export interface CaptureTarget extends ErasureTarget {
  readonly erased: readonly { subjectId: string; tenantId: string }[];
}

/** In-memory `ErasureTarget` for tests + the framework-agnostic reference. */
export function createCaptureTarget(name = "capture"): CaptureTarget {
  const erased: { subjectId: string; tenantId: string }[] = [];
  return {
    name,
    async erase(subjectId: string, tenantId: string): Promise<void> {
      erased.push({ subjectId, tenantId });
    },
    get erased(): readonly { subjectId: string; tenantId: string }[] {
      return erased;
    },
  };
}

/** The minimal injected client an object-storage erasure target needs — a single purge call. */
export interface ObjectStorageClient {
  purge(subjectId: string, tenantId: string): Promise<void>;
}

/** Reference target: object-storage purge. The real S3 (or equivalent) client is injected. */
export function createObjectStorageTarget(deps: {
  client: ObjectStorageClient;
}): ErasureTarget {
  return {
    name: "object-storage-purge",
    erase: (subjectId, tenantId) => deps.client.purge(subjectId, tenantId),
  };
}

/** The minimal injected client a cascade-delete erasure target needs — a single delete call. */
export interface CascadeDbClient {
  cascadeDelete(subjectId: string, tenantId: string): Promise<void>;
}

/** Reference target: cascade DB delete. The real pg (or equivalent) client is injected. */
export function createCascadeDbTarget(deps: {
  client: CascadeDbClient;
}): ErasureTarget {
  return {
    name: "cascade-db-delete",
    erase: (subjectId, tenantId) =>
      deps.client.cascadeDelete(subjectId, tenantId),
  };
}

/** The minimal injected client an orphan-record-sweep erasure target needs. */
export interface OrphanSweepClient {
  sweep(subjectId: string, tenantId: string): Promise<void>;
}

/** Reference target: orphan-record sweep (rows a cascade delete's FK graph doesn't reach). */
export function createOrphanSweepTarget(deps: {
  client: OrphanSweepClient;
}): ErasureTarget {
  return {
    name: "orphan-record-sweep",
    erase: (subjectId, tenantId) => deps.client.sweep(subjectId, tenantId),
  };
}
