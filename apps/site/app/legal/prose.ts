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
};
