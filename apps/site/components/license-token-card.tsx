"use client";

import { useState } from "react";
import { Button, Card, StatusPill } from "@caisson/ui/components";
import { SealBadge } from "@/components/seal-on-proof";
import type { LicenseGrantRow } from "@/lib/dashboard-reads";

export interface LicenseTokenCardProps {
  grant: LicenseGrantRow;
}

/** One issued license major: tier + expiry, a copy-token button (clipboard write needs client JS,
 * hence "use client"), and a verify hint. The token itself is not a secret (`license-grant-store.ts`'s
 * header note: it's already returned to the buyer in the original `/issue` response and is
 * independently offline-verifiable via the public key) — safe to display + copy in full. */
export function LicenseTokenCard({ grant }: LicenseTokenCardProps) {
  const [copied, setCopied] = useState(false);
  const expired = grant.expiry !== null && new Date(grant.expiry) < new Date();

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(grant.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; the token text is still visible/selectable
      // in the <code> block below, so this fails soft.
    }
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--cs-space-3)",
          flexWrap: "wrap",
        }}
      >
        <span className="cs-card-title">
          Major v{grant.major} &middot; {grant.tier}
        </span>
        <StatusPill status={expired ? "expired" : "active"} />
      </div>

      <p
        className="cs-muted"
        style={{
          marginTop: "var(--cs-space-2)",
          fontSize: "var(--cs-text-sm)",
        }}
      >
        {grant.expiry === null
          ? "Perpetual — no expiry."
          : `Expires ${new Date(grant.expiry).toLocaleDateString("en-US", { dateStyle: "medium" })}.`}
      </p>

      <code
        style={{
          display: "block",
          marginTop: "var(--cs-space-4)",
          padding: "var(--cs-space-3)",
          borderRadius: "var(--cs-radius-md)",
          background: "var(--cs-surface-1)",
          border: "1px solid var(--cs-border)",
          fontSize: "var(--cs-text-xs)",
          fontFamily: "var(--cs-font-mono)",
          overflowWrap: "anywhere",
          color: "var(--cs-fg-muted)",
        }}
      >
        {grant.token}
      </code>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
          marginTop: "var(--cs-space-4)",
          flexWrap: "wrap",
        }}
      >
        <Button
          type="button"
          variant="primary"
          onClick={() => void copyToken()}
        >
          {copied ? "Copied" : "Copy token"}
        </Button>
        {/* Seal on Proof (ADR-0334 moment 1): the hairline seal ring draws once when the copy
            lands — mount-triggered, decorative, gone with the 2s copied window. */}
        {copied ? <SealBadge /> : null}
        <span className="cs-muted" style={{ fontSize: "var(--cs-text-xs)" }}>
          Verify offline with{" "}
          <code style={{ fontFamily: "var(--cs-font-mono)" }}>
            verifyLicense()
          </code>{" "}
          from{" "}
          <code style={{ fontFamily: "var(--cs-font-mono)" }}>
            @caisson/license-verify
          </code>{" "}
          — no network call required.
        </span>
      </div>
    </Card>
  );
}
