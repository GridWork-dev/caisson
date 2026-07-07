import Link from "next/link";

import { Wordmark } from "@caisson/brand";

import { footerRoutes, type FooterCol } from "@/lib/routes";
import { UpdatesForm } from "./waitlist-form";

// The footer derives from the canonical route registry's `footer` flag (ADR-0237) so it can't
// drift from the nav/sitemap. Each column = registry routes + the few non-route extras (docs
// sub-pages, llms.txt, GitHub, and `.well-known/security.txt` — a static disclosure file, not a
// page route, labeled as such to stop it shadowing the /security page).
const EXTRAS: Record<FooterCol, { href: string; label: string }[]> = {
  editions: [],
  product: [
    { href: "/docs", label: "Documentation" },
    { href: "/docs/getting-started", label: "Getting started" },
  ],
  resources: [
    { href: "/llms.txt", label: "llms.txt" },
    { href: "https://github.com/caisson-sh/caisson", label: "GitHub" },
  ],
  legal: [{ href: "/.well-known/security.txt", label: "Security disclosure" }],
};

const HEADINGS: Record<FooterCol, string> = {
  editions: "Bundles",
  product: "Marketplace",
  resources: "Resources",
  legal: "Legal",
};

const COLS = (["editions", "product", "resources", "legal"] as const).map(
  (col) => ({
    heading: HEADINGS[col],
    links: [
      ...footerRoutes(col).map((r) => ({ href: r.path, label: r.label })),
      ...EXTRAS[col],
    ],
  }),
);

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
            © {new Date().getFullYear()} Caisson Software LLC
          </p>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-2)" }}>
            Base substrate is{" "}
            <Link href="/legal/license" className="cs-link">
              Apache-2.0
            </Link>
            , free to use. Bundles and modules are commercial.
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
