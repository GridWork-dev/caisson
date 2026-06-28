import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Caisson — Compliance edition reference app",
  description:
    "The P2 Compliance leg: seed → encrypt under withTenantCrypto → lock to WORM + chain anchor → emit + validate a deterministic evidence pack → an unresolved flag blocks generation.",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          lineHeight: 1.6,
          maxWidth: "52rem",
          margin: "0 auto",
          padding: "2.5rem 1.5rem",
        }}
      >
        {children}
      </body>
    </html>
  );
}
