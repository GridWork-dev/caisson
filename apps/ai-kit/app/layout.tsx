import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Caisson · AI Production Kit",
  description:
    "Reference app for the @caisson/ai-kit edition: the metered infer() gateway — token metering, hard caps + circuit breaker, versioned prompts, fail-closed guardrails — demonstrated end-to-end with a mock model and an embedded store.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
