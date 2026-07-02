// `fetchWithTimeout` (ADR-0002). The native `AbortSignal.timeout()` helper is forbidden on Bun;
// use an explicit AbortController. Every outbound fetch in the library routes through this.

export interface FetchTimeoutOptions {
  /** Timeout in milliseconds before the request is aborted. Default 10s. */
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  { timeoutMs = 10_000 }: FetchTimeoutOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  // Merge (not replace) any caller-supplied signal — e.g. the AI SDK's stream-cancellation signal —
  // with the timeout, so caller-initiated abort still tears down the connection. AbortSignal.any is the
  // combinator (only AbortSignal.timeout() is the Bun-forbidden helper, per the header).
  const signal =
    init.signal != null
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
