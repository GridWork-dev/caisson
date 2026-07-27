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

  test("erases the driver-shaped copy allocated after the abort check but before the outer settle", async () => {
    // The shape this guard actually exists for. Every shipped driver re-checks the abort signal
    // after its SDK await and self-wipes if it already fired, so a driver that has ALREADY passed
    // that check is the only way a fulfilled late value reaches the budget: the check passes, the
    // driver allocates its caller-owned Buffer copy, and only then does the deadline settle the
    // outer promise. The hosted Azure path widens that window with an extra getProtectedKey await.
    const sdkPlaintext = Buffer.alloc(32, 0x6e);
    let driverCopy: Buffer | undefined;
    let openSdk!: () => void;
    let openWrapper!: () => void;
    const sdkCall = new Promise<void>((resolve) => {
      openSdk = resolve;
    });
    const wrapperHop = new Promise<void>((resolve) => {
      openWrapper = resolve;
    });
    const caller = new AbortController();

    const pending = withKmsOperationBudget(
      { abortSignal: caller.signal, timeoutMs: 60_000 },
      async (signal) => {
        await sdkCall;
        // The driver's own post-await guard — passes, because the abort has not fired yet.
        if (signal.aborted) throw new Error("driver guard fired too early");
        driverCopy = Buffer.from(sdkPlaintext);
        // One more hop before the value reaches the budget. The hosted site wrapper's own async
        // unwrapKey is exactly this, and it is where the deadline gets its chance.
        await wrapperHop;
        return driverCopy;
      },
    );

    openSdk();
    // Let the driver's guard pass and its copy get allocated...
    await Promise.resolve();
    await Promise.resolve();
    expect(driverCopy).toBeDefined();
    expect(driverCopy?.equals(Buffer.alloc(32, 0x6e))).toBe(true);

    // ...then lose the race, and only afterwards deliver the value.
    caller.abort(new Error("field-crypto: KMS operation aborted"));
    await expect(pending).rejects.toThrow(/aborted/i);

    openWrapper();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(driverCopy).toBeDefined();
    expect(driverCopy?.equals(Buffer.alloc(32))).toBe(true);
    // The driver's own source buffer is its business; only the escaped copy is ours to erase.
    expect(sdkPlaintext.equals(Buffer.alloc(32, 0x6e))).toBe(true);
  });

  test("does not lose an abort raised synchronously inside the operation", async () => {
    // An async function runs synchronously up to its first await, so it can cancel inside the
    // window between being invoked and the race subscribing. If that abort is dropped, the race
    // resolves with a live DEK despite the cancellation — the caller believes it was cancelled and
    // the key bytes are handed out anyway.
    const source = new AbortController();
    const plaintext = Buffer.alloc(32, 0x7a);

    await expect(
      withKmsOperationBudget({ abortSignal: source.signal }, async () => {
        source.abort(new Error("request cancelled"));
        return plaintext;
      }),
    ).rejects.toThrow(/cancelled/i);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(plaintext.equals(Buffer.alloc(32))).toBe(true);
  });

  test("does not orphan the abort rejection when a non-async operation throws synchronously", async () => {
    // The GCP driver passes a NON-async arrow that evaluates `remainingTimeoutMs()` as an argument
    // expression. On a spent budget that call aborts the controller and then throws, all before the
    // helper reaches `await race`. The abort listener has already rejected `race`, so unless that
    // rejection is disposed of it never gets a subscriber: an unhandled rejection, which Node
    // terminates the process over by default. The caller catching the thrown error is not enough.
    const orphaned: unknown[] = [];
    const capture = (reason: unknown): void => {
      orphaned.push(reason);
    };
    process.on("unhandledRejection", capture);
    try {
      // Exactly kms-gcp.ts's shape: an expression-body, NON-async arrow whose argument list
      // evaluates `remainingTimeoutMs()` before the SDK call is ever made. `timeoutMs: 1` is spent
      // by the helper's own synchronous setup, so `remaining < 1` aborts and throws every run.
      const fakeEncrypt = (_args: { timeout: number }): Promise<Buffer> =>
        Promise.resolve(Buffer.alloc(32, 0x11));
      await expect(
        withKmsOperationBudget(
          { timeoutMs: 1 },
          (_signal, remainingTimeoutMs) =>
            fakeEncrypt({ timeout: remainingTimeoutMs() }),
        ),
      ).rejects.toThrow(/exceeded/i);
      // Give the microtask queue and the rejection-tracking turn time to fire.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(orphaned).toEqual([]);
    } finally {
      process.off("unhandledRejection", capture);
    }
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
