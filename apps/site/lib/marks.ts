// Catalog id → bespoke mark (ADR-0237 F6). The single mapping every surface (nav panels, catalog
// cards, depth-page heroes, media slots) reads so a module never renders two different glyphs.
// field-crypto and audit-worm predate the F6 set under their original bespoke names.
import type { IconName } from "@caisson-sh/ui/components";

import type { BundleId } from "./catalog";

export const MODULE_MARKS: Record<string, IconName> = {
  "field-crypto": "field-crypto",
  "audit-worm": "worm",
  "retention-runner": "retention-runner",
  alerting: "alerting",
  "access-review": "access-review",
  "risk-register": "risk-register",
  "trust-page": "trust-page",
  "ai-meter": "ai-meter",
  "ai-evals": "ai-evals",
  guardrails: "guardrails",
  "prompt-registry": "prompt-registry",
  "local-store": "local-store",
  "agent-kernel": "agent-kernel",
  "agent-runner": "agent-runner",
  // The newest depth-page wave, now on bespoke domain glyphs (the F6 bespoke set they were
  // temporarily standing in for with generic lucide marks).
  "agent-trajectory": "agent-trajectory",
  "tool-exec": "tool-exec",
  "org-controls": "org-controls",
  "compliance-core": "compliance-core",
  "billing-orchestration": "billing-orchestration",
  "ui-pro": "ui-pro",
  "local-inference": "local-inference",
  "local-privacy": "local-privacy",
  "local-sync": "local-sync",
  "frameworks-pack": "frameworks-pack",
  "oscal-spine": "frameworks-pack",
  "signing-primitive": "signing-primitive",
  credits: "credits",
};

/** Bundle id → bespoke mark. The persona bundles reuse the edition-era glyphs their personas kept
 *  (the registered glyph names are the brand package's contract — renaming them is a brand change,
 *  not a catalog one); Provenance and Everything map to existing bespoke glyphs. */
export const BUNDLE_MARKS: Record<BundleId, IconName> = {
  compliance: "edition-compliance",
  "ai-production": "edition-ai-kit",
  "local-first": "edition-local-ai",
  "agentic-dev": "edition-agent-dev",
  provenance: "audit-chain",
  everything: "bundle",
};

/** Mark for a module id; falls back to the generic boxes glyph for an unmapped id. */
export function moduleMark(id: string): IconName {
  return MODULE_MARKS[id] ?? "boxes";
}
