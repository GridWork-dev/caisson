// PII engine contract (ADR-0063/0013). The golden fixture `__golden__/pii-redact.json` pins the
// deterministic mask + hash redaction over a fixed multi-PII input (matched with BLESS unset); the
// reversible-tokenize path round-trips through field-crypto. Independent assertions backstop the
// golden — proving detection + redaction + restore, not just that a file exists.
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { DerivedKeyProvider } from "@caisson-sh/field-crypto";
import { derivedContext } from "@caisson-sh/field-crypto";
import {
  PII_KINDS,
  detectPii,
  detokenizePii,
  maskPii,
  redactPii,
  tokenizePii,
  type PiiMatch,
  type PiiToken,
} from "./pii.ts";

const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);
const ctxFor = (tenant: string) =>
  derivedContext(new DerivedKeyProvider(MASTER, SALT), tenant);

// A fixed, synthetic (non-real) sample carrying one of each detected PII class.
const SAMPLE =
  "Contact jane.doe@example.com or 404-555-0100. SSN 123-45-6789. Card 4111 1111 1111 1111 expires soon.";

describe("detectPii", () => {
  test("finds one of each PII class, non-overlapping", () => {
    const kinds = detectPii(SAMPLE)
      .map((m) => m.kind)
      .sort();
    expect(kinds).toEqual([...PII_KINDS].sort());
  });

  test("a Luhn-INVALID card number is not detected as a credit card", () => {
    // 4111 1111 1111 1112 fails the Luhn check.
    const found = detectPii("pay 4111 1111 1111 1112 now").filter(
      (m) => m.kind === "credit_card",
    );
    expect(found).toHaveLength(0);
  });

  test("SSN (3-2-4) and phone (3-3-4) never collide", () => {
    const kinds = detectPii("ssn 123-45-6789 vs tel 404-555-0100").map(
      (m) => m.kind,
    );
    expect(kinds).toContain("ssn");
    expect(kinds).toContain("phone");
  });

  test("rejects oversized text before detector regexes run", () => {
    expect(() => detectPii("x".repeat(100_001))).toThrow(
      /text exceeds 100000 code units/u,
    );
  });
});

describe("redactPii — mask / hash (irreversible)", () => {
  test("mask leaves no raw PII", () => {
    const { redacted } = redactPii(SAMPLE, "mask");
    expect(redacted).not.toContain("jane.doe@example.com");
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).not.toContain("4111");
    expect(redacted).toContain("[EMAIL]");
    expect(redacted).toContain("[CREDIT_CARD]");
  });

  test("hash is stable per value (equal inputs → equal tokens)", () => {
    const a = redactPii("a@b.com", "hash").redacted;
    const b = redactPii("a@b.com", "hash").redacted;
    expect(a).toBe(b);
    expect(a).not.toContain("a@b.com");
  });

  test("matches the committed golden (BLESS unset)", () => {
    const masked = redactPii(SAMPLE, "mask").redacted;
    const hashed = redactPii(SAMPLE, "hash").redacted;
    const detected = detectPii(SAMPLE).map(({ kind, start, end }) => ({
      kind,
      start,
      end,
    }));
    matchGolden(import.meta.url, "pii-redact", {
      input: SAMPLE,
      masked,
      hashed,
      detected,
    });
  });

  test("bounds caller-supplied match work before rewriting", () => {
    const matches: PiiMatch[] = Array.from({ length: 1_025 }, () => ({
      kind: "email",
      value: "a@b.com",
      start: 0,
      end: 1,
    }));
    expect(() => maskPii("x", matches)).toThrow(
      /PII match count exceeds 1024/u,
    );
  });
});

describe("tokenizePii — reversible round-trip via field-crypto", () => {
  test("tokenize hides PII; detokenize restores it under the same tenant context", () => {
    const ctx = ctxFor("acct_a");
    const { redacted, tokens } = tokenizePii(SAMPLE, ctx);

    // The redacted text carries opaque placeholders, never raw PII.
    expect(redacted).not.toContain("jane.doe@example.com");
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).toContain("[[PII:email:");
    expect(tokens.length).toBe(PII_KINDS.length);
    // Sealed envelopes never contain the plaintext.
    for (const t of tokens) expect(t.sealed).not.toContain("@example.com");

    // Simulate a provider echoing the redacted text back; detokenize restores the originals.
    const restored = detokenizePii(redacted, tokens, ctx);
    expect(restored).toBe(SAMPLE);
  });

  test("a placeholder dropped by the provider is never re-injected", () => {
    const ctx = ctxFor("acct_a");
    const { tokens } = tokenizePii("mail me a@b.com", ctx);
    // Provider returned text without the placeholder.
    expect(detokenizePii("no PII here", tokens, ctx)).toBe("no PII here");
  });

  test("another tenant's context cannot restore the tokens (cross-tenant isolation)", () => {
    const a = ctxFor("acct_a");
    const b = ctxFor("acct_b");
    const { redacted, tokens } = tokenizePii("ssn 123-45-6789", a);
    expect(() => detokenizePii(redacted, tokens, b)).toThrow();
  });

  test("bounds token count and envelope text before decoding", () => {
    const ctx = ctxFor("acct_a");
    const token: PiiToken = {
      placeholder: "[[PII:email:0]]",
      kind: "email",
      sealed: "not-an-envelope",
    };
    expect(() =>
      detokenizePii(token.placeholder, Array(1_025).fill(token), ctx),
    ).toThrow(/PII token count exceeds 1024/u);
    expect(() =>
      detokenizePii(
        token.placeholder,
        [{ ...token, sealed: "A".repeat(262_145) }],
        ctx,
      ),
    ).toThrow(/PII envelope exceeds 262144 code units/u);
  });
});
