"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

// The always-visible nav account affordance (mirrors CartTrigger/NavSearchTrigger — a plain inline
// pill, no companion CSS module). Signed out -> "Sign in" (/login); signed in -> "Account"
// (/dashboard); mid-fetch -> a same-size neutral skeleton so nothing shifts once the session
// resolves.
const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  minWidth: "4.5rem",
  padding: "0 var(--cs-space-3)",
  borderRadius: "var(--cs-radius-md)",
  border: "1px solid var(--cs-border)",
  color: "var(--cs-fg)",
  fontSize: "var(--cs-text-sm)",
};

export function NavAccount() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <span
        aria-hidden="true"
        style={{
          ...pillStyle,
          border: "1px solid transparent",
          background: "var(--cs-surface-2)",
        }}
      />
    );
  }

  if (!data?.user) {
    return (
      <Link href="/login" style={{ ...pillStyle, background: "transparent" }}>
        Sign in
      </Link>
    );
  }

  return (
    <Link href="/dashboard" style={{ ...pillStyle, background: "transparent" }}>
      Account
    </Link>
  );
}
