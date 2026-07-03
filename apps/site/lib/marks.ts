// Catalog id → bespoke mark (ADR-0237 F6). The single mapping every surface (nav panels, catalog
// cards, depth-page heroes, media slots) reads so a module never renders two different glyphs.
// field-crypto and audit-worm predate the F6 set under their original bespoke names.
import type { IconName } from "@caisson/ui/components";

import type { EditionId } from "./pricing";

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

export const EDITION_MARKS: Record<EditionId, IconName> = {
  compliance: "edition-compliance",
  "ai-kit": "edition-ai-kit",
  "local-first": "edition-local-ai",
  "agentic-dev": "edition-agent-dev",
};

/** Mark for a module id; falls back to the generic boxes glyph for an unmapped id. */
export function moduleMark(id: string): IconName {
  return MODULE_MARKS[id] ?? "boxes";
}
