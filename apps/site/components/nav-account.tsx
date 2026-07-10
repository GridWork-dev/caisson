"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";

// The always-visible nav account affordance (mirrors CartTrigger/NavSearchTrigger — a plain inline
// pill, no companion CSS module). Signed out -> "Sign in" (/login); signed in -> "Account"
// (/dashboard). Chrome slice (a): this shell server-defaults to the static "Sign in" pill and only
// idle-mounts the better-auth session read (`nav-account-live`), so better-auth/react leaves the
// critical hydration path on every marketing page. The live child keeps a same-size skeleton so the
// swap to "Account" never shifts layout. Desktop presentation is unchanged.
export const NAV_PILL_STYLE: CSSProperties = {
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

// Code-split so better-auth/react is parsed AND executed off the initial hydration path — the chunk
// only loads once `live` flips on idle.
const NavAccountLive = dynamic(
  () => import("./nav-account-live").then((m) => m.NavAccountLive),
  { ssr: false },
);

export function NavAccount() {
  const [live, setLive] = useState(false);

  // Idle-mount the session swap; setTimeout fallback where requestIdleCallback is absent (Safari).
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => setLive(true));
    } else {
      timerId = setTimeout(() => setLive(true), 1);
    }
    return () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, []);

  if (!live) {
    return (
      <Link
        href="/login"
        style={{ ...NAV_PILL_STYLE, background: "transparent" }}
      >
        Sign in
      </Link>
    );
  }

  return <NavAccountLive />;
}
