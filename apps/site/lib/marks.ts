// Catalog id → bespoke mark (ADR-0237 F6). The single mapping every surface (nav panels, catalog
// cards, depth-page heroes, media slots) reads so a module never renders two different glyphs.
// field-crypto and audit-worm predate the F6 set under their original bespoke names.
import type { IconName } from "@caisson/ui/components";

import type { BundleId } from "./pricing";

export const MODULE_MARKS: Record<string, IconName> = {
  "field-crypto": "field-crypto",
  "audit-worm": "worm",
  "retention-runner": "retention-runner",
  alerting: "alerting",
  "ai-meter": "ai-meter",
  "ai-evals": "ai-evals",
  guardrails: "guardrails",
  "prompt-registry": "prompt-registry",
  "local-store": "local-store",
  "agent-kernel": "agent-kernel",
  "agent-runner": "agent-runner",
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
