import { describe, expect, test } from "bun:test";
import { digestSnapshotPayload } from "./anchor-sink.ts";

describe("digestSnapshotPayload — deterministic digest", () => {
  test("identical payload content digests to the same hex value", () => {
    const payload = { a: 1, b: { c: [1, 2, 3] } };
    expect(digestSnapshotPayload(payload)).toBe(digestSnapshotPayload(payload));
  });

  test("key order never changes the digest (canonicalize first)", () => {
    const a = digestSnapshotPayload({ x: 1, y: 2 });
    const b = digestSnapshotPayload({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  test("different content digests differently", () => {
    const a = digestSnapshotPayload({ status: "pass" });
    const b = digestSnapshotPayload({ status: "flagged" });
    expect(a).not.toBe(b);
  });

  test("emits a lowercase 64-hex SHA-256 digest", () => {
    expect(digestSnapshotPayload({ ok: true })).toMatch(/^[0-9a-f]{64}$/);
  });
});
