// apps/local-ai/app/layout.tsx — the root layout for the Local-first AI reference app (ADR-0044).
// Framework-free `@caisson/*` packages do the work; this app is the runnable Next.js App Router shell.
import type { ReactNode } from "react";

export const metadata = {
  title: "Caisson · Local-first AI reference",
  description:
    "Offline, zero-egress reference app for the @caisson/local-ai edition: hybrid retrieval, at-rest field-crypto, offline license verify, and two-way sync convergence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0b0f14",
          color: "#e6edf3",
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}
