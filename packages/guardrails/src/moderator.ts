// The `Moderator` port (ADR-0063) — the swappable content-moderation seam the guardrails layer
// calls at the gateway's input/output points. Three drivers ship: a `local` regex driver (zero
// network, the cheap default), a `provider` driver that wraps an INJECTED check (test-doubled in
// CI — guardrails itself makes NO outbound call; a real provider adapter uses `fetchWithTimeout`
// per the kernel floor), and a `custom` hook. The `forge.config` policy block is the serializable
// selection (`.strict()` — unknown keys rejected); the live `Moderator` instance is built from it.
import { z } from "zod";
import { strictObject, ValidationError } from "@caisson/kernel";

/**
 * The violation class a block is charted by. Mirrors `kernel/observability`
 * `guardrailBlockSchema`. `"secret"` (ADR-0209) is the unconditional credential-shape pre-screen in
 * `guard.ts` — it never comes from a `Moderator` verdict.
 */
export type GuardCategory =
  "moderation" | "pii" | "injection" | "secret" | "custom";

/**
 * A moderation verdict. **Metadata only** — `category` is the class the dashboard charts by, never
 * the flagged content or matched text (echoing it would defeat the redaction the guard enforces).
 */
export interface ModerationResult {
  readonly flagged: boolean;
  readonly category: GuardCategory;
}

/** The port. Editions/the gateway depend on this; a driver (local | provider | custom) backs it. */
export interface Moderator {
  moderate(text: string): ModerationResult | Promise<ModerationResult>;
}

const PASS: ModerationResult = { flagged: false, category: "moderation" };

/**
 * The `forge.config` moderator policy block (`.strict()`). The serializable knobs only — the live
 * `Moderator` is built from this via the driver factories below. `failOpen` defaults to `false`
 * (fail-closed, ADR-0063): a moderator outage BLOCKS unless an operator explicitly opts out.
 */
export const moderatorPolicySchema = strictObject({
  driver: z.enum(["local", "provider", "custom"]),
  failOpen: z.boolean().default(false),
  /** Per-call deadline (ms). A moderator that exceeds it is treated as an outage → fail-closed. */
  timeoutMs: z.number().int().positive().max(60_000).default(2_000),
  /** Regex sources for the `local` driver / cheap pre-screen. Compiled case-insensitive. */
  blocklist: z.array(z.string().min(1).max(500)).default([]),
});
export type ModeratorPolicy = z.infer<typeof moderatorPolicySchema>;

/** Compile blocklist sources to case-insensitive `RegExp`. An invalid source is a boundary error. */
export function compileBlocklist(sources: readonly string[]): RegExp[] {
  return sources.map((src) => {
    try {
      // No `g` flag — these are tested with `.test()`, where a sticky lastIndex would skip matches.
      return new RegExp(src, "i");
    } catch {
      throw new ValidationError(
        "guardrails: invalid moderator blocklist pattern",
      );
    }
  });
}

/** The `local` driver — a zero-network regex moderator. Any blocklist hit flags as `moderation`. */
export function localModerator(sources: readonly string[]): Moderator {
  const patterns = compileBlocklist(sources);
  return {
    moderate(text: string): ModerationResult {
      for (const re of patterns) {
        if (re.test(text)) return { flagged: true, category: "moderation" };
      }
      return PASS;
    },
  };
}

/**
 * The `provider` driver — wraps an INJECTED check. Guardrails makes no network call itself (it is a
 * port boundary); the buyer's real adapter performs the HTTP call with `fetchWithTimeout`, and CI
 * injects a test double. This keeps the live transport the only un-exercised path.
 */
export function providerModerator(
  check: (text: string) => Promise<ModerationResult>,
): Moderator {
  return { moderate: (text) => check(text) };
}

/** The `custom` hook driver. A thrown hook surfaces as an outage → fail-closed at the guard. */
export function customModerator(
  hook: (text: string) => ModerationResult | Promise<ModerationResult>,
): Moderator {
  return { moderate: (text) => hook(text) };
}

/**
 * Run a moderator under a deadline. Resolves with the verdict, or REJECTS on timeout / driver error
 * — the guard catches a rejection and fails closed (unless an explicit `failOpen` policy is set).
 * Synchronous driver throws are normalized into the rejection too.
 */
export function moderateWithDeadline(
  moderator: Moderator,
  text: string,
  timeoutMs: number,
): Promise<ModerationResult> {
  const verdict = Promise.resolve().then(() => moderator.moderate(text));
  // A pending driver promise that later settles after the deadline must not surface as an unhandled
  // rejection once the race is decided against it.
  verdict.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("guardrails: moderator deadline exceeded")),
      timeoutMs,
    );
  });
  return Promise.race([verdict, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
