// @caisson/pricebook — the single COMMERCE price-book (ADR-0089, provider rename ADR-0108): plan-book
// (providerPriceId -> creditsPerCycle), action-book (per-action credit cost), and the shared
// cents->credits GRANT conversion. Distinct from @caisson/ai-meter's per-ai-call COST book; both share
// kernel's one credit denomination (ADR-0098). Versioned, append-only, fail-closed, integer-only.
// Commercial base package; depends only on @caisson/kernel — never "up" on an edition (ADR-0003).
export {
  PRICEBOOK_VERSION,
  PLAN_BOOK,
  planBookEntrySchema,
  planCadenceSchema,
  parsePlanBook,
  resolvePlan,
} from "./plans.ts";
export type { PlanBookEntry, PlanCadence } from "./plans.ts";

export {
  PURCHASE_BOOK_VERSION,
  PURCHASE_BOOK,
  purchaseBookEntrySchema,
  parsePurchaseBook,
  resolvePurchase,
} from "./purchases.ts";
export type { PurchaseBookEntry } from "./purchases.ts";

export {
  ACTION_BOOK,
  actionBookSchema,
  parseActionBook,
  resolveActionCost,
} from "./actions.ts";
export type { ActionBook, ActionKeySource, ActionTag } from "./actions.ts";

export {
  CREDIT_CONVERSION,
  centsToCredits,
  creditConversionSchema,
  parseCreditConversion,
} from "./conversion.ts";
export type { CreditConversion } from "./conversion.ts";
