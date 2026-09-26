// Integration proof for the append-only, WORM-anchored audit chain (ADR-0052/0014).
// Runs the REAL `withTenant` + the REAL `0001_audit_chain.sql` migration against PGlite (a true
// Postgres with FORCE RLS, SET ROLE, advisory locks, jsonb), with a `LocalArtifactStore` standing
// in for the WORM bucket. No network, no live cloud. Tamper is simulated as the BYPASSRLS superuser
// (a DB-level compromise / bug), exactly the adversary an immutable audit trail must remain evident
// against — the `app` role itself is provably denied UPDATE/DELETE by the migration's withheld GRANT.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID, generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  buildChain,
  canonicalize,
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { LocalArtifactStore } from "./store.local.ts";
import {
  buildArtifactKey,
  type ArtifactMeta,
  type ArtifactObject,
  type ArtifactStore,
  type PutOptions,
} from "./store.ts";
import { AuditChainStore, verifyAnchorSignature } from "./chain-store.ts";
import { Ed25519AnchorSigner } from "./anchor-signer.ts";

let tp: TestPg;
let migrationSql: string;
let tmpDir: string;
let store: LocalArtifactStore;
let chain: AuditChainStore;
/** A store whose anchors are SIGNED at mint (T-W2) with an ephemeral test keypair. */
let signedChain: AuditChainStore;
let anchorPubKey: KeyObject;

/** Reconstruct an anchor's WORM key the way `anchorKey` does (12-zero-padded length). */
function anchorKeyFor(accountId: string, length: number): string {
  return buildArtifactKey(
    accountId,
    "audit-chain",
    "anchors",
    `${String(length).padStart(12, "0")}.json`,
  );
}

const FIXED_NOW = (): Date => new Date("2026-06-27T00:00:00.000Z");

/** Versioned-store double whose mutable current pointer can be replaced or deleted independently. */
class RepointableVersionedStore implements ArtifactStore {
  readonly #versions = new Map<string, Map<string, ArtifactObject>>();
  readonly #current = new Map<string, string>();
  #next = 0;

  async put(
    key: string,
    body: Uint8Array,
    opts: PutOptions,
  ): Promise<ArtifactMeta> {
    const versionId = `version-${++this.#next}`;
    const object: ArtifactObject = {
      key,
      size: body.byteLength,
      versionId,
      retainUntil: opts.retainUntil,
      body,
    };
    const versions = this.#versions.get(key) ?? new Map();
    versions.set(versionId, object);
    this.#versions.set(key, versions);
    this.#current.set(key, versionId);
    return object;
  }

  async get(key: string, versionId?: string): Promise<ArtifactObject> {
    const selected = versionId ?? this.#current.get(key);
    const object =
      selected === undefined
        ? undefined
        : this.#versions.get(key)?.get(selected);
    if (object === undefined) throw new NotFoundError("artifact not found");
    return object;
  }

  async head(key: string, versionId?: string): Promise<ArtifactMeta | null> {
    try {
      return await this.get(key, versionId);
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }

  async extendRetention(
    key: string,
    retainUntil: Date,
    versionId?: string,
  ): Promise<ArtifactMeta> {
    const object = await this.get(key, versionId);
    return { ...object, retainUntil };
  }

  replaceCurrent(key: string, body: Uint8Array): void {
    const versionId = `replacement-${++this.#next}`;
    const versions = this.#versions.get(key) ?? new Map();
    versions.set(versionId, { key, size: body.byteLength, versionId, body });
    this.#versions.set(key, versions);
    this.#current.set(key, versionId);
  }

  deleteCurrent(key: string): void {
    this.#current.delete(key);
  }
}

async function seed(
  accountId: string,
  payloads: readonly JsonValue[],
): Promise<void> {
  for (const payload of payloads) await chain.append(accountId, payload);
}

beforeAll(async () => {
  const m1 = await Bun.file(
    new URL("./migrations/0001_audit_chain.sql", import.meta.url),
  ).text();
  // 0003 DROP+CREATEs the tenant-isolation policy with the pgbouncer/pooler NULLIF hardening
  // (ADR-0006 append-only — 0001 already shipped, so the hardening is a follow-up migration, never
  // an edit to 0001); it also touches locked_version, which this standalone table's schema doesn't
  // have, so it's concatenated for the drift-guard TEXT check below only, never exec'd here — the
  // composed compliance-edition test (assemble.integration.test.ts) proves it applies live.
  const m3 = await Bun.file(
    new URL("./migrations/0003_rls_nullif.sql", import.meta.url),
  ).text();
  const m4 = await Bun.file(
    new URL("./migrations/0004_artifact_versions.sql", import.meta.url),
  ).text();
  migrationSql = m1 + m3 + m4;
  tp = await newTestPg();
  await tp.exec(m1);
  await tp.exec(m4);
  tmpDir = await mkdtemp(join(tmpdir(), "audit-worm-chain-"));
  store = new LocalArtifactStore(tmpDir);
  chain = new AuditChainStore({ db: tp.pg, store, now: FIXED_NOW });
  // Ephemeral test keypair — a real anchor key is NEVER generated or committed here.
  const kp = generateKeyPairSync("ed25519");
  anchorPubKey = kp.publicKey;
  signedChain = new AuditChainStore({
    db: tp.pg,
    store,
    now: FIXED_NOW,
    signer: new Ed25519AnchorSigner("test-anchor-key", kp.privateKey),
  });
}, 120_000); // PGlite WASM init can be slow under parallel CI load — generous hook timeout.

afterAll(async () => {
  // Guard: if beforeAll threw before these were assigned, don't mask the real error with a
  // "path must be a string" from rm(undefined) / a close() on undefined.
  if (tp) await tp.close();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("AuditChainStore — append + anchor + verify", () => {
  test("appends build a sequential, hash-linked, anchored chain that verifies", async () => {
    const acct = randomUUID();
    const r0 = await chain.append(acct, { event: "tenant.created", v: 1 });
    const r1 = await chain.append(acct, {
      event: "field.encrypted",
      column: "ssn",
    });
    const r2 = await chain.append(acct, { event: "version.locked", n: 3 });

    expect([r0.entry.seq, r1.entry.seq, r2.entry.seq]).toEqual([0, 1, 2]);
    expect(r0.entry.prevHash).toBeNull();
    expect(r1.entry.prevHash).toBe(r0.entry.hash);
    expect(r2.entry.prevHash).toBe(r1.entry.hash);

    // Each append re-anchors over the full chain; the anchor pins length + tip.
    expect(r2.anchor.length).toBe(3);
    expect(r2.anchor.tipHash).toBe(r2.entry.hash);
    expect(r2.anchor.genesisHash).toBe(r0.entry.hash);

    expect(await chain.verify(acct)).toEqual({ valid: true, brokenAt: null });
    expect((await chain.load(acct)).map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  test("payload round-trips through jsonb regardless of key order (canonical hashing)", async () => {
    const acct = randomUUID();
    // Keys deliberately out of order — canonicalize fixes order so hash == read-back hash.
    await chain.append(acct, { z: 1, a: { c: 3, b: 2 }, m: [3, 2, 1] });
    expect(await chain.verify(acct)).toEqual({ valid: true, brokenAt: null });
  });

  test("verification stays bound to the recorded anchor version after current replacement/delete marker", async () => {
    const versioned = new RepointableVersionedStore();
    const exactChain = new AuditChainStore({
      db: tp.pg,
      store: versioned,
      now: FIXED_NOW,
    });
    const replacedAccount = randomUUID();
    await exactChain.append(replacedAccount, { event: "original" });
    versioned.replaceCurrent(
      anchorKeyFor(replacedAccount, 1),
      new TextEncoder().encode('{"length":1,"tipHash":"tampered"}'),
    );
    expect(await exactChain.verify(replacedAccount)).toEqual({
      valid: true,
      brokenAt: null,
    });

    const deletedAccount = randomUUID();
    await exactChain.append(deletedAccount, { event: "original" });
    versioned.deleteCurrent(anchorKeyFor(deletedAccount, 1));
    expect(await exactChain.readCurrentAnchor(deletedAccount)).not.toBeNull();
  });

  test("a versioned legacy anchor without a recorded identity fails closed", async () => {
    const versioned = new RepointableVersionedStore();
    const exactChain = new AuditChainStore({
      db: tp.pg,
      store: versioned,
      now: FIXED_NOW,
    });
    const accountId = randomUUID();
    await exactChain.append(accountId, { event: "legacy-anchor" });
    await tp.exec(`
      ALTER TABLE worm_artifact_version DISABLE TRIGGER worm_artifact_version_no_delete;
      DELETE FROM worm_artifact_version WHERE account_id = '${accountId}';
      ALTER TABLE worm_artifact_version ENABLE TRIGGER worm_artifact_version_no_delete;
    `);

    expect(exactChain.verify(accountId)).rejects.toThrow(
      "no recorded provider version identity",
    );
  });

  test("an empty tenant chain verifies vacuously", async () => {
    expect(await chain.verify(randomUUID())).toEqual({
      valid: true,
      brokenAt: null,
    });
  });
});

describe("tamper evidence (TM-I)", () => {
  test("interior payload tamper breaks the chain at that index", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]);
    // Superuser rewrites an interior payload but cannot recompute every downstream hash.
    await tp.query(
      `UPDATE audit_chain_entry SET payload = '{"a":"forged"}'::jsonb
        WHERE account_id = $1 AND seq = $2`,
      [acct, 1],
    );
    expect(await chain.verify(acct)).toEqual({ valid: false, brokenAt: 1 });
  });

  test("tail truncation is caught — the WORM anchor outlives the dropped tail", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]); // anchors for length 1,2,3 in WORM
    await tp.query(
      `DELETE FROM audit_chain_entry WHERE account_id = $1 AND seq = $2`,
      [acct, 2],
    );
    // DB now has 2 rows, but an anchor for length 3 exists → truncation.
    const v = await chain.verify(acct);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(2);
  });

  test("a same-length, same-root, internally-consistent rewrite is still caught by the trusted tip", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]);
    // Forge a real, internally-consistent chain that SHARES the genesis payload (so neither the
    // hash recompute nor the genesis check can flag it) but diverges after — only the trusted
    // anchor tip betrays it.
    const forged = buildChain([{ a: 1 }, { forged: 1 }, { forged: 2 }]);
    for (const e of forged) {
      await tp.query(
        `UPDATE audit_chain_entry SET payload = $1::jsonb, prev_hash = $2, hash = $3
          WHERE account_id = $4 AND seq = $5`,
        [canonicalize(e.payload), e.prevHash, e.hash, acct, e.seq],
      );
    }
    expect(await chain.verify(acct)).toEqual({ valid: false, brokenAt: 2 });
  });
});

describe("immutability (TM-D, TM-H)", () => {
  test("the app role may append but is DENIED UPDATE and DELETE (append-only by GRANT)", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }]);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(
          `UPDATE audit_chain_entry SET hash = 'x' WHERE account_id = $1`,
          [acct],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`DELETE FROM audit_chain_entry WHERE account_id = $1`, [acct]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  test("a truncate-then-re-append cannot overwrite the original WORM anchor", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]); // anchor for length 3 is now immutable
    await tp.query(
      `DELETE FROM audit_chain_entry WHERE account_id = $1 AND seq = $2`,
      [acct, 2],
    );
    // Re-reaching length 3 with a different tip must hit the write-once anchor → ConflictError.
    await expect(chain.append(acct, { forged: "tip" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    // The failed append rolled back — the DB is back at length 2.
    expect((await chain.load(acct)).length).toBe(2);
  });

  test("UNIQUE(account_id, seq) rejects a forked entry (the no-fork belt under 23505)", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }]); // seq 0 taken
    let caught: unknown;
    try {
      await tp.query(
        `INSERT INTO audit_chain_entry (id, account_id, seq, prev_hash, payload, hash)
         VALUES ($1, $2, 0, NULL, '{}'::jsonb, 'h')`,
        [randomUUID(), acct],
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isUniqueViolation(caught)).toBe(true);
  });
});

describe("tenant isolation (ADR-0005, fail-closed)", () => {
  test("one tenant's chain never bleeds into another", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await seed(a, [{ a: 1 }, { a: 2 }]);
    await seed(b, [{ b: 1 }]);

    expect((await chain.load(a)).length).toBe(2);
    expect((await chain.load(b)).length).toBe(1);
    expect(await chain.verify(a)).toEqual({ valid: true, brokenAt: null });
    expect(await chain.verify(b)).toEqual({ valid: true, brokenAt: null });

    // Even an explicit cross-tenant id under tenant A's scope sees nothing (RLS, not the WHERE).
    const cross = await tp.asTenant(a, async (tx) => {
      const r = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_chain_entry WHERE account_id = $1`,
        [b],
      );
      return r.rows[0]?.n;
    });
    expect(cross).toBe(0);
  });
});

describe("getRowProof — single-row proof read (T-W1, fork f)", () => {
  test("a valid seq returns the entry, its per-length anchor, and the chain length", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]);
    const chainRows = await chain.load(acct);

    for (let seq = 0; seq < 3; seq++) {
      const proof = await chain.getRowProof(acct, seq);
      expect("unverifiable" in proof).toBe(false);
      if ("unverifiable" in proof) throw new Error("unexpected unverifiable");
      expect(proof.chainLength).toBe(3);
      expect(proof.entry.hash).toBe(chainRows[seq]!.hash);
      // Leg 2 relationship: anchor(seq+1).tipHash === row.hash (a genuine per-row commitment check).
      expect(proof.anchorForRow.length).toBe(seq + 1);
      expect(proof.anchorForRow.tipHash).toBe(chainRows[seq]!.hash);
    }
  });

  test("seq == length is rejected (L1 — the truncation-probe key anchor(length+1))", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }]); // length 2, valid seq 0..1
    await expect(chain.getRowProof(acct, 2)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("seq > length is rejected (out of range, never a silent unverifiable)", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }]);
    await expect(chain.getRowProof(acct, 99)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("a negative or non-integer seq is rejected", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }]);
    await expect(chain.getRowProof(acct, -1)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(chain.getRowProof(acct, 0.5)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  test("a missing per-length anchor fails closed to unverifiable (never a fabricated pass)", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }]); // anchors for length 1,2 exist
    // Superuser inserts seq 2 WITHOUT minting anchor(3) — the row exists but its per-length anchor
    // does not. getRowProof must fail closed, matching verify()'s direction.
    const rows = await chain.load(acct);
    await tp.query(
      `INSERT INTO audit_chain_entry (id, account_id, seq, prev_hash, payload, hash)
       VALUES ($1, $2, 2, $3, '{"c":3}'::jsonb, $4)`,
      [randomUUID(), acct, rows[1]!.hash, "deadbeef".repeat(8)],
    );
    const proof = await chain.getRowProof(acct, 2);
    expect(proof).toEqual({
      unverifiable: true,
      reason: "per-length anchor is missing for this row",
    });
  });

  test("tenant scoping — a seq valid for one account is out of range for a shorter one", async () => {
    const a = randomUUID();
    const b = randomUUID();
    await seed(a, [{ a: 1 }, { a: 2 }]); // length 2
    await seed(b, [{ b: 1 }]); // length 1

    const proofA = await chain.getRowProof(a, 1);
    expect("unverifiable" in proofA).toBe(false);
    if ("unverifiable" in proofA) throw new Error("unexpected unverifiable");
    expect(proofA.chainLength).toBe(2);

    // b's chain has length 1, so seq 1 is out of range under b's own tenant scope.
    await expect(chain.getRowProof(b, 1)).rejects.toBeInstanceOf(
      ValidationError,
    );
    // ...and each account's genesis proof is distinct.
    const gA = await chain.getRowProof(a, 0);
    const gB = await chain.getRowProof(b, 0);
    if ("unverifiable" in gA || "unverifiable" in gB) {
      throw new Error("unexpected unverifiable");
    }
    expect(gA.entry.hash).not.toBe(gB.entry.hash);
  });
});

describe("readCurrentAnchor — CurrentAnchorReader port (external-anchoring checkpoint)", () => {
  test("returns the current anchor's core bytes + length, byte-identical to the stored WORM anchor", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }, { c: 3 }]);
    const current = await chain.readCurrentAnchor(acct);
    if (current === null) throw new Error("unexpected null");
    expect(current.length).toBe(3);
    // Unsigned chain → the stored WORM body IS the canonical core: the exact bytes `verify` reads
    // back and the external message imprint is taken over.
    const stored = (await store.get(anchorKeyFor(acct, 3))).body;
    expect(current.anchorBytes).toEqual(stored);
  });

  test("a signed chain's reader bytes are the CORE only — sig/keyId stripped (the imprint seam)", async () => {
    const acct = randomUUID();
    await signedChain.append(acct, { a: 1 });
    const current = await signedChain.readCurrentAnchor(acct);
    if (current === null) throw new Error("unexpected null");
    const text = new TextDecoder().decode(current.anchorBytes);
    expect(text.includes("sig")).toBe(false);
    expect(text.includes("keyId")).toBe(false);
    // The stored signed body DOES carry sig/keyId — the reader must never anchor those bytes.
    const storedText = new TextDecoder().decode(
      (await store.get(anchorKeyFor(acct, 1))).body,
    );
    expect(storedText.includes("sig")).toBe(true);
  });

  test("an empty tenant chain → null (nothing to anchor)", async () => {
    expect(await chain.readCurrentAnchor(randomUUID())).toBeNull();
  });
});

describe("signed anchors (T-W2)", () => {
  test("a signed anchor round-trips: sign at mint, read back, crypto.verify passes", async () => {
    const acct = randomUUID();
    const r = await signedChain.append(acct, { event: "signed", v: 1 });
    // append returns the SIGNED anchor.
    expect(r.anchor.sig).toBeDefined();
    expect(r.anchor.keyId).toBe("test-anchor-key");

    const proof = await signedChain.getRowProof(acct, 0);
    if ("unverifiable" in proof) throw new Error("unexpected unverifiable");
    expect(proof.anchorForRow.sig).toBeDefined();
    expect(proof.anchorForRow.keyId).toBe("test-anchor-key");
    expect(verifyAnchorSignature(proof.anchorForRow, anchorPubKey, acct)).toBe(
      true,
    );
  });

  test("the signed anchor's CORE bytes are byte-identical to the legacy unsigned body (the seam)", async () => {
    // Same payload → same genesis hashes, so the unsigned body and the signed body's core must match.
    const acctU = randomUUID();
    await chain.append(acctU, { a: 1 });
    const uBody = new TextDecoder().decode(
      (await store.get(anchorKeyFor(acctU, 1))).body,
    );

    const acctS = randomUUID();
    await signedChain.append(acctS, { a: 1 });
    const sParsed = JSON.parse(
      new TextDecoder().decode((await store.get(anchorKeyFor(acctS, 1))).body),
    ) as Record<string, unknown>;
    expect(sParsed.sig).toBeDefined();
    expect(sParsed.keyId).toBe("test-anchor-key");

    const {
      sig: _sig,
      keyId: _keyId,
      sigV: _sigV,
      sigAccountId: _sigAccountId,
      ...sCore
    } = sParsed;
    // Strip the signature fields → the remaining core canonicalizes to the exact legacy bytes.
    expect(canonicalize(sCore as JsonValue)).toBe(uBody);
    expect(uBody.includes("sig")).toBe(false);
    expect(uBody.includes("keyId")).toBe(false);
  });

  test("a legacy UNSIGNED anchor stays structurally valid (verify passes; signature check is false)", async () => {
    const acct = randomUUID();
    await seed(acct, [{ a: 1 }, { b: 2 }]); // `chain` has no signer → unsigned anchors
    expect(await chain.verify(acct)).toEqual({ valid: true, brokenAt: null });
    const proof = await chain.getRowProof(acct, 1);
    if ("unverifiable" in proof) throw new Error("unexpected unverifiable");
    expect(proof.anchorForRow.sig).toBeUndefined();
    // No signature present → the signature check is false, but the chain still verifies structurally.
    expect(verifyAnchorSignature(proof.anchorForRow, anchorPubKey, acct)).toBe(
      false,
    );
  });

  test("a signed chain still verifies structurally (sig fields are ignored by verifyChain)", async () => {
    const acct = randomUUID();
    await signedChain.append(acct, { a: 1 });
    await signedChain.append(acct, { b: 2 });
    expect(await signedChain.verify(acct)).toEqual({
      valid: true,
      brokenAt: null,
    });
  });

  test("a forged anchor (tampered tip or wrong key) fails the signature check", async () => {
    const acct = randomUUID();
    await signedChain.append(acct, { a: 1 });
    const proof = await signedChain.getRowProof(acct, 0);
    if ("unverifiable" in proof) throw new Error("unexpected unverifiable");

    // Tamper the tip: the signature was over the original core, so it no longer verifies.
    const tampered = { ...proof.anchorForRow, tipHash: "f".repeat(64) };
    expect(verifyAnchorSignature(tampered, anchorPubKey, acct)).toBe(false);

    // A different public key never verifies this signature.
    const otherPub = generateKeyPairSync("ed25519").publicKey;
    expect(verifyAnchorSignature(proof.anchorForRow, otherPub, acct)).toBe(
      false,
    );

    // A valid signed anchor from this tenant cannot be replayed as another tenant's commitment.
    expect(
      verifyAnchorSignature(proof.anchorForRow, anchorPubKey, randomUUID()),
    ).toBe(false);
  });
});

describe("migration shape (append-only by withheld GRANT)", () => {
  test("RLS mirrors buildTenantPolicySql but withholds the UPDATE/DELETE grant", () => {
    // Every ENABLE/FORCE/POLICY line from the canonical builder is present verbatim (drift guard)…
    for (const line of buildTenantPolicySql("audit_chain_entry").split("\n")) {
      if (line.startsWith("GRANT ")) continue; // …except the grant, which we intentionally narrow.
      expect(migrationSql).toContain(line);
    }
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT ON audit_chain_entry TO app;",
    );
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*\b(?:UPDATE|DELETE)\b[^;]*ON audit_chain_entry/i,
    );
  });
});
