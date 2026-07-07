// Thin fetch helpers shared by the read clients. Every outbound request routes through
// `fetchWithTimeout` (the Bun-safe timeout helper). Errors carry the status only — never a
// response body, which could echo a token or PII. Secrets travel in headers, never in the URL.
import type { fetchWithTimeout } from "@caisson/kernel";

export type Fetcher = typeof fetchWithTimeout;

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchText(
  fetchImpl: Fetcher,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const res = await fetchImpl(
    url,
    { redirect: "follow", ...init },
    { timeoutMs },
  );
  if (!res.ok) throw new Error(`request failed: ${String(res.status)}`);
  return res.text();
}

export async function fetchJson<T>(
  fetchImpl: Fetcher,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const res = await fetchImpl(
    url,
    { redirect: "follow", ...init },
    { timeoutMs },
  );
  if (!res.ok) throw new Error(`request failed: ${String(res.status)}`);
  const data: unknown = await res.json();
  return data as T;
}
