"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button, ThemeToggle } from "@caisson/ui/components";
import { adminAuthClient } from "@/lib/admin-auth-client";

// Top-level control-plane sections: ops/observability, business admin, product analytics,
// support health, live architecture, the decisions SOT board, and the absorbed design
// studio + component/email catalog.
const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/ops", label: "Ops" },
  { href: "/business", label: "Business" },
  { href: "/product", label: "Product" },
  { href: "/support", label: "Support" },
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

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Shared between the desktop row and the mobile disclosure panel so the two link lists can't drift.
function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(pathname, l.href) ? "page" : undefined}
          {...(onNavigate ? { onClick: onNavigate } : {})}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A route change (panel link followed, or back/forward) always closes the panel.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // ADR-0374 (mobile-nav-collapse rows, e.g. e0817bf3ed27130b/a4f11203b0723c0a): the 9-link row
  // wrapped to 3+ stacked rows at narrow widths with no collapse. Escape-closes-and-returns-focus
  // is the one piece of behavior a plain <details> panel doesn't give for free, so a button+panel
  // with explicit aria-expanded (rather than <details>) is the simplest correct fit here.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // The signed-out /login page must never render the authenticated shell (full nav + sign-out) —
  // there is no session yet to sign out of, and it falsely implies the visitor is already in.
  if (pathname === "/login") return null;
  return (
    <header className="topbar">
      <div className="row" style={{ gap: "1.5rem" }}>
        <Link href="/" className="brand" aria-label="Caisson Admin">
          <span className="mark">caisson</span>
          <span className="sub">/ admin</span>
        </Link>
        <nav className="nav nav--desktop" aria-label="Admin sections">
          <NavLinks pathname={pathname} />
        </nav>
      </div>
      <div className="row" style={{ gap: "1rem", alignItems: "center" }}>
        <button
          type="button"
          ref={toggleRef}
          className="admin-nav-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        <ThemeToggle />
        <SignOutButton />
      </div>
      {open && (
        <nav
          id={panelId}
          className="admin-nav-panel"
          aria-label="Admin sections"
        >
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      )}
    </header>
  );
}
