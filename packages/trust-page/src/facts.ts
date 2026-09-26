// src/facts.ts — flatten an evidence pack into the flat scalar fact record the allowlist redaction
// (`@caisson-sh/artifact-render`'s `redactToAllowlist`) operates over, plus the default allowlist.
//
// ALLOWLIST-BASED REDACTION IS BINDING (SPEC piece 3 item 2): a field absent from the allowlist NEVER
// renders — no exceptions, no "safe by construction" carve-out for a content class. `flattenManifestFacts`
// therefore defines the UNIVERSE of facts a trust page could possibly render; `generateTrustPage`'s
// caller decides which of them actually reach the page by widening `allowlist` beyond the default.
import type { EvidencePackManifest } from "@caisson-sh/compliance-core";
import type { FlatFacts } from "@caisson-sh/artifact-render";

/**
 * The sentinel allowlist entry (not a fact key) that gates whether the crosswalk-rollup citation-row
 * table renders at all. The rollup cells are Caisson's own product-mapping content (framework,
 * reference, claim, status — never tenant-private data), but the allowlist rule is absolute: absent
 * from the allowlist, it renders nothing, so even this coarse-grained section is opt-in. NOTE: opting
 * in also exposes each cell's `canonicalControlIds` — the internal Caisson canonical control id(s),
 * e.g. `AUDIT.IMMUTABLE-LOG` — via the rendered row's `evidencePointer` field in the JSON output.
 */
export const CROSSWALK_ROLLUP_ROWS_KEY = "crosswalkRollup.rows";

/**
 * The minimal, documented default allowlist: aggregate posture only. No tenant id, no raw chain-anchor
 * hash, no per-control detail, no crosswalk-rollup table — a caller opts into any of those explicitly.
 */
export const DEFAULT_TRUST_PAGE_ALLOWLIST: readonly string[] = [
  "framework.title",
  "framework.version",
  "summary.posture",
  "summary.totalControls",
  "summary.controlsReady",
  "summary.controlsWithGaps",
];

/**
 * Flatten an evidence-pack manifest into a flat `key -> scalar` fact record. Every field a trust page
 * could ever show lives here, dot-namespaced (`framework.title`, `controls.0.readiness`, …) — this is
 * the ceiling `redactToAllowlist` filters down from, never the floor. Pure; no I/O, no clock.
 */
export function flattenManifestFacts(
  manifest: EvidencePackManifest,
): FlatFacts {
  const facts: Record<string, string | number | boolean> = {
    tenantId: manifest.tenantId,
    "framework.id": manifest.framework.id,
    "framework.title": manifest.framework.title,
    "framework.version": manifest.framework.version,
    "chainAnchor.length": manifest.chainAnchor.length,
    "chainAnchor.tipHash": manifest.chainAnchor.tipHash,
    "summary.totalControls": manifest.summary.totalControls,
    "summary.controlsReady": manifest.summary.controlsReady,
    "summary.controlsWithGaps": manifest.summary.controlsWithGaps,
    "summary.totalEvidenceItems": manifest.summary.totalEvidenceItems,
    "summary.posture": manifest.summary.posture,
  };
  manifest.controls.forEach((control, i) => {
    facts[`controls.${String(i)}.controlId`] = control.controlId;
    facts[`controls.${String(i)}.title`] = control.title;
    facts[`controls.${String(i)}.readiness`] = control.readiness;
  });
  return facts;
}
