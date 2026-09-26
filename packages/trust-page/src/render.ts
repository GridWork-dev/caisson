// src/render.ts — the trust-page generator. A PURE function (no I/O, no clock, no id minting — the
// un-wired-seam ethos, ADR-0047): given an evidence-pack manifest, returns a deployable self-contained
// static page (HTML) and a machine-readable data file (JSON) a buyer hosts anywhere. Neither output
// fetches the other at runtime — each is independently self-contained.
//
// Permanent non-goals (never scaffolded): no auth, no sign-off, no hosted comments, no NDA-gating.
// This generator only ever RENDERS what it is handed; it has no notion of who is viewing the page.
import type { EvidencePackManifest } from "@caisson-sh/compliance-core";
import {
  assertReadinessLanguage,
  citationRowToJson,
  redactToAllowlist,
  renderCitationRow,
  type CitationRow,
  type FlatFacts,
} from "@caisson-sh/artifact-render";
import {
  CROSSWALK_ROLLUP_ROWS_KEY,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  flattenManifestFacts,
} from "./facts.ts";

export interface GenerateTrustPageOptions {
  /** Defaults to {@link DEFAULT_TRUST_PAGE_ALLOWLIST}. A field/section absent from this list never
   *  renders in EITHER output, no exceptions (SPEC piece 3 item 2, binding). */
  readonly allowlist?: readonly string[];
}

export interface TrustPage {
  readonly html: string;
  readonly json: string;
}

/** Locale-independent lexicographic comparator (mirrors the repo's own `cmp` convention). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deterministic key order: allowlist-redacted facts sorted alphabetically, independent of the
 *  caller-supplied allowlist's own order. */
function sortedEntries(facts: FlatFacts): Array<[string, unknown]> {
  return Object.entries(facts).sort(([a], [b]) => cmp(a, b));
}

/** One citation row per crosswalk-rollup cell — Caisson's own product-mapping content, never tenant
 *  data (framework/reference/claim/status/evidencePointer, the last being the cell's own
 *  canonicalControlIds joined — see the CROSSWALK_ROLLUP_ROWS_KEY doc in facts.ts). Justification is
 *  own-authored, readiness-language-safe prose built from the cell's already-safe enum fields (never
 *  the buyer's free text); `renderCitationRow` also gates `control` + `claim` (defense in depth). */
function crosswalkRollupRows(manifest: EvidencePackManifest): CitationRow[] {
  return manifest.crosswalkRollup.cells.map((cell) =>
    renderCitationRow({
      control: `${cell.framework} ${cell.reference}`,
      claim: cell.claim,
      justification: `Evidence status: ${cell.status}.`,
      evidencePointer: cell.evidencePointers.join(", "),
    }),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderJson(facts: FlatFacts, rows: readonly CitationRow[]): string {
  const body = {
    facts: Object.fromEntries(sortedEntries(facts)),
    crosswalk: rows.map(citationRowToJson),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid currentColor; }
  .facts dt { font-weight: 600; }
  .facts dd { margin: 0 0 0.75rem 0; }
`;

function renderFactsSection(facts: FlatFacts): string {
  const entries = sortedEntries(facts);
  if (entries.length === 0) return "";
  const rows = entries
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`,
    )
    .join("\n");
  return `<dl class="facts">\n${rows}\n</dl>`;
}

function renderCrosswalkSection(rows: readonly CitationRow[]): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.control)}</td><td>${escapeHtml(row.claim)}</td><td>${escapeHtml(row.justification)}</td></tr>`,
    )
    .join("\n");
  return `<h2>Crosswalk</h2>\n<table>\n<thead><tr><th>Control</th><th>Claim</th><th>Justification</th></tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

function renderHtml(facts: FlatFacts, rows: readonly CitationRow[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trust &amp; compliance posture</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<h1>Trust &amp; compliance posture</h1>
${renderFactsSection(facts)}
${renderCrosswalkSection(rows)}
</body>
</html>
`;
}

/**
 * Generate the buyer trust page. Every fact is filtered through the caller's `allowlist` before
 * either output is built (a field absent from it never renders, in JSON or HTML), and every rendered
 * string passes the readiness-language gate (`@caisson-sh/artifact-render`'s `assertReadinessLanguage`)
 * — this generator cannot ship a "compliant"/"certified"/"verified" claim even if the underlying
 * evidence pack's own posture copy somehow slipped one past its own gate.
 */
export function generateTrustPage(
  manifest: EvidencePackManifest,
  options: GenerateTrustPageOptions = {},
): TrustPage {
  const allowlist = options.allowlist ?? DEFAULT_TRUST_PAGE_ALLOWLIST;
  const facts = redactToAllowlist(flattenManifestFacts(manifest), allowlist);
  for (const [key, value] of Object.entries(facts)) {
    if (typeof value === "string") {
      assertReadinessLanguage(value, `trust page fact "${key}"`);
    }
  }
  const rows = allowlist.includes(CROSSWALK_ROLLUP_ROWS_KEY)
    ? crosswalkRollupRows(manifest)
    : [];
  return {
    html: renderHtml(facts, rows),
    json: renderJson(facts, rows),
  };
}
