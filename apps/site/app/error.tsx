"use client";

// Error boundary — client component required by Next.js (receives error + reset).
// No stack trace in prod copy; terse technical register per ADR-0080.
import { useEffect } from "react";

import { Section } from "@/components";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to your error reporting pipeline here (Sentry, etc.).
    // Never log.error in prod — omitted intentionally.
  }, [error]);

  const digest = error.digest;

  return (
    <main id="main-content">
      <Section flush>
        <p className="cs-eyebrow" style={{ marginBottom: "var(--cs-space-5)" }}>
          Runtime error
        </p>
        <h2
          style={{
            fontSize: "var(--cs-text-3xl)",
            fontWeight: "var(--cs-weight-semibold)",
            letterSpacing: "var(--cs-tracking-tight)",
            lineHeight: "var(--cs-leading-tight)",
            marginBottom: "var(--cs-space-4)",
          }}
        >
          Something went wrong.
        </h2>
        <p
          className="cs-muted"
          style={{
            fontSize: "var(--cs-text-base)",
            marginBottom: "var(--cs-space-8)",
            maxWidth: "52ch",
          }}
        >
          An unexpected error occurred rendering this page. You can retry, or
          navigate away. If it persists, the digest below helps track it down.
        </p>
        <div className="cs-cta-row">
          <button
            type="button"
            onClick={reset}
            className="cs-btn cs-btn--primary"
          >
            Retry
          </button>
          <a href="/" className="cs-btn cs-btn--ghost">
            Home
          </a>
        </div>
        {digest && (
          <p
            className="mono"
            style={{
              marginTop: "var(--cs-space-12)",
              fontSize: "var(--cs-text-xs)",
              color: "var(--cs-fg-muted)",
            }}
          >
            <span className="cs-tok-muted">digest: </span>
            <span className="cs-tok-danger">{digest}</span>
          </p>
        )}
      </Section>
    </main>
  );
}
