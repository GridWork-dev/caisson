"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "./button";

// Mobile hamburger nav (V27). The toggle + drawer are display:none above 680px (global.css); the
// shell's desktop link row stays as-is. Closes on route change and on Escape.
export function MobileNav({
  links,
  cta,
}: {
  links: readonly { href: string; label: string }[];
  cta?: { href: string; label: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
      <nav
        id="cs-mobile-menu"
        className="cs-nav-mobile"
        data-open={open}
        aria-label="Primary (mobile)"
      >
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
      </nav>
    </>
  );
}
