// Pure privacy-policy decisions. This module deliberately owns no fetch method: it can prove that
// an endpoint would be allowed without creating a network-capable path in a browser bundle.
import { AuthzError, ValidationError } from "@caisson-sh/kernel/browser";
import {
  parsePrivacyPolicy,
  type PrivacyPolicy,
  type SanctionedSinkKind,
} from "./policy.ts";

/** Fail-closed URL and purpose checks over a validated privacy policy. */
export class PrivacyDecisionGuard {
  readonly #policy: PrivacyPolicy;
  readonly #allow: ReadonlyMap<string, SanctionedSinkKind>;

  constructor(policy: PrivacyPolicy) {
    this.#policy = parsePrivacyPolicy(policy);
    this.#allow = new Map(
      this.#policy.allowlist.map((sink) => [sink.host, sink.kind] as const),
    );
  }

  get policy(): PrivacyPolicy {
    return this.#policy;
  }

  assertAllowed(input: string | URL): URL {
    let url: URL;
    try {
      url = input instanceof URL ? input : new URL(input);
    } catch {
      throw new ValidationError("egress blocked: malformed URL");
    }
    if (url.protocol !== "https:") {
      throw new AuthzError("egress blocked: non-https scheme", {
        scheme: url.protocol,
      });
    }
    const host = url.hostname.toLowerCase();
    if (!this.#allow.has(host)) {
      throw new AuthzError(
        "egress blocked: host not on the privacy allowlist (fail-closed-to-offline)",
        { host, privacy: this.#policy.privacy },
      );
    }
    return url;
  }

  sinkKindFor(host: string): SanctionedSinkKind | undefined {
    return this.#allow.get(host.toLowerCase());
  }

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
}

export function createPrivacyDecisionGuard(
  policy: PrivacyPolicy,
): PrivacyDecisionGuard {
  return new PrivacyDecisionGuard(policy);
}
