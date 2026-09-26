// Integration proof for the chain-evidenced escalation helper (ADR-0202, composing ADR-0052).
// Same harness as chain-store.integration.test.ts: the REAL `withTenant` + the REAL migration on
// PGlite, a `LocalArtifactStore` standing in for the WORM bucket — no network, no live cloud. Pins
// the ADR-0202 evidence contract: one successful escalation appends exactly ONE verifiable
// `retention.escalated` record; a throwing chain sink fails the whole call LOUDLY (evidence gap —
// the store change is already applied, by design); tenant-prefix and COMPLIANCE-capability
// violations are refused fail-closed before anything mutates.
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
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import { buildArtifactKey, type ArtifactStore } from "./store.ts";
import { LocalArtifactStore } from "./store.local.ts";
import {
  COMPLIANCE_ACKNOWLEDGEMENT,
  irreversibleComplianceOptIn,
} from "./store.s3.ts";
import { AuditChainStore } from "./chain-store.ts";
import { escalateRetention } from "./retention-escalation.ts";

let tp: TestPg;
let tmpDir: string;
let store: LocalArtifactStore;
let chain: AuditChainStore;

const FIXED_NOW = (): Date => new Date("2026-07-01T00:00:00.000Z");
const RETAIN = new Date(Date.UTC(2033, 0, 1));
const LATER = new Date(Date.UTC(2034, 0, 1));

beforeAll(async () => {
  const migrationSql = await Bun.file(
    new URL("./migrations/0001_audit_chain.sql", import.meta.url),
  ).text();
  const versionIdentitySql = await Bun.file(
    new URL("./migrations/0004_artifact_versions.sql", import.meta.url),
  ).text();
  tp = await newTestPg();
  await tp.exec(migrationSql + versionIdentitySql);
  tmpDir = await mkdtemp(join(tmpdir(), "audit-worm-escalation-"));
  store = new LocalArtifactStore(tmpDir);
  chain = new AuditChainStore({ db: tp.pg, store, now: FIXED_NOW });
}, 120_000); // PGlite WASM init can be slow under parallel CI load — generous hook timeout.

afterAll(async () => {
  if (tp) await tp.close();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("escalateRetention (ADR-0202 — chain-evidenced, fail-closed)", () => {
  test("a versioned artifact requires its durably recorded identity", async () => {
    const acct = randomUUID();
    const key = buildArtifactKey(acct, "evidence", "versioned.bin");
    await store.put(key, new Uint8Array([4]), { retainUntil: RETAIN });
    const versionedStore: ArtifactStore = {
      put: store.put.bind(store),
      get: store.get.bind(store),
      head: async (artifactKey, versionId) => {
        void versionId;
        const meta = await store.head(artifactKey);
        return meta === null ? null : { ...meta, versionId: "provider-v1" };
      },
      extendRetention: async (artifactKey, retainUntil, versionId) => {
        void versionId;
        return {
          ...(await store.extendRetention(artifactKey, retainUntil)),
          versionId: "provider-v1",
        };
      },
    };

    await expect(
      escalateRetention({
        store: versionedStore,
        chain,
        accountId: acct,
        key,
        retainUntil: LATER,
      }),
    ).rejects.toThrow("recorded provider version identity");
  });

  test("a successful extend appends exactly ONE verifiable retention.escalated record", async () => {
    const acct = randomUUID();
    const key = buildArtifactKey(acct, "evidence", "pack.bin");
    await store.put(key, new Uint8Array([1, 2, 3]), { retainUntil: RETAIN });

    const { meta, evidence } = await escalateRetention({
      store,
      chain,
      accountId: acct,
      key,
      retainUntil: LATER,
    });

    // The authoritative new date for the caller's `retain_until` row (row==object).
    expect(meta.retainUntil?.toISOString()).toBe(LATER.toISOString());

    const entries = await chain.load(acct);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.payload).toEqual({
      kind: "retention.escalated",
      key,
      from: RETAIN.toISOString(),
      to: LATER.toISOString(),
      // The local double declares no mode — the record never claims one it cannot back.
      mode: null,
    });
    expect(evidence.entry.hash).toBe(entries[0]!.hash);
    expect(await chain.verify(acct)).toEqual({ valid: true, brokenAt: null });
  });

  test("a throwing chain sink fails the call loudly — the store change is ALREADY applied (evidence gap)", async () => {
    const acct = randomUUID();
    const key = buildArtifactKey(acct, "evidence", "gap.bin");
    await store.put(key, new Uint8Array([9]), { retainUntil: RETAIN });

    const failingChain: Pick<AuditChainStore, "append"> = {
      append: () => Promise.reject(new Error("chain sink down")),
    };
    await expect(
      escalateRetention({
        store,
        chain: failingChain,
        accountId: acct,
        key,
        retainUntil: LATER,
      }),
    ).rejects.toBeInstanceOf(InternalError);

    // Fail-LOUD, not rollback: the retention extension landed before the append failed. A re-run
    // would now refuse on the equal date — the gap is reconciled at the chain, not by retrying.
    const head = await store.head(key);
    expect(head?.retainUntil?.toISOString()).toBe(LATER.toISOString());
  });

  test("a key outside the tenant's prefix is refused before any I/O", async () => {
    const acct = randomUUID();
    const foreignKey = buildArtifactKey(randomUUID(), "evidence", "steal.bin");
    await expect(
      escalateRetention({
        store,
        chain,
        accountId: acct,
        key: foreignKey,
        retainUntil: LATER,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await chain.load(acct)).toHaveLength(0);
  });

  test("a COMPLIANCE request against a store without the capability is refused, never downgraded", async () => {
    const acct = randomUUID();
    const key = buildArtifactKey(acct, "evidence", "harden.bin");
    await store.put(key, new Uint8Array([7]), { retainUntil: RETAIN });

    // The opt-in factory itself works anywhere (env gates live in the store) — the refusal here is
    // the CAPABILITY check: LocalArtifactStore cannot honestly harden a mode.
    const optIn = irreversibleComplianceOptIn({
      bucket: "caisson-worm",
      acknowledgement: COMPLIANCE_ACKNOWLEDGEMENT,
      deployment: "production",
    });
    await expect(
      escalateRetention({
        store,
        chain,
        accountId: acct,
        key,
        retainUntil: LATER,
        compliance: { optIn },
      }),
    ).rejects.toThrow(/cannot escalate to COMPLIANCE/);

    // Nothing mutated and nothing was appended: the refusal is fail-closed, not a fallback extend.
    const head = await store.head(key);
    expect(head?.retainUntil?.toISOString()).toBe(RETAIN.toISOString());
    expect(await chain.load(acct)).toHaveLength(0);
  });
});
