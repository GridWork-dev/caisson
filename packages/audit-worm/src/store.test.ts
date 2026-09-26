// Unit tests for the `ArtifactStore` port guard + the `LocalArtifactStore` backend (ADR-0054).
// Filesystem-only, no network: every key is tenant-scoped + traversal-safe, writes are WORM
// (write-once), `get` round-trips body + retention, and `head` is a non-throwing presence probe.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import {
  ArtifactExistsError,
  assertSafeKey,
  buildArtifactKey,
} from "./store.ts";
import { LocalArtifactStore } from "./store.local.ts";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const NUL = String.fromCharCode(0);

describe("assertSafeKey (ADR-0054 tenant scoping + traversal guard)", () => {
  test("accepts a well-formed {account_id}/… key and returns the tenant prefix", () => {
    const { accountId, key } = assertSafeKey(`${ACCOUNT_A}/anchors/3.json`);
    expect(accountId).toBe(ACCOUNT_A);
    expect(key).toBe(`${ACCOUNT_A}/anchors/3.json`);
  });

  test.each([
    ["", "empty"],
    [`${ACCOUNT_A}/a${NUL}b`, "null byte"],
    [`${ACCOUNT_A}/../${ACCOUNT_B}/x`, "parent traversal"],
    [`${ACCOUNT_A}/./x`, "dot segment"],
    [`/${ACCOUNT_A}/x`, "absolute path"],
    [`${ACCOUNT_A}\\x`, "backslash"],
    ["C:/evil/x", "windows drive"],
    ["not-a-uuid/x", "non-UUID prefix"],
    [ACCOUNT_A, "prefix only, no sub-path"],
    [`${ACCOUNT_A}//x`, "empty mid-segment"],
  ])("rejects %p (%s)", (badKey) => {
    expect(() => assertSafeKey(badKey)).toThrow(ValidationError);
  });
});

describe("buildArtifactKey", () => {
  test("joins a tenant id and segments into a safe key", () => {
    expect(buildArtifactKey(ACCOUNT_A, "anchors", "7.json")).toBe(
      `${ACCOUNT_A}/anchors/7.json`,
    );
  });

  test.each([
    [() => buildArtifactKey("not-a-uuid", "x"), "bad account id"],
    [() => buildArtifactKey(ACCOUNT_A), "no segments"],
    [() => buildArtifactKey(ACCOUNT_A, ".."), "traversal segment"],
    [() => buildArtifactKey(ACCOUNT_A, "a/b"), "separator in segment"],
    [() => buildArtifactKey(ACCOUNT_A, ""), "empty segment"],
  ])("rejects %#: %s", (build) => {
    expect(build).toThrow(ValidationError);
  });
});

describe("LocalArtifactStore (ADR-0054 dev/test backend)", () => {
  let root: string;
  let store: LocalArtifactStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "audit-worm-"));
    store = new LocalArtifactStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const RETAIN = new Date(Date.UTC(2033, 0, 1));

  test("put → get round-trips the body, size, and retention", async () => {
    const key = buildArtifactKey(ACCOUNT_A, "evidence", "pack.bin");
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    const putMeta = await store.put(key, body, {
      retainUntil: RETAIN,
      contentType: "application/octet-stream",
    });
    expect(putMeta.size).toBe(5);
    expect(putMeta.versionId).toBeUndefined();
    expect(putMeta.retainUntil?.toISOString()).toBe(RETAIN.toISOString());

    const got = await store.get(key);
    expect([...got.body]).toEqual([1, 2, 3, 4, 5]);
    expect(got.size).toBe(5);
    expect(got.versionId).toBeUndefined();
    expect(got.contentType).toBe("application/octet-stream");
    expect(got.retainUntil?.toISOString()).toBe(RETAIN.toISOString());
  });

  test("put is write-once — a second put to the same key throws ArtifactExistsError", async () => {
    const key = buildArtifactKey(ACCOUNT_A, "anchors", "1.json");
    await store.put(key, new Uint8Array([9]), { retainUntil: RETAIN });
    await expect(
      store.put(key, new Uint8Array([8]), { retainUntil: RETAIN }),
    ).rejects.toBeInstanceOf(ArtifactExistsError);
    // The original bytes survive the rejected overwrite (WORM).
    const got = await store.get(key);
    expect([...got.body]).toEqual([9]);
  });

  test("get on an absent key throws NotFoundError", async () => {
    const key = buildArtifactKey(ACCOUNT_A, "missing.bin");
    await expect(store.get(key)).rejects.toBeInstanceOf(NotFoundError);
  });

  test("head returns metadata for a present key and null for an absent one", async () => {
    const key = buildArtifactKey(ACCOUNT_A, "head", "probe.bin");
    expect(await store.head(key)).toBeNull();
    await store.put(key, new Uint8Array([1, 2]), { retainUntil: RETAIN });
    const meta = await store.head(key);
    expect(meta).not.toBeNull();
    expect(meta?.size).toBe(2);
    expect(meta?.retainUntil?.toISOString()).toBe(RETAIN.toISOString());
  });

  test("keys are tenant-isolated — same suffix under two accounts are distinct artifacts", async () => {
    const keyA = buildArtifactKey(ACCOUNT_A, "shared", "x.bin");
    const keyB = buildArtifactKey(ACCOUNT_B, "shared", "x.bin");
    await store.put(keyA, new Uint8Array([0xaa]), { retainUntil: RETAIN });
    await store.put(keyB, new Uint8Array([0xbb]), { retainUntil: RETAIN });
    expect([...(await store.get(keyA)).body]).toEqual([0xaa]);
    expect([...(await store.get(keyB)).body]).toEqual([0xbb]);
  });

  test("the store rejects an unsafe key before touching the filesystem", async () => {
    await expect(
      store.put(`${ACCOUNT_A}/../escape.bin`, new Uint8Array([1]), {
        retainUntil: RETAIN,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // ADR-0202: the dev backend mirrors the extend-only CONTRACT (strictly-later or throw) so the
  // seam is exercised identically — but per ADR-0054 it only RECORDS the date, never enforces it.
  describe("extendRetention (records, never enforces)", () => {
    const LATER = new Date(Date.UTC(2034, 0, 1));
    const EARLIER = new Date(Date.UTC(2032, 0, 1));

    test("a strictly-later date updates the recorded retainUntil (round-trips through head)", async () => {
      const key = buildArtifactKey(ACCOUNT_A, "evidence", "extend.bin");
      await store.put(key, new Uint8Array([1]), { retainUntil: RETAIN });
      const meta = await store.extendRetention(key, LATER);
      expect(meta.retainUntil?.toISOString()).toBe(LATER.toISOString());
      const head = await store.head(key);
      expect(head?.retainUntil?.toISOString()).toBe(LATER.toISOString());
    });

    test("equal and earlier dates are refused fail-closed; the recorded date survives", async () => {
      const key = buildArtifactKey(ACCOUNT_A, "evidence", "no-shorten.bin");
      await store.put(key, new Uint8Array([1]), { retainUntil: RETAIN });
      await expect(store.extendRetention(key, RETAIN)).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(store.extendRetention(key, EARLIER)).rejects.toBeInstanceOf(
        ValidationError,
      );
      const head = await store.head(key);
      expect(head?.retainUntil?.toISOString()).toBe(RETAIN.toISOString());
    });

    test("a missing key is NotFoundError — mirrors get()", async () => {
      await expect(
        store.extendRetention(buildArtifactKey(ACCOUNT_A, "absent.bin"), LATER),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test("an artifact whose sidecar is gone gains a retention (extend from nothing)", async () => {
      const key = buildArtifactKey(ACCOUNT_A, "evidence", "no-sidecar.bin");
      await store.put(key, new Uint8Array([1, 2]), { retainUntil: RETAIN });
      await rm(join(root, ".meta", `${key}.json`));
      const meta = await store.extendRetention(key, EARLIER); // no current lock → any date extends
      expect(meta.retainUntil?.toISOString()).toBe(EARLIER.toISOString());
      expect(meta.size).toBe(2);
    });

    test("an invalid date is refused", async () => {
      const key = buildArtifactKey(ACCOUNT_A, "evidence", "nan.bin");
      await store.put(key, new Uint8Array([1]), { retainUntil: RETAIN });
      await expect(
        store.extendRetention(key, new Date(Number.NaN)),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
