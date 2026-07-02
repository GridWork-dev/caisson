import Link from "next/link";

import { Wordmark } from "@caisson/ui/components";

import { EDITION_ROUTES, LEGAL_ROUTES } from "@/lib/routes";
import { UpdatesForm } from "./waitlist-form";

// Editions + legal-page links derive from the canonical registry (lib/routes.ts) so they can't
// drift from the nav/sitemap. Product/Resources stay hand-authored — they mix in docs sub-pages,
// llms.txt, and the external GitHub link, which are not marketing page routes. The Legal column
// appends `.well-known/security.txt` (a static file, not a registered page route).
const COLS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Editions",
    links: EDITION_ROUTES.map((r) => ({ href: r.path, label: r.label })),
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
        href: "https://github.com/caisson-sh/caisson",
        label: "GitHub",
      },
    ],
  },
  {
    heading: "Legal",
    links: [
      ...LEGAL_ROUTES.map((r) => ({ href: r.path, label: r.label })),
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
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-2)" }}>
            Base substrate is <Link href="/legal/license">Apache-2.0</Link>,
            free to use. Editions and modules are commercial.
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
