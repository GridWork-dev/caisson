// SSRF guard (ADR-0002 security floor: "resolve-then-pin for SSRF"). ONE home for the outbound-URL
// safety policy every buyer-/config-supplied destination shares — the alerting webhook/Slack/Telegram
// transports (@caisson-sh/alerting) and the ai-kit provider baseUrl (@caisson-sh/ai-kit). Both used to carry
// near-identical LITERAL-only denylists that never resolved the hostname, so a public host that resolved
// (or DNS-rebound) to 127.0.0.1 / a private range / 169.254.169.254 (cloud metadata) sailed through
// (Strix vuln-0004, CWE-918). This module keeps the cheap literal check AND adds the resolve-time
// re-check the floor requires.
//
// POLICY: https only · no credentials-in-URL · a private/loopback/link-local/metadata DENYLIST (NOT a
// host allowlist — buyers may point a webhook / self-hosted gateway at ANY public https host).
//
// Two seams, by cost:
//   - `assertSafePublicUrl` (SYNC): parse + https + no-creds + LITERAL-host denylist. Cheap, no DNS —
//     use at the Zod config boundary and as a fast pre-check.
//   - `assertSafePublicUrlResolved` (ASYNC): the sync check THEN a DNS lookup that re-checks EVERY
//     resolved A/AAAA against the denylist. Use at the outbound-fetch seam, where DNS rebinding matters.
//
// Because only the ORIGINAL host is rechecked, a followed 3xx redirect to a private host would bypass
// the guard — so every guarded fetch (ssrfGuardedFetch here, and the alerting transports) forces
// `redirect: "error"`; our sinks (webhooks / provider APIs) never legitimately redirect.
//
// ponytail: resolve-and-block, not connect-time IP-pinning. Bun's native fetch() exposes no
// dispatcher/custom-lookup hook to pin the socket to the checked IP while keeping TLS SNI/cert
// verification against the original hostname (oven-sh/bun#27890), so a narrow TOCTOU window remains: an
// adversary who can flip a DNS answer BETWEEN this resolve and fetch()'s own resolve. Closing it fully
// needs a hand-rolled Bun.connect() HTTP/TLS client — deferred; the realistic attack (a static A record
// pointing a public name at a private IP) is fully blocked here. Upgrade path: a pinned dispatcher.
import { lookup } from "node:dns/promises";
import { ValidationError } from "./errors.ts";
import { fetchWithTimeout, type FetchTimeoutOptions } from "./fetch.ts";

/**
 * True if `hostname` (as returned by `URL.hostname`, or a resolved A/AAAA literal) is a
 * loopback/private/link-local/metadata address. The WHATWG URL parser canonicalizes
 * decimal/octal/hex/short-form IPv4 to dotted-quad before this ever sees it, so those encodings are
 * covered for free. IPv6 arrives bracketed from `URL.hostname` and bare from `dns.lookup`, so both
 * forms are handled.
 */
export function isPrivateAddress(hostname: string): boolean {
  let host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  // Strip IPv6 brackets (present on URL.hostname, absent on a dns.lookup result).
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.includes(":")) {
    return (
      host === "::1" || // loopback
      host === "::" || // unspecified
      /^f[cd]/.test(host) || // fc00::/7 unique-local
      /^fe[89ab]/.test(host) || // fe80::/10 link-local
      host.startsWith("::ffff:") // IPv4-mapped — never a real destination host, reject wholesale
    );
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m === null) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 || // 0.0.0.0/8 (incl. 0.0.0.0)
    a === 127 || // 127/8 loopback
    a === 10 || // 10/8 private
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT (Tailscale tailnet; Alibaba metadata 100.100.100.200)
    (a === 198 && (b === 18 || b === 19)) || // 198.18/15 benchmarking (non-routable)
    (a === 169 && b === 254) // 169.254/16 link-local (incl. cloud metadata 169.254.169.254)
  );
}

/**
 * SYNC guard: parse `raw`, require https, reject credentials-in-URL, reject a LITERAL private/loopback
 * host. Cheap (no DNS). Returns the parsed URL so a caller can reuse the hostname.
 *
 * @throws ValidationError on a malformed URL, a non-https scheme, credentials in the URL, or a
 *   private-range / localhost / `.local` LITERAL host.
 */
export function assertSafePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("URL rejected: malformed URL");
  }
  if (url.protocol !== "https:") {
    // https only — blocks http:, and data:/file:/javascript: smuggling. Never auto-prepend a scheme.
    throw new ValidationError("URL rejected: non-https scheme", {
      scheme: url.protocol,
    });
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError("URL rejected: credentials in URL");
  }
  if (isPrivateAddress(url.hostname)) {
    throw new ValidationError("URL rejected: private/loopback host", {
      host: url.hostname,
    });
  }
  return url;
}

/**
 * ASYNC re-check: resolve `hostname` and reject if ANY resolved address is private/loopback/link-local/
 * metadata. This is the DNS-rebinding defense — a public name whose A/AAAA record points into private
 * space is caught here, where the literal check cannot see it.
 *
 * @throws ValidationError if resolution fails or any resolved address is private.
 */
export async function assertResolvedHostPublic(
  hostname: string,
): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    // Fail closed: a name we cannot resolve is not a name we send tenant/operator data to.
    throw new ValidationError("URL rejected: host did not resolve");
  }
  if (addresses.length === 0) {
    // Fail closed: a lookup that succeeds but returns nothing must NOT skip the loop and pass — an
    // empty answer is unverifiable, not public.
    throw new ValidationError("URL rejected: host did not resolve");
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new ValidationError(
        "URL rejected: host resolves to a private address",
        { host: hostname },
      );
    }
  }
}

/**
 * ASYNC full guard for an outbound-fetch seam: the sync {@link assertSafePublicUrl} check THEN the
 * {@link assertResolvedHostPublic} DNS re-check. Use immediately before an outbound fetch to a
 * buyer-/config-supplied URL.
 */
export async function assertSafePublicUrlResolved(raw: string): Promise<void> {
  const url = assertSafePublicUrl(raw);
  await assertResolvedHostPublic(url.hostname);
}

/**
 * A `fetch`-shaped wrapper that runs the full async SSRF guard on the request URL before delegating to
 * {@link fetchWithTimeout} (the ADR-0002 outbound floor — never bare `fetch`). This is the seam for a
 * client whose outbound call we don't own (the Vercel AI SDK adapters accept a custom `fetch`), so a
 * config-supplied provider `baseUrl` gets the same resolve-time re-check the alerting transports apply at
 * their own fetch call. Typed to the AI SDK's `FetchFunction` shape (a plain
 * `(input, init) => Promise<Response>`), NOT `typeof fetch` — the latter also requires a `preconnect`
 * method a wrapper has no business implementing.
 *
 * The `fetchWithTimeout` guard bounds time-to-headers (its timer clears once `fetch()` resolves on header
 * receipt), so a long-lived streaming LLM body is NOT truncated — only a hung/slow connect is; the
 * caller's own signal is merged, not dropped. `redirect: "error"` is forced: only the ORIGINAL host is
 * resolve-rechecked, so following a 3xx would let a public host we cleared redirect the request to a
 * private/metadata host AFTER the check — the classic SSRF-guard bypass. Our sinks (webhooks / provider
 * APIs) return 2xx and never legitimately redirect, so refusing is safe and closes the vector entirely.
 */
export const ssrfGuardedFetch = async (
  input: string | URL | Request,
  init?: RequestInit,
  // Optional deadline override: a caller that owns a configured timeout (the ai-kit provider
  // transport's 60s floor) threads it here; omitted → fetchWithTimeout's 10s default. A third
  // optional param stays assignable to the AI SDK's two-arg `FetchFunction` shape.
  timeout?: FetchTimeoutOptions,
): Promise<Response> => {
  const target =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  await assertSafePublicUrlResolved(target);
  return fetchWithTimeout(input, { ...init, redirect: "error" }, timeout);
};
