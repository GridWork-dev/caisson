// The shared denomination, re-exported from its single home (@caisson/kernel, SD-3/ADR-0098) so
// commerce callers can import the unit + the cents->credits GRANT conversion from one place alongside
// the plan/action books. Exactly ONE definition exists (kernel) — this is a re-export, not a copy.
export {
  CREDIT_CONVERSION,
  centsToCredits,
  centsToCreditsProvenance,
  creditConversionSchema,
  parseCreditConversion,
} from "@caisson/kernel";
export type { CreditConversion } from "@caisson/kernel";
