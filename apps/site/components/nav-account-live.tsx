"use client";

import Link from "next/link";

import { authClient } from "@/lib/auth-client";
import { NAV_PILL_STYLE } from "./nav-account-style";

// The session-aware half of NavAccount, dynamically imported on idle by the shell (chrome slice a).
// Isolating the better-auth `useSession` read here keeps its parse + execution out of the initial
// hydration chunk. Mid-fetch -> a same-size neutral skeleton so nothing shifts once the session
// resolves; signed in -> "Account" (/dashboard); signed out -> "Sign in" (/login).
export function NavAccountLive() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <span
        aria-hidden="true"
        style={{
          ...NAV_PILL_STYLE,
          border: "1px solid transparent",
          background: "var(--cs-surface-2)",
        }}
      />
    );
  }

  if (!data?.user) {
    return (
      <Link
        href="/login"
        style={{ ...NAV_PILL_STYLE, background: "transparent" }}
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard"
      style={{ ...NAV_PILL_STYLE, background: "transparent" }}
    >
      Account
    </Link>
  );
}
