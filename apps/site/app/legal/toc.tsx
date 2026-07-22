import type { CSSProperties } from "react";

export interface LegalTocItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Fixed "On this page" jump-nav rail for the legal documents (ADR-0376 lock 3). The legal
 * pages keep their deliberate 62ch single-column measure (see ./prose.ts); this rail lives
 * in the container's right dead space the visual audit flagged, wide viewports only —
 * `.legal-toc` in global.css hides it below 75rem. Server component: plain fragment
 * anchors onto each `<Section id>`; no scroll-spy state, the browser owns navigation.
 */
export function LegalToc({ items }: { items: readonly LegalTocItem[] }) {
  return (
    <nav className="legal-toc" aria-label="On this page">
      <span className="legal-toc-heading" style={tocHeading}>
        On this page
      </span>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

const tocHeading: CSSProperties = {
  display: "block",
  fontFamily: "var(--cs-font-mono)",
  fontSize: "var(--cs-text-xs)",
  textTransform: "uppercase",
  letterSpacing: "var(--cs-tracking-wide)",
  color: "var(--cs-fg-muted)",
  marginBottom: "var(--cs-space-3)",
};
