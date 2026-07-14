// Unit tests for the external-anchoring types + schemas + helpers (T1). Pure, network-free.
import { describe, expect, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { assertSafeKey } from "./store.ts";
import {
  anchorOutboxRowSchema,
  anchorReceiptKey,
  anchorReceiptSchema,
  sha256Hex,
  targetId,
  timestampReceiptSchema,
  transparencyTargetSchema,
  type AnchorReceipt,
  type TransparencyTarget,
} from "./anchor-transparency.ts";

const DIGEST = createHash("sha256").update("anchor-bytes").digest("hex");
const ACCT = randomUUID();

const validReceipt = (): AnchorReceipt => ({
  accountId: ACCT,
  target: "tsa",
  anchorLength: 3,
  anchorDigest: DIGEST,
  grade: "trusted-timestamped",
  receipt: {
    authority: "https://tsa.example",
    algorithm: "rfc3161",
    hashAlgorithm: "sha256",
    messageImprint: DIGEST,
    token: "dG9rZW4=",
    timestampedAt: "2026-07-13T00:00:00.000Z",
  },
  receiptedAt: "2026-07-13T00:00:01.000Z",
});

describe("anchorReceiptSchema", () => {
  test("a valid receipt round-trips", () => {
    expect(anchorReceiptSchema.parse(validReceipt())).toEqual(validReceipt());
  });

  test("an extra field is rejected (.strict())", () => {
    const r = { ...validReceipt(), sneaky: 1 };
    expect(anchorReceiptSchema.safeParse(r).success).toBe(false);
  });

  test("a grade outside the two-literal enum is rejected", () => {
    const r = { ...validReceipt(), grade: "self-attested" };
    expect(anchorReceiptSchema.safeParse(r).success).toBe(false);
  });

  test("a non-hex anchorDigest is rejected", () => {
    const r = { ...validReceipt(), anchorDigest: "not-a-digest" };
    expect(anchorReceiptSchema.safeParse(r).success).toBe(false);
  });
});

describe("timestampReceiptSchema", () => {
  test("wrong algorithm literal is rejected", () => {
    const t = { ...validReceipt().receipt, algorithm: "rfc9999" };
    expect(timestampReceiptSchema.safeParse(t).success).toBe(false);
  });
});

describe("transparencyTargetSchema (Fork F)", () => {
  test("a well-formed TSA target parses", () => {
    const t: TransparencyTarget = {
      kind: "tsa",
      url: "https://freetsa.org/tsr",
      grade: "trusted-timestamped",
    };
    expect(transparencyTargetSchema.parse(t)).toEqual(t);
    expect(targetId(t)).toBe("tsa");
  });

  test("a TSA target can NOT claim the externally-transparent grade (v1 honesty lock)", () => {
    const t = {
      kind: "tsa",
      url: "https://freetsa.org/tsr",
      grade: "externally-transparent",
    };
    expect(transparencyTargetSchema.safeParse(t).success).toBe(false);
  });

  test("a non-https url is rejected", () => {
    const t = { kind: "tsa", url: "not a url", grade: "trusted-timestamped" };
    expect(transparencyTargetSchema.safeParse(t).success).toBe(false);
  });
});

describe("anchorOutboxRowSchema", () => {
  const row = {
    id: randomUUID(),
    accountId: ACCT,
    target: "tsa",
    anchorLength: 5,
    anchorDigest: DIGEST,
    state: "pending",
    lastError: null,
    createdAt: new Date("2026-07-13T00:00:00.000Z"),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
  };

  test("a valid row parses", () => {
    expect(anchorOutboxRowSchema.parse(row).state).toBe("pending");
  });

  test("an unknown state is rejected", () => {
    expect(
      anchorOutboxRowSchema.safeParse({ ...row, state: "in_flight" }).success,
    ).toBe(false);
  });
});

describe("helpers", () => {
  test("anchorReceiptKey is a tenant-safe, zero-padded, target-suffixed WORM key", () => {
    const key = anchorReceiptKey(ACCT, 3, "tsa");
    expect(key).toBe(`${ACCT}/audit-chain/receipts/000000000003.tsa.json`);
    // must survive the WORM key-safety guard verbatim
    expect(assertSafeKey(key).key).toBe(key);
  });

  test("sha256Hex matches node's own digest", () => {
    const bytes = new TextEncoder().encode("hello");
    expect(sha256Hex(bytes)).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });
});
