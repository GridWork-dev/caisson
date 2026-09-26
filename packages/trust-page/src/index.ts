// @caisson-sh/trust-page — the trust-page generator: a self-contained static HTML + JSON page,
// built from an evidence pack + its crosswalk rollup through allowlist-based redaction, that an adopter
// hosts anywhere to show prospects their compliance posture. Permanent non-goals: no auth, no
// sign-off, no hosted comments, no NDA-gating — never scaffolded here.
export {
  CROSSWALK_ROLLUP_ROWS_KEY,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  flattenManifestFacts,
} from "./facts.ts";
export {
  generateTrustPage,
  type GenerateTrustPageOptions,
  type TrustPage,
} from "./render.ts";
