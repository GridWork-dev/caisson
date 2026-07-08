"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, ThemeToggle } from "@caisson/ui/components";
import { adminAuthClient } from "@/lib/admin-auth-client";

// Top-level control-plane sections: ops/observability, business admin, live architecture, the
// decisions SOT board, and the absorbed design studio + component/email catalog.
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/ops", label: "Ops" },
  { href: "/business", label: "Business" },
  { href: "/intel", label: "Intel" },
  { href: "/architecture", label: "Architecture" },
  { href: "/decisions", label: "Decisions" },
  { href: "/catalog", label: "Catalog" },
] as const;

// G34 — apps/admin had no sign-out control anywhere; only the bare better-auth client's
// `.signOut()` existed, unwired. Single-operator + allowlist-of-one, so this is a convenience, not
// an auth hole (access already revokes by narrowing the allowlist) — but a live control still beats
// closing the browser tab.
function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSignOut(): Promise<void> {
    setPending(true);
    await adminAuthClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => void onSignOut()}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link href="/" className="brand" aria-label="Caisson Admin">
          <span className="mark">caisson</span>
          <span className="sub">/ admin</span>
        </Link>
        <nav className="nav" aria-label="Admin sections">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="row" style={{ gap: "1rem", alignItems: "center" }}>
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
