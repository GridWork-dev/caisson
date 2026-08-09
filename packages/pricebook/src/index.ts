// @caisson/pricebook — the single COMMERCE price-book (ADR-0089, provider rename ADR-0108): plan-book
// (providerPriceId -> creditsPerCycle), action-book (per-action credit cost), and the shared
// cents->credits GRANT conversion. Distinct from @caisson/ai-meter's per-call token-rate book; both share
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
  RENEWAL_BOOK_VERSION,
  RENEWAL_BOOK,
  ACTIVE_RENEWAL_PRICE_IDS,
  ARCHIVED_RENEWAL_PRICE_IDS,
  renewalBookEntrySchema,
  parseRenewalBook,
  isRenewalPrice,
  resolveRenewal,
  renewalYears,
} from "./renewals.ts";
export type { RenewalBookEntry } from "./renewals.ts";

export {
  ACTION_BOOK,
  actionBookSchema,
  parseActionBook,
  resolveActionCost,
} from "./actions.ts";
export type { ActionBook, ActionKeySource, ActionTag } from "./actions.ts";

export {
  UPGRADE_BOOK_VERSION,
  SKU_RETAIL,
  BUNDLE_RETAIL,
  BUNDLE_MEMBERSHIP_BOOK,
  bundleMembershipTimeline,
  creditableMembers,
  isCreditableMember,
  resolveUpgradeCredit,
  upgradeQuote,
} from "./upgrades.ts";
export type { PaidAmount, UpgradeQuote } from "./upgrades.ts";

export {
  CREDIT_CONVERSION,
  centsToCredits,
  centsToCreditsProvenance,
  creditConversionSchema,
  parseCreditConversion,
} from "@caisson/kernel";
export type { CreditConversion } from "@caisson/kernel";
