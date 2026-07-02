// The commerce action-book (ADR-0089): flat per-action credit cost for à-la-carte actions the
// generator/MCP meter through. The per-AI-CALL cost is NOT here — that stays computed from token usage
// by @caisson/ai-meter (ADR-0060). Integer-only; the numbers are operator-owned PLACEHOLDERS
// (SD-6/ADR-0012) until checkout. Append-only/versioned with the plan-book (PRICEBOOK_VERSION).
import { z } from "zod";
import { ConfigError, parseStrict, strictObject } from "@caisson/kernel";

export const actionBookSchema = strictObject({
  /** Credits a single create-caisson generation debits on the HOSTED path (ADR-0049; local = free, ADR-0093). */
  codegenRunCredits: z.number().int().positive(),
});
export type ActionBook = z.infer<typeof actionBookSchema>;

/** PLACEHOLDER action costs — NON-FINAL, operator-owned (SD-6/ADR-0012). */
export const ACTION_BOOK: ActionBook = {
  codegenRunCredits: 100,
};

export type ActionTag = keyof ActionBook;

/**
 * The BYOK-covered allowlist (ADR-0198): the subset of actions whose credit cost IS the model
 * inference a tenant's own key now pays for directly. ONLY these zero out under a `"tenant"`
 * keySource; every other action — evidence packs, compliance exports, registry ops, any non-inference
 * platform action — stays metered regardless of key source. Per-action DATA, not a runtime heuristic:
 * a new action is absent by default → metered (fail-metered), and must be added here deliberately to
 * ever go BYOK-free.
 */
export const BYOK_COVERED_ACTIONS: ReadonlySet<ActionTag> = new Set<ActionTag>([
  // A hosted codegen run's cost is the tenant's own provider inference under BYOK (ADR-0182).
  "codegenRunCredits",
]);

/**
 * Where the resolved provider key for this action's lane came from (ADR-0162 discriminator; mirrors
 * `@caisson/ai-config`'s `ProviderConfig.keySource`). `"env"` is the operator's platform key (cost
 * unchanged); `"tenant"` is a per-tenant BYOK key — under ADR-0182/0198 it makes the action FREE only
 * when the action is BYOK-covered (its cost IS the model inference the tenant's key now pays for);
 * platform actions stay metered.
 */
export type ActionKeySource = "env" | "tenant";

/** Validate an action-book override at a boundary (Zod `.strict()`). */
export function parseActionBook(input: unknown): ActionBook {
  return parseStrict(actionBookSchema, input);
}

/**
 * The integer credit cost of an action (closed union — a bad tag is a compile error). ADR-0182/0198: a
 * `"tenant"` (BYOK) `keySource` zeroes the debit ONLY for a `BYOK_COVERED_ACTIONS` inference action —
 * every other action stays metered even on a tenant key, so a platform action can't silently go free.
 * Internal metering (the spend-cap/abuse signal) stays orthogonal and keeps running wherever it's
 * wired; this only zeroes the credit-ledger charge. An unknown action tag still throws regardless of
 * `keySource` (fail-closed, not silently free).
 */
export function resolveActionCost(
  action: ActionTag,
  book: ActionBook = ACTION_BOOK,
  keySource: ActionKeySource = "env",
): number {
  // Own-property check mirrors resolvePlan's prototype-safe, fail-closed lookup — defends against a
  // runtime cast bypass even though ActionTag is a compile-time closed union.
  const cost = Object.hasOwn(book, action) ? book[action] : undefined;
  if (cost === undefined) {
    throw new ConfigError(`no action-book entry for ${action}`);
  }
  // BYOK zeroes the debit ONLY for an allowlisted inference action (ADR-0198); every other action
  // stays metered even on a tenant key, so a future platform action can't silently bypass the ledger.
  const byokFree = keySource === "tenant" && BYOK_COVERED_ACTIONS.has(action);
  return byokFree ? 0 : cost;
}
