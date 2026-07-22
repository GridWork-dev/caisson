import type { CSSProperties } from "react";

// Shared prose styles for the four legal pages — inline style props reading --cs-* tokens.
// Previously each page carried its own copy and they drifted: the EULA was remediated to a
// 33rem column while the other three stayed at 72ch, and the visual audit flagged legal pages
// leaving ~45% of the desktop width empty. One measure now, consistent with the site's own
// long-form standard: `.cs-lede` (text-lg + 62ch). At `--cs-text-lg` Hubot Sans's narrow "0"
// makes 62ch ≈ 725px — the same column the ledes across the site already read at — with the
// larger body size carrying the wider line.
export const prose = {
  paragraph: {
    marginTop: "var(--cs-space-4)",
    fontSize: "var(--cs-text-lg)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "62ch",
  } as CSSProperties,
  h3: {
    marginTop: "var(--cs-space-8)",
    marginBottom: "var(--cs-space-3)",
    fontSize: "var(--cs-text-lg)",
    fontWeight: "var(--cs-weight-semibold)",
    letterSpacing: "var(--cs-tracking-tight)",
  } as CSSProperties,
  list: {
    marginTop: "var(--cs-space-3)",
    paddingLeft: "var(--cs-space-5)",
    fontSize: "var(--cs-text-lg)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "58ch",
    // Tailwind preflight resets ul/ol to `list-style: none` sitewide; these lists carry no class
    // to opt back in (visual-audit remediation) — the five "you agree not to" restriction items
    // and the definitions list were reading as flat indented paragraphs with no scannable marker.
    listStyleType: "disc",
  } as CSSProperties,
  li: {
    marginBottom: "var(--cs-space-2)",
  } as CSSProperties,
  /** Conspicuous clause paragraph (warranty disclaimer / liability limitation) — UCC-style
   *  conspicuousness via bold weight + a bordered surface band, sentence case (visual-audit
   *  16c4ef8a3d0a72c6/a2760c0e4071c659: full-paragraph ALL-CAPS is unreadable at body size and
   *  color-alone/caps-alone signaling isn't a real emphasis channel). Pair with a plain `<Card>`
   *  wrapper (border + surface-1, no accent) for the "distinct surface band" half of the treatment.
   */
  conspicuous: {
    // Bold, not semibold: conspicuousness is legally load-bearing and the recorded
    // decision says bold weight — match it exactly; counsel reviews this treatment.
    fontWeight: "var(--cs-weight-bold)",
    lineHeight: "var(--cs-leading-relaxed)",
  } as CSSProperties,
};
