// src/store.local.ts — the dev/test `ArtifactStore` backend (ADR-0054). A filesystem store that is
// WORM in the dimension tests need — write-once (a second `put` to a key is `ArtifactExistsError`,
// enforced at the fs level with the `wx` open flag so it is TOCTOU-safe) — but, by design, IGNORES
// the retention TIME-lock: `retainUntil` is echoed back and persisted as sidecar metadata, never
// enforced as immutability. Local artifacts are NOT court-admissible; only the S3 Object-Lock backend
// (ADR-0051) is. The body lives at `<root>/<key>`; metadata at `<root>/.meta/<key>.json` — a subtree
// that cannot collide with a `{account_id}/…` key, since every real key's first segment is a UUID.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import {
  ArtifactExistsError,
  assertSafeKey,
  assertValidRetainUntil,
  type ArtifactMeta,
  type ArtifactObject,
  type ArtifactStore,
  type PutOptions,
} from "./store.ts";

interface SidecarMeta {
  size: number;
  retainUntil: string;
  contentType?: string;
}

function hasErrnoCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

export class LocalArtifactStore implements ArtifactStore {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  async put(
    key: string,
    body: Uint8Array,
    opts: PutOptions,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    const path = this.bodyPath(key);
    await mkdir(dirname(path), { recursive: true });
    try {
      // `wx` = create-or-fail: the write-once guard is the open flag itself, so two racing puts
      // cannot both succeed (TOCTOU-safe). EEXIST → the WORM `ArtifactExistsError`.
      await writeFile(path, body, { flag: "wx" });
    } catch (err) {
      if (hasErrnoCode(err, "EEXIST")) throw new ArtifactExistsError(key);
      throw err;
    }
    const sidecar: SidecarMeta = {
      size: body.byteLength,
      retainUntil: opts.retainUntil.toISOString(),
    };
    if (opts.contentType !== undefined) sidecar.contentType = opts.contentType;
    const metaPath = this.metaPath(key);
    await mkdir(dirname(metaPath), { recursive: true });
    await writeFile(metaPath, JSON.stringify(sidecar));

    const meta: ArtifactMeta = {
      key,
      size: body.byteLength,
      retainUntil: opts.retainUntil,
    };
    if (opts.contentType !== undefined) meta.contentType = opts.contentType;
    return meta;
  }

  async get(key: string): Promise<ArtifactObject> {
    assertSafeKey(key);
    let body: Buffer;
    try {
      body = await readFile(this.bodyPath(key));
    } catch (err) {
      if (hasErrnoCode(err, "ENOENT")) {
        throw new NotFoundError("artifact not found", { key });
      }
      throw err;
    }
    const meta = await this.readMeta(key, body.byteLength);
    return { ...meta, body: new Uint8Array(body) };
  }

  async head(key: string): Promise<ArtifactMeta | null> {
    assertSafeKey(key);
    let size: number;
    try {
      size = (await stat(this.bodyPath(key))).size;
    } catch (err) {
      if (hasErrnoCode(err, "ENOENT")) return null;
      throw err;
    }
    return this.readMeta(key, size);
  }

  /**
   * Extend the RECORDED retention with the same strictly-later guard as the prod backend
   * (ADR-0202), so the dev seam exercises the identical contract — but, per ADR-0054, this backend
   * never ENFORCES the lock: the sidecar date is bookkeeping, not immutability, and local artifacts
   * stay court-inadmissible by design. Only the S3 Object-Lock backend makes the date binding.
   */
  async extendRetention(
    key: string,
    newRetainUntil: Date,
  ): Promise<ArtifactMeta> {
    assertSafeKey(key);
    assertValidRetainUntil(newRetainUntil);
    const meta = await this.head(key);
    if (meta === null) throw new NotFoundError("artifact not found", { key });
    if (
      meta.retainUntil !== undefined &&
      newRetainUntil.getTime() <= meta.retainUntil.getTime()
    ) {
      throw new ValidationError(
        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than the current lock (ADR-0202)",
        {
          key,
          currentRetainUntil: meta.retainUntil.toISOString(),
          requested: newRetainUntil.toISOString(),
        },
      );
    }
    // Rewrite the sidecar in its existing format (a missing/corrupt sidecar = extend-from-nothing,
    // mirroring the S3 backend's unlocked-object case).
    const sidecar: SidecarMeta = {
      size: meta.size,
      retainUntil: newRetainUntil.toISOString(),
    };
    if (meta.contentType !== undefined) sidecar.contentType = meta.contentType;
    const metaPath = this.metaPath(key);
    await mkdir(dirname(metaPath), { recursive: true });
    await writeFile(metaPath, JSON.stringify(sidecar));
    return { ...meta, retainUntil: newRetainUntil };
  }

  // --- internal ---

  private bodyPath(key: string): string {
    const p = resolve(this.root, key);
    if (p !== this.root && !p.startsWith(this.root + sep)) {
      // Belt: `assertSafeKey` already rejects traversal, but never trust a path that escaped root.
      throw new ValidationError(
        "resolved artifact path escapes the store root",
      );
    }
    return p;
  }

  private metaPath(key: string): string {
    return join(this.root, ".meta", `${key}.json`);
  }

  /** Read the sidecar for `retainUntil`/`contentType`; a missing/corrupt sidecar yields body-only
   *  metadata (retention is non-authoritative on the local backend by design). */
  private async readMeta(key: string, size: number): Promise<ArtifactMeta> {
    const meta: ArtifactMeta = { key, size };
    try {
      const raw = await readFile(this.metaPath(key), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") {
        const rec = parsed as Record<string, unknown>;
        if (typeof rec.retainUntil === "string") {
          const d = new Date(rec.retainUntil);
          if (!Number.isNaN(d.getTime())) meta.retainUntil = d;
        }
        if (typeof rec.contentType === "string")
          meta.contentType = rec.contentType;
      }
    } catch {
      // No sidecar (or unreadable) → metadata is just the key + on-disk size.
    }
    return meta;
  }
}
