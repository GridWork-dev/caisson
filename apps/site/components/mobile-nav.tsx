"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { Dialog, ThemeToggle } from "@caisson/ui/components";

import { Button } from "./button";
import { NavAccount } from "./nav-account";

// Mobile hamburger nav (V27). The toggle is display:none above 680px (global.css); the shell's
// desktop link row stays as-is. Closes on route change. Built on the open `Dialog` primitive's
// drawer variant (ADR-0296 — supersedes ADR-0295's hand-rolled ui-pro `Drawer`) — native
// `<dialog>` + `showModal()` supplies Escape, scrim-click, focus trap, inert background, and
// focus-return, not us.
export function MobileNav({
  links,
  cta,
  search,
}: {
  links: readonly { href: string; label: string }[];
  cta?: { href: string; label: string };
  /** Optional search affordance rendered at the top of the drawer (D-9). */
  search?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="cs-nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="cs-mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Mobile menu"
        variant="drawer"
        side="top"
        hideHeader
        className="cs-mobile-nav-drawer"
      >
        <nav
          id="cs-mobile-menu"
          className="cs-nav-mobile"
          aria-label="Primary (mobile)"
        >
          {search && (
            <div style={{ marginBottom: "var(--cs-space-2)" }}>{search}</div>
          )}
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
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
          {cta && (
            <Button
              href={cta.href}
              variant="primary"
              style={{ marginTop: "var(--cs-space-3)" }}
            >
              {cta.label}
            </Button>
          )}
          <div
            style={{
              marginTop: "var(--cs-space-3)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <NavAccount />
          </div>
          {/* Theme toggle reachable on mobile (ADR-0194 / ADR-0195 — was desktop-only). */}
          <div style={{ marginTop: "var(--cs-space-4)" }}>
            <ThemeToggle />
          </div>
        </nav>
      </Dialog>
    </>
  );
}
