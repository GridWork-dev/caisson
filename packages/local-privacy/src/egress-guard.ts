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
import {
  AuthzError,
  ValidationError,
  fetchWithTimeout,
  type FetchTimeoutOptions,
} from "@caisson/kernel";
import {
  parsePrivacyPolicy,
  type PrivacyPolicy,
  type SanctionedSinkKind,
} from "./policy.ts";

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
export class EgressGuard {
  readonly #policy: PrivacyPolicy;
  /** host → sanctioned sink kind. Hosts are normalized (trim + lowercase) by the policy parse. */
  readonly #allow: ReadonlyMap<string, SanctionedSinkKind>;

  /**
   * @param policy a privacy policy. RE-PARSED defensively (`parsePrivacyPolicy`) so a hand-built or
   *   deserialized object that bypassed the boundary still fails closed on a bad host / unknown mode.
   */
  constructor(policy: PrivacyPolicy) {
    this.#policy = parsePrivacyPolicy(policy);
    this.#allow = new Map(
      this.#policy.allowlist.map((sink) => [sink.host, sink.kind] as const),
    );
  }

  /** The validated policy this guard enforces. */
  get policy(): PrivacyPolicy {
    return this.#policy;
  }

  /**
   * Decide whether `input` may egress, returning the parsed `URL` if allowed and THROWING a
   * fail-closed `CaissonError` if not. Pure (no network) — usable as a pre-flight check by callers
   * (e.g. the rented backend) before any request shape is built.
   *
   * @throws ValidationError on a malformed URL.
   * @throws AuthzError on a non-https scheme, or a host absent from the allowlist (incl. the
   *   empty-allowlist zero-egress case — there is no silent hosted fallback).
   */
  assertAllowed(input: string | URL): URL {
    let url: URL;
    try {
      url = input instanceof URL ? input : new URL(input);
    } catch {
      throw new ValidationError("egress blocked: malformed URL");
    }
    if (url.protocol !== "https:") {
      // Non-https never egresses — blocks http:, and data:/file:/javascript: smuggling.
      throw new AuthzError("egress blocked: non-https scheme", {
        scheme: url.protocol,
      });
    }
    const host = url.hostname.toLowerCase();
    if (!this.#allow.has(host)) {
      // Empty allowlist ⇒ this branch always fires ⇒ zero egress. No host is implicit.
      throw new AuthzError(
        "egress blocked: host not on the privacy allowlist (fail-closed-to-offline)",
        { host, privacy: this.#policy.privacy },
      );
    }
    return url;
  }

  /** The sanctioned sink kind for `host`, or `undefined` if it is not allowlisted. */
  sinkKindFor(host: string): SanctionedSinkKind | undefined {
    return this.#allow.get(host.toLowerCase());
  }

  /**
   * {@link assertAllowed} PLUS a sanctioned-sink KIND requirement: the host must be allowlisted
   * for `kind` SPECIFICALLY. Purpose-binding is the point — each sink kind exists for exactly one
   * credentialed surface (`policy.ts`), so a host sanctioned for the model fetch must never
   * receive a rented-backend Bearer request, and vice versa. Fail-closed `AuthzError` naming
   * the required and actual kinds (never the full URL).
   */
  assertAllowedFor(input: string | URL, kind: SanctionedSinkKind): URL {
    const url = this.assertAllowed(input);
    const actual = this.#allow.get(url.hostname.toLowerCase());
    if (actual !== kind) {
      throw new AuthzError(
        "egress blocked: host is not allowlisted for this sanctioned sink kind",
        { host: url.hostname, required: kind, actual: actual ?? null },
      );
    }
    return url;
  }

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
