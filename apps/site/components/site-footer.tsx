import Link from "next/link";

import { Wordmark } from "@caisson/ui/components";

import { UpdatesForm } from "./waitlist-form";

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
      { href: "/changelog", label: "Changelog" },
      { href: "/procurement", label: "Security & procurement" },
      { href: "/llms.txt", label: "llms.txt" },
      {
        href: "https://github.com/GridWork-dev/caisson",
        label: "GitHub",
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy policy" },
      { href: "/legal/terms", label: "Terms of service" },
      { href: "/legal/license", label: "License" },
      { href: "/.well-known/security.txt", label: "Security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="cs-footer">
      <div className="cs-container cs-footer-cols">
        <div>
          <Wordmark descriptor />
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-3)" }}>
            Compliance-grade infrastructure for regulated SaaS.
          </p>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-4)" }}>
            © {new Date().getFullYear()} GridWork Digital LLC
          </p>
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <div
              className="cs-status"
              style={{ marginBottom: "var(--cs-space-3)" }}
            >
              Product updates
            </div>
            <UpdatesForm source="footer" />
          </div>
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
