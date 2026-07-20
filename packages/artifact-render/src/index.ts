// @caisson/artifact-render — the shared render seam for buyer-facing compliance artifacts. Three
// concerns, deliberately no more: a readiness-language claim filter (ADR-0080), allowlist-based field
// redaction, and citation-row rendering. Consumed by the ISO 27001 SoA generator
// (`@caisson/frameworks-pack` + `@caisson/compliance-core`) and the buyer trust-page generator
// (`@caisson/trust-page`), so both share one legal-gate + redaction implementation.
export {
  READINESS_LANGUAGE_BANNED_WORDS_RE,
  isReadinessLanguage,
  assertReadinessLanguage,
} from "./filter.ts";
export { redactToAllowlist, type FlatFacts } from "./redact.ts";
export {
  renderCitationRow,
  citationRowToJson,
  type CitationRow,
  type CitationRowInput,
} from "./citation-row.ts";
