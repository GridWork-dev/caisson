// src/privacy/egress-guard.ts — the runtime EGRESS GUARD that enforces the privacy policy
// (`policy.ts`) on every outbound request (ADR-0064).
//
// It WRAPS the kernel `fetchWithTimeout` — the single audited outbound chokepoint (the native
// `AbortSignal.timeout` is forbidden on Bun) — and refuses to forward a request unless the policy
// allowlists the host. The decision is the same `assertAllowed` whether a caller fetches directly
// (`.fetch`) or installs the guard as another runtime's outbound hook (`.guardedFetch`, the shape
// transformers.js's `env.fetch` accepts — so the on-device model loader and the rented backend
// route through this guard verbatim).
//
// FAIL-CLOSED-TO-OFFLINE is the whole point:
//   - empty allowlist ⇒ EVERY host blocked (zero egress);
//   - a non-allowlisted host ⇒ blocked — there is NO silent fallback to a hosted provider;
//   - a non-https scheme ⇒ blocked (no `http:`, `data:`, `file:`, `javascript:` egress);
//   - a malformed URL ⇒ blocked;
//   - the block is raised BEFORE `fetchWithTimeout` is ever reached, so no socket is opened and no
//     bytes leave the device. Error `details` carry only the host + scheme — never the full URL,
//     whose path/query could hold a token or PII.
import { fetchWithTimeout } from "@caisson-sh/kernel/fetch";
import type { FetchTimeoutOptions } from "@caisson-sh/kernel/fetch";
import { PrivacyDecisionGuard } from "./decision-guard.ts";
import type { PrivacyPolicy, SanctionedSinkKind } from "./policy.ts";

/** The outbound fetch signature another runtime (e.g. transformers.js `env.fetch`) can install. */
export type GuardedFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** Extract a URL string from any of the three `fetch` input shapes. */
function inputToUrlString(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Enforces a {@link PrivacyPolicy} on outbound requests. Construct once per policy; the resolved
 * host → sink-kind map is built at construction so each check is an O(1) exact lookup.
 */
export class EgressGuard extends PrivacyDecisionGuard {
  /**
   * Guarded outbound fetch: assert the host is allowlisted, THEN route through the kernel
   * `fetchWithTimeout`. The policy check runs first, so a blocked request never reaches the network.
   */
  async fetch(
    input: string | URL,
    init: RequestInit = {},
    options?: FetchTimeoutOptions,
  ): Promise<Response> {
    const url = this.assertAllowed(input);
    return fetchWithTimeout(url, init, options);
  }

  /**
   * {@link fetch}, but purpose-bound: the host must be allowlisted for `kind` specifically
   * ({@link assertAllowedFor}) before any socket opens. The credentialed rented-backend transports
   * (both the first-party and OpenRouter wires) route every request here so a Bearer header can
   * never reach a host sanctioned for a different purpose. Delegates to {@link fetch} after the
   * kind gate, so `fetch` stays the ONE outbound seam (tests double it; the re-run of
   * `assertAllowed` inside is an O(1) lookup).
   */
  async fetchAs(
    kind: SanctionedSinkKind,
    input: string | URL,
    init: RequestInit = {},
    options?: FetchTimeoutOptions,
  ): Promise<Response> {
    const url = this.assertAllowedFor(input, kind);
    return this.fetch(url, init, options);
  }

  /**
   * The guard as a {@link GuardedFetch} — the `(input, init) => Promise<Response>` shape another
   * runtime can install as its sole outbound hook (e.g. transformers.js `env.fetch`; the rented
   * backend transport), so that runtime cannot egress out-of-band.
   */
  readonly guardedFetch: GuardedFetch = (input, init) =>
    this.fetch(inputToUrlString(input), init);
}

/** Construct an {@link EgressGuard} for `policy`. */
export function createEgressGuard(policy: PrivacyPolicy): EgressGuard {
  return new EgressGuard(policy);
}
