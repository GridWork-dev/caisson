// 404 — server component. Static export emits a real 404.html via normalize-export.
// Terse, command-forward copy per ADR-0080 (no "platform", no exclamation, dev-kit register).
import type { Metadata } from "next";

import { Section, Button } from "@/components";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "404",
  description: "No route found at this path.",
};

export default function NotFound() {
  return (
    <>
      <SiteNav />
      {/* Center the terse 404 content in the viewport instead of pinning it to the top with a large
          empty region down to the footer (visual-audit dead-space). Left-aligned copy stays (dev-kit
          register); only the vertical void is filled. */}
      <main
        id="main-content"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: "70vh",
        }}
      >
        <Section flush>
          <p
            className="cs-eyebrow"
            style={{ marginBottom: "var(--cs-space-5)" }}
          >
            404
          </p>
          <h1
            style={{
              fontSize: "var(--cs-text-3xl)",
              fontWeight: "var(--cs-weight-semibold)",
              letterSpacing: "var(--cs-tracking-tight)",
              lineHeight: "var(--cs-leading-tight)",
              marginBottom: "var(--cs-space-4)",
            }}
          >
            No route here.
          </h1>
          <p
            className="cs-muted"
            style={{
              fontSize: "var(--cs-text-base)",
              marginBottom: "var(--cs-space-8)",
              maxWidth: "48ch",
            }}
          >
            The path you followed doesn&apos;t resolve to a page. Check the URL
            or use the links below to get back on track.
          </p>
          <div className="cs-cta-row">
            <Button href="/" variant="primary">
              Home
            </Button>
            <Button href="/docs" variant="ghost">
              Documentation
            </Button>
          </div>
          <p
            className="mono"
            style={{
              marginTop: "var(--cs-space-12)",
              fontSize: "var(--cs-text-xs)",
              color: "var(--cs-fg-muted)",
            }}
          >
            <span className="cs-tok-muted">$ </span>
            <span className="cs-tok-danger">ERROR</span>
            {" — ENOROUTE: no such path"}
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
