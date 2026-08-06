import { describe, expect, test } from "bun:test";
import {
  DerivedKeyProvider,
  derivedContext,
  openField,
} from "@caisson/field-crypto";
import { MAX_KEY_VERSION } from "@caisson/field-crypto/browser";
import { detectPii, detokenizePii, redactPii, tokenizePii } from "./pii.ts";
import {
  detokenizePiiAsync,
  hashPiiAsync,
  tokenizePiiAsync,
  type BrowserPiiCryptoContext,
} from "./pii-browser.ts";
import { maskPii } from "./pii-core.ts";

const MASTER = new Uint8Array(32).fill(0x11);
const SALT = new Uint8Array(32).fill(0x22);
const SAMPLE =
  "Contact jane.doe@example.com or 404-555-0100. SSN 123-45-6789. Card 4111 1111 1111 1111.";

function browserContext(
  tenantId = "acct_a",
  currentVersion = 1,
): BrowserPiiCryptoContext {
  return { tenantId, masterKey: MASTER, salt: SALT, currentVersion };
}

function nodeContext(tenantId = "acct_a") {
  return derivedContext(
    new DerivedKeyProvider(Buffer.from(MASTER), Buffer.from(SALT)),
    tenantId,
  );
}

function base64Url(wire: string): string {
  return wire.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

describe("browser PII redaction", () => {
  test("shares detection/masking and WebCrypto hash matches the sync golden", async () => {
    expect(maskPii(SAMPLE)).toBe(redactPii(SAMPLE, "mask").redacted);
    expect(await hashPiiAsync(SAMPLE)).toBe(redactPii(SAMPLE, "hash").redacted);
    expect(detectPii(SAMPLE)).toHaveLength(4);
  });

  test("returns no raw match collection from irreversible transforms", async () => {
    expect(maskPii("mail a@b.com")).toBe("mail [EMAIL]");
    expect(await hashPiiAsync("mail a@b.com")).not.toContain("a@b.com");
  });
});

describe("browser PII tokenization", () => {
  test("round-trips in browser and interoperates both ways with the sync API", async () => {
    const browser = await tokenizePiiAsync(SAMPLE, browserContext());
    expect(browser.redacted).not.toContain("jane.doe@example.com");
    expect(JSON.stringify(browser)).not.toContain("jane.doe@example.com");
    expect(
      await detokenizePiiAsync(
        browser.redacted,
        browser.tokens,
        browserContext(),
      ),
    ).toBe(SAMPLE);
    expect(detokenizePii(browser.redacted, browser.tokens, nodeContext())).toBe(
      SAMPLE,
    );

    const node = tokenizePii(SAMPLE, nodeContext());
    expect(
      await detokenizePiiAsync(node.redacted, node.tokens, browserContext()),
    ).toBe(SAMPLE);
  });

  test("draws a fresh internal nonce and has no caller nonce parameter", async () => {
    const first = await tokenizePiiAsync("mail a@b.com", browserContext());
    const second = await tokenizePiiAsync("mail a@b.com", browserContext());
    expect(first.tokens[0]?.sealed).not.toBe(second.tokens[0]?.sealed);
    expect(tokenizePiiAsync.length).toBe(2);
  });

  test("accepts base64url envelopes and uses the embedded old version on open", async () => {
    const tokenized = await tokenizePiiAsync(
      "mail a@b.com",
      browserContext("acct_a", 1),
    );
    const tokens = tokenized.tokens.map((token) => ({
      ...token,
      sealed: base64Url(token.sealed),
    }));
    expect(
      await detokenizePiiAsync(
        tokenized.redacted,
        tokens,
        browserContext("acct_a", 2),
      ),
    ).toBe("mail a@b.com");
  });

  test("fails closed for another tenant and never re-injects a dropped placeholder", async () => {
    const tokenized = await tokenizePiiAsync("mail a@b.com", browserContext());
    await expect(
      detokenizePiiAsync(
        tokenized.redacted,
        tokenized.tokens,
        browserContext("acct_b"),
      ),
    ).rejects.toThrow();
    expect(
      await detokenizePiiAsync(
        "no PII here",
        tokenized.tokens,
        browserContext(),
      ),
    ).toBe("no PII here");
  });

  test("binds every token to the guardrails PII column context", async () => {
    const tokenized = await tokenizePiiAsync("mail a@b.com", browserContext());
    expect(() =>
      openField(nodeContext(), "another.column", tokenized.tokens[0]!.sealed),
    ).toThrow();
  });

  test("validates injected material and key-version bounds before sealing", async () => {
    await expect(
      tokenizePiiAsync("mail a@b.com", {
        ...browserContext(),
        tenantId: "",
      }),
    ).rejects.toThrow(/tenantId/u);
    await expect(
      tokenizePiiAsync("mail a@b.com", {
        ...browserContext(),
        masterKey: new Uint8Array(31),
      }),
    ).rejects.toThrow(/MASTER_FIELD_KEY/u);
    await expect(
      tokenizePiiAsync("mail a@b.com", {
        ...browserContext(),
        salt: new Uint8Array(31),
      }),
    ).rejects.toThrow(/FIELD_CRYPTO_SALT/u);
    for (const invalid of [0, MAX_KEY_VERSION + 1, 1.5]) {
      await expect(
        tokenizePiiAsync("mail a@b.com", browserContext("acct_a", invalid)),
      ).rejects.toThrow(/keyVersion/u);
    }
  });
});
