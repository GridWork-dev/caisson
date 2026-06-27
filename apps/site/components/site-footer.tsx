import Link from "next/link";

const COLS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Editions",
    links: [
      { href: "/compliance", label: "Compliance" },
      { href: "/ai-kit", label: "AI Production Kit" },
      { href: "/local-first", label: "Local-first AI" },
      { href: "/agentic-dev", label: "Agentic-Dev" },
    ],
  },
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Documentation" },
      { href: "/docs/getting-started", label: "Getting started" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/llms.txt", label: "llms.txt" },
      {
        href: "https://github.com/GridWork-dev/caisson",
        label: "GitHub",
      },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="cs-footer">
      <div className="cs-container cs-footer-cols">
        <div>
          <div className="cs-brand">
            <span className="mark">caisson</span>
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-3)" }}>
            Compliance-grade infrastructure for regulated SaaS.
          </p>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-4)" }}>
            © {2026} GridWork Digital LLC
          </p>
        </div>
        {COLS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <div
              className="cs-status"
              style={{ marginBottom: "var(--cs-space-3)" }}
            >
              {col.heading}
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {col.links.map((l) => (
                <li key={l.href} style={{ marginBottom: "var(--cs-space-2)" }}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
