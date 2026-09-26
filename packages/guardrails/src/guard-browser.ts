// WebCrypto guard composition. Moderation and metadata-only block emission share the exact core
// with the Node entry; only PII transforms use their async browser twins.
import { ConfigError } from "@caisson-sh/kernel/browser";
import type { GuardPolicyBase, GuardRuntime } from "./guard-core.ts";
import { moderateGuard } from "./guard-core.ts";
import type { BrowserPiiCryptoContext } from "./pii-browser.ts";
import { hashPiiAsync, tokenizePiiAsync } from "./pii-browser.ts";
import { maskPii } from "./pii-core.ts";
import type { PiiMode, PiiToken } from "./pii-core.ts";

export interface BrowserPiiPolicy {
  readonly mode: PiiMode;
  readonly ctx?: BrowserPiiCryptoContext;
}

export interface BrowserGuardPolicy extends GuardPolicyBase {
  readonly pii?: BrowserPiiPolicy | null;
}

export interface BrowserGuardOutcome {
  readonly text: string;
  readonly tokens: readonly PiiToken[];
}

/** Guard browser-held input, then apply the selected runtime-safe PII transform. */
export async function guardInputAsync(
  text: string,
  policy: BrowserGuardPolicy,
  runtime: GuardRuntime,
): Promise<BrowserGuardOutcome> {
  // A PII context bound to another tenant is a wiring error — reject before moderation or any
  // telemetry so a cross-tenant seal can never be reached.
  if (
    policy.pii?.ctx !== undefined &&
    policy.pii.ctx.tenantId !== runtime.tenantId
  ) {
    throw new ConfigError(
      "guardrails: PII field-crypto context is bound to a different tenant than the guard runtime",
    );
  }
  await moderateGuard("input", text, policy, runtime);
  const pii = policy.pii;
  if (pii === undefined || pii === null) return { text, tokens: [] };
  if (pii.mode === "mask") {
    return { text: maskPii(text), tokens: [] };
  }
  if (pii.mode === "hash") {
    return { text: await hashPiiAsync(text), tokens: [] };
  }
  if (pii.ctx === undefined) {
    throw new ConfigError(
      "guardrails: browser PII tokenize mode requires injected field material",
    );
  }
  const tokenized = await tokenizePiiAsync(text, pii.ctx);
  return { text: tokenized.redacted, tokens: tokenized.tokens };
}

/**
 * Guard browser-held output. Moderation only — accepts the same PII-bearing policy shape as
 * `guardInputAsync` for source compatibility; output text is never rewritten.
 */
export async function guardOutput(
  text: string,
  policy: BrowserGuardPolicy,
  runtime: GuardRuntime,
): Promise<void> {
  await moderateGuard("output", text, policy, runtime);
}
