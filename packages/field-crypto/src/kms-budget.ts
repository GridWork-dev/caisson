import { ValidationError } from "@caisson/kernel";
import type { KmsOperationOptions } from "./kms-port.ts";

const DEFAULT_KMS_OPERATION_TIMEOUT_MS = 15_000;

function operationTimeoutMs(options?: KmsOperationOptions): number {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_KMS_OPERATION_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new ValidationError(
      "field-crypto: KMS operation timeout must be a positive integer",
    );
  }
  return timeoutMs;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("field-crypto: KMS operation aborted");
}

/**
 * Erase a provider result that arrived after the caller-facing race already settled.
 *
 * Without this the abort path leaks: `rejectOnAbort` settles the outer promise, the underlying
 * provider call keeps running, and its eventual value — a plaintext DEK for `decryptDataKey`, or
 * `{ plaintextKey }` for `generateDataKey` — is dropped for the GC with live key bytes in it.
 * Every driver routes through this budget, so the wipe belongs here rather than in each one.
 */
function wipeLateResult(value: unknown): void {
  if (value instanceof Uint8Array) {
    value.fill(0);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const field of ["plaintextKey", "result"]) {
    const inner: unknown = Reflect.get(value, field);
    if (inner instanceof Uint8Array) inner.fill(0);
  }
}

/**
 * Apply one caller-visible budget around a provider operation.
 *
 * `operation` also receives the derived signal and a remaining-time reader so native SDK
 * cancellation and deadlines remain active after the caller-facing race settles. GAX does not
 * accept AbortSignal, so its drivers consume the one diminishing budget across multi-RPC steps.
 */
export async function withKmsOperationBudget<T>(
  options: KmsOperationOptions | undefined,
  operation: (
    signal: AbortSignal,
    remainingTimeoutMs: () => number,
  ) => Promise<T>,
): Promise<T> {
  const timeoutMs = operationTimeoutMs(options);
  const deadlineAt = performance.now() + timeoutMs;
  const controller = new AbortController();
  const source = options?.abortSignal;
  const forwardAbort = (): void => {
    controller.abort(source === undefined ? undefined : abortReason(source));
  };

  if (source?.aborted === true) {
    forwardAbort();
  } else {
    source?.addEventListener("abort", forwardAbort, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort(
      new Error(`field-crypto: KMS operation exceeded ${String(timeoutMs)}ms`),
    );
  }, timeoutMs);
  const remainingTimeoutMs = (): number => {
    const remaining = deadlineAt - performance.now();
    if (remaining < 1) {
      if (!controller.signal.aborted) {
        controller.abort(
          new Error(
            `field-crypto: KMS operation exceeded ${String(timeoutMs)}ms`,
          ),
        );
      }
      throw abortReason(controller.signal);
    }
    return remaining;
  };

  try {
    if (controller.signal.aborted) {
      throw abortReason(controller.signal);
    }
    const pending = operation(controller.signal, remainingTimeoutMs);
    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      const rejectOnAbort = (): void => {
        settled = true;
        reject(abortReason(controller.signal));
      };
      controller.signal.addEventListener("abort", rejectOnAbort, {
        once: true,
      });
      pending
        .then((value) => {
          // Losing the race must not mean losing the key bytes.
          if (settled) {
            wipeLateResult(value);
            return;
          }
          settled = true;
          resolve(value);
        }, reject)
        .finally(() => {
          controller.signal.removeEventListener("abort", rejectOnAbort);
        });
    });
  } finally {
    clearTimeout(timer);
    source?.removeEventListener("abort", forwardAbort);
  }
}
