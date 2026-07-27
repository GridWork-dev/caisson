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
  // A best-effort wipe must never escape. This runs inside a `.then` whose promise is not awaited
  // and has no catch, so a throw here — `fill` on a detached ArrayBuffer, a hostile getter reached
  // by `Reflect.get` — would surface as an unhandled rejection and terminate the process, on the
  // abort path, under exactly the load the budget exists to survive.
  try {
    if (value instanceof Uint8Array) {
      value.fill(0);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    // `result` is defensive: today every driver converts its SDK response to a Buffer before
    // returning, so only the bare and `{ plaintextKey }` shapes reach here.
    for (const field of ["plaintextKey", "result"]) {
      const inner: unknown = Reflect.get(value, field);
      if (inner instanceof Uint8Array) inner.fill(0);
    }
  } catch {
    // Nothing actionable: the value is unreachable garbage either way.
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
    let settled = false;
    let settleResolve!: (value: T) => void;
    let settleReject!: (reason: unknown) => void;
    const race = new Promise<T>((resolve, reject) => {
      settleResolve = resolve;
      settleReject = reject;
    });
    const rejectOnAbort = (): void => {
      settled = true;
      settleReject(abortReason(controller.signal));
    };
    // Subscribe BEFORE invoking the operation. An async function runs synchronously up to its
    // first await, so it can abort within that window — `remainingTimeoutMs()` aborts the
    // controller directly when the budget is already spent. With the listener installed after the
    // call, that abort had no subscriber: `settled` stayed false and the race then resolved with
    // live key material despite the cancellation, unwiped. Abort events do not replay for
    // listeners added later.
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });

    let pending: Promise<T>;
    try {
      pending = operation(controller.signal, remainingTimeoutMs);
    } catch (error) {
      controller.signal.removeEventListener("abort", rejectOnAbort);
      // An operation can abort the controller and THEN throw synchronously: a non-async driver
      // arrow that evaluates `remainingTimeoutMs()` as an argument expression does exactly that on
      // a spent budget (kms-gcp.ts passes `{ timeout: remainingTimeoutMs() }` to the SDK). By this
      // point `rejectOnAbort` has already rejected `race`, and rethrowing here skips
      // `return await race`, so nothing would ever subscribe to it — an unhandled rejection, which
      // Node terminates the process over by default. The caller still receives `error`; this only
      // discards the duplicate rejection that lost the race to the throw.
      void race.catch(() => {});
      throw error;
    }

    pending
      .then((value) => {
        // Losing the race must not mean losing the key bytes.
        if (settled) {
          wipeLateResult(value);
          return;
        }
        settled = true;
        settleResolve(value);
      }, settleReject)
      .finally(() => {
        controller.signal.removeEventListener("abort", rejectOnAbort);
      });

    return await race;
  } finally {
    clearTimeout(timer);
    source?.removeEventListener("abort", forwardAbort);
  }
}
