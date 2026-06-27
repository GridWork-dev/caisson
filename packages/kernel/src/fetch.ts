// `fetchWithTimeout` (ADR-0002). The native `AbortSignal.timeout()` helper is forbidden on Bun;
// use an explicit AbortController. Every outbound fetch in the library routes through this.

export interface FetchTimeoutOptions {
  /** Timeout in milliseconds before the request is aborted. Default 10s. */
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  { timeoutMs = 10_000 }: FetchTimeoutOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
