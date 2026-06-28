// At-rest field-crypto over the per-tenant local store (ADR-0055/0064 — threat TM-REST + the absorbed
// ADR-0073 cross-tenant assertion = SPEC exit-clause 5). In-process, deterministic, NO network: real
// per-tenant `bun:sqlite` files under a temp root, sealed/opened through the composed field-crypto
// seam. Proves the round-trip, that a tenant-B file cannot open a tenant-A ciphertext (auth-fail),
// that a cross-tenant query is unexpressible, and that a missing local master secret fails closed.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AtRestStore } from "./at-rest.ts";

/** A deterministic local-deployment master-key source (32-byte hex each). NEVER a real key. */
const ENV: Record<string, string | undefined> = {
  MASTER_FIELD_KEY: "11".repeat(32),
  FIELD_CRYPTO_SALT: "22".repeat(32),
};

const COL = "note.secret";
const NOTES_DDL =
  "CREATE TABLE notes (id TEXT PRIMARY KEY, secret TEXT NOT NULL)";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "caisson-at-rest-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("at-rest field-crypto over the per-tenant local store (ADR-0055/0064 — TM-REST)", () => {
  test("round-trip: a sealed column persists to the tenant's file and opens back to plaintext", () => {
    const store = AtRestStore.fromEnv(root, ENV);
    const plaintext = "patient SSN 123-45-6789";

    const db = store.openDb("tenant-a");
    try {
      db.exec(NOTES_DDL);
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO notes (id, secret) VALUES (?, ?)").run(
        id,
        store.seal("tenant-a", COL, plaintext),
      );

      const row = db
        .prepare("SELECT secret FROM notes WHERE id = ?")
        .get(id) as { secret: string } | null;
      expect(row).not.toBeNull();
      // Ground truth: the value on disk is a self-describing envelope, not the plaintext.
      expect(row!.secret).not.toBe(plaintext);
      // Round-trip under the same tenant context → plaintext.
      expect(store.open("tenant-a", COL, row!.secret)).toBe(plaintext);
    } finally {
      db.close();
    }
  });

  test("a tenant-B file cannot open a tenant-A ciphertext (AEAD auth-fail) — TM-REST", () => {
    const store = AtRestStore.fromEnv(root, ENV);
    const secret = "A-only secret";

    // Tenant A seals + persists into its OWN isolated file.
    const a = store.openDb("tenant-a");
    a.exec(NOTES_DDL);
    a.prepare("INSERT INTO notes (id, secret) VALUES (?, ?)").run(
      crypto.randomUUID(),
      store.seal("tenant-a", COL, secret),
    );
    const aCipher = (
      a.prepare("SELECT secret FROM notes").get() as { secret: string } | null
    )?.secret;
    a.close();
    expect(aCipher).toBeDefined();

    // Simulated exfiltration: the attacker copies A's ciphertext bytes into tenant B's OWN file.
    const b = store.openDb("tenant-b");
    b.exec(NOTES_DDL);
    b.prepare("INSERT INTO notes (id, secret) VALUES (?, ?)").run(
      crypto.randomUUID(),
      aCipher!,
    );
    const bCipher = (b.prepare("SELECT secret FROM notes").get() as {
      secret: string;
    } | null)!.secret;
    b.close();

    // Tenant B derives a DIFFERENT per-tenant key (HKDF `info`) AND a different AAD (`tenant_id`
    // bound) → the AEAD tag fails to authenticate. An exfiltrated tenant-B file cannot decrypt a
    // copied-in tenant-A row.
    expect(() => store.open("tenant-b", COL, bCipher)).toThrow();
    // ...and tenant A still opens its own ciphertext (the round-trip is intact).
    expect(store.open("tenant-a", COL, aCipher!)).toBe(secret);
  });

  test("opening tenant B's DB file cannot return tenant A's rows (cross-tenant query unexpressible) — exit-clause 5", () => {
    const store = AtRestStore.fromEnv(root, ENV);

    const a = store.openDb("tenant-a");
    a.exec(NOTES_DDL);
    a.prepare("INSERT INTO notes (id, secret) VALUES (?, ?)").run(
      crypto.randomUUID(),
      store.seal("tenant-a", COL, "alpha"),
    );
    a.close();

    // Tenant B opens its OWN physical file — tenant A's table/rows do not exist in this connection.
    const b = store.openDb("tenant-b");
    try {
      expect(() => b.prepare("SELECT secret FROM notes").all()).toThrow();
    } finally {
      b.close();
    }

    // Two distinct files actually landed under the tenant-data root (ADR-0073 physical isolation).
    expect(readdirSync(root).sort()).toEqual(["tenant-a.db", "tenant-b.db"]);
  });

  test("the local master-key source is required — a missing secret fails closed at construction", () => {
    // No MASTER_FIELD_KEY/FIELD_CRYPTO_SALT → DerivedKeyProvider.fromEnv throws (never a silent
    // unkeyed at-rest write).
    expect(() => AtRestStore.fromEnv(root, {})).toThrow();
  });
});
