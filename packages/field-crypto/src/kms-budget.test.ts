import { describe, expect, test } from "bun:test";
import { withKmsOperationBudget } from "./kms-budget.ts";

/**
 * The budget races a deadline against a provider call. When the deadline wins, the provider call
 * keeps running and eventually resolves — with key material, for the two operations that return
 * it. These prove that late value is erased rather than dropped for the GC.
 */
describe("withKmsOperationBudget late-result erasure", () => {
  test("erases a late plaintext DEK buffer once the deadline already won", async () => {
    const latePlaintext = Buffer.alloc(32, 0x7a);
    let releaseProvider!: () => void;
    const provider = new Promise<Buffer>((resolve) => {
      releaseProvider = () => resolve(latePlaintext);
    });

    await expect(
      withKmsOperationBudget({ timeoutMs: 5 }, async () => provider),
    ).rejects.toThrow(/exceeded 5ms/i);
    expect(latePlaintext.equals(Buffer.alloc(32, 0x7a))).toBe(true);

    releaseProvider();
    await provider;
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(latePlaintext.equals(Buffer.alloc(32))).toBe(true);
  });

  test("erases the plaintextKey of a late generateDataKey result", async () => {
    const latePlaintext = Buffer.alloc(32, 0x5c);
    const lateWrapped = Buffer.alloc(48, 0x11);
    let releaseProvider!: () => void;
    const provider = new Promise<{
      plaintextKey: Buffer;
      wrappedKey: Buffer;
    }>((resolve) => {
      releaseProvider = () =>
        resolve({ plaintextKey: latePlaintext, wrappedKey: lateWrapped });
    });

    await expect(
      withKmsOperationBudget({ timeoutMs: 5 }, async () => provider),
    ).rejects.toThrow(/exceeded 5ms/i);

    releaseProvider();
    await provider;
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(latePlaintext.equals(Buffer.alloc(32))).toBe(true);
    // The wrapped form is not secret and is deliberately left intact.
    expect(lateWrapped.equals(Buffer.alloc(48, 0x11))).toBe(true);
  });

  test("returns the value untouched when the operation wins the race", async () => {
    const plaintext = Buffer.alloc(32, 0x3d);
    const result = await withKmsOperationBudget(
      { timeoutMs: 5_000 },
      async () => plaintext,
    );
    expect(result.equals(Buffer.alloc(32, 0x3d))).toBe(true);
  });
});
