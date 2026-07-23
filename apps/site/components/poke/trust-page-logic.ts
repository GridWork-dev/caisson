// Deterministic client-side mirror of @caisson/trust-page (the buyer trust-page generator) for the
// "trust-page" poke (ADR-0378 lock 2). Every export below is a faithful, standalone port of the
// package's pure allowlist-redaction + render pipeline. Nothing here fetches, persists, measures, or
// uses Date.now/Math.random in a rendered-output path.
//
// Why mirrored instead of imported: packages/trust-page/src/render.ts imports @caisson/artifact-render,
// whose barrel (src/index.ts) re-exports citation-row.ts, which imports `strictObject`/`parseStrict`/
// `JsonValue` as VALUES from @caisson/kernel. @caisson/kernel's own barrel (src/index.ts) re-exports
// audit-chain.ts / crypto.ts / migration-assembly.ts (node:crypto) and ssrf.ts (node:dns/promises).
// Neither package declares a subpath export around those files (both package.json `exports` maps
// carry only "."), so none of it resolves in a browser bundle. This is therefore a line-for-line port
// of facts.ts's flatten + default allowlist and redact.ts's redactToAllowlist, plus a minimal render.ts
// mirror. Parity is golden-pinned in trust-page-logic.test.ts against
// packages/trust-page/src/__golden__/trust-page.default.{html,json}.txt and against the real package's
// own generateTrustPage / flattenManifestFacts / redactToAllowlist (imported by relative path — apps/
// site does not declare @caisson/trust-page or @caisson/artifact-render as dependencies).
//
// Scope narrowed for this poke (the redaction gate, not the whole generator): the crosswalk-rollup
// citation-row table (CROSSWALK_ROLLUP_ROWS_KEY) and the readiness-language claim filter
// (assertReadinessLanguage) are real second gates in the shipped generator, but neither is exercised
// by the default allowlist or by this poke's sample data, so both are left out rather than faked. The
// golden-parity test below proves this narrowing changes nothing for the paths this poke actually
// renders.

// ---- The sample payload (packages/trust-page/src/facts.ts flattens a shape like this) ----------

export interface SampleControl {
  readonly controlId: string;
  readonly title: string;
  readonly readiness: string;
}

export interface SampleManifest {
  readonly tenantId: string;
  readonly framework: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
  };
  readonly chainAnchor: { readonly length: number; readonly tipHash: string };
  readonly summary: {
    readonly totalControls: number;
    readonly controlsReady: number;
    readonly controlsWithGaps: number;
    readonly totalEvidenceItems: number;
    readonly posture: string;
  };
  readonly controls: readonly SampleControl[];
}

/**
 * The fixed sample payload, visibly labeled as a sample in the UI. Field values match
 * packages/trust-page/src/render.test.ts's `fixtureManifest()` exactly, so the default-allowlist
 * render below is byte-identical to the committed golden fixture (trust-page-logic.test.ts checks
 * this). `framework.title` carries a real em dash because that is the literal upstream value the
 * golden fixture was generated from — every OTHER string in this poke avoids the character.
 */
export const SAMPLE_MANIFEST: SampleManifest = {
  tenantId: "tenant-DO-NOT-LEAK-9f3a2c",
  framework: {
    id: "soc2-tsc",
    title: "SOC 2 — Trust Services Criteria",
    version: "2024.1",
  },
  chainAnchor: { length: 3, tipHash: "f".repeat(64) },
  summary: {
    totalControls: 1,
    controlsReady: 1,
    controlsWithGaps: 0,
    totalEvidenceItems: 1,
    posture: "1 of 1 controls evidence-ready; no gaps recorded.",
  },
  controls: [
    {
      controlId: "AUDIT.IMMUTABLE-LOG",
      title: "DO-NOT-LEAK-CONTROL-TITLE-8b21",
      readiness: "ready",
    },
  ],
};

export type FlatFacts = Readonly<Record<string, string | number | boolean>>;

/** Verbatim: facts.ts `flattenManifestFacts` (the crosswalk-rollup rows are out of this poke's
 *  scope — see the file header — so only the scalar manifest fields are flattened). */
export function flattenManifestFacts(manifest: SampleManifest): FlatFacts {
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

/** Verbatim: facts.ts `DEFAULT_TRUST_PAGE_ALLOWLIST` — aggregate posture only. */
export const DEFAULT_TRUST_PAGE_ALLOWLIST: readonly string[] = [
  "framework.title",
  "framework.version",
  "summary.posture",
  "summary.totalControls",
  "summary.controlsReady",
  "summary.controlsWithGaps",
];

/** The full universe of facts this sample manifest can ever produce, in flatten order — every key
 *  the checkbox list below can toggle. */
export const ALL_FACT_KEYS: readonly string[] = Object.keys(
  flattenManifestFacts(SAMPLE_MANIFEST),
);

/**
 * Verbatim: artifact-render's redact.ts `redactToAllowlist`. A key absent from `allowlist` never
 * reaches the result, no exceptions. A key present in `allowlist` but absent from `facts` (a
 * fabricated or attacker-supplied field name) is just as absent — silently, never an error. That
 * second property is the whole poke's tamper control: widening the allowlist can only surface a
 * fact that was actually captured.
 */
export function redactToAllowlist(
  facts: FlatFacts,
  allowlist: readonly string[],
): FlatFacts {
  const out: Record<string, string | number | boolean> = {};
  for (const key of allowlist) {
    if (Object.hasOwn(facts, key)) out[key] = facts[key]!;
  }
  return out;
}

/** Locale-independent lexicographic comparator. Verbatim: render.ts `cmp`. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Verbatim: render.ts `sortedEntries` — deterministic key order, independent of allowlist order. */
function sortedEntries(
  facts: FlatFacts,
): Array<[string, string | number | boolean]> {
  return Object.entries(facts).sort(([a], [b]) => cmp(a, b));
}

/** Verbatim: render.ts `escapeHtml`. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Verbatim: render.ts `renderJson` (the `crosswalk` array is always empty in this poke's scope). */
export function renderJson(facts: FlatFacts): string {
  const body = {
    facts: Object.fromEntries(sortedEntries(facts)),
    crosswalk: [] as readonly unknown[],
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

/** Verbatim: render.ts `PAGE_STYLE`. */
const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid currentColor; }
  .facts dt { font-weight: 600; }
  .facts dd { margin: 0 0 0.75rem 0; }
`;

/** Verbatim: render.ts `renderFactsSection`. */
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

/** Mirrors render.ts `renderHtml` with `renderCrosswalkSection(rows)` fixed at its always-empty
 *  output for this poke's scope — the resulting bytes are identical to the real function whenever
 *  the crosswalk-rollup key is absent from the allowlist, which golden + parity tests below verify. */
export function renderHtml(facts: FlatFacts): string {
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

</body>
</html>
`;
}

export interface TrustPageRender {
  readonly facts: FlatFacts;
  readonly html: string;
  readonly json: string;
}

/** The gate this poke demonstrates, end to end: flatten the sample payload, redact it down to the
 *  caller-supplied allowlist, render both outputs strictly from what survived. Neither output can
 *  ever see a fact the allowlist didn't admit — there is no other path into `renderHtml`/`renderJson`. */
export function renderTrustPage(
  manifest: SampleManifest,
  allowlist: readonly string[],
): TrustPageRender {
  const facts = redactToAllowlist(flattenManifestFacts(manifest), allowlist);
  return { facts, html: renderHtml(facts), json: renderJson(facts) };
}
