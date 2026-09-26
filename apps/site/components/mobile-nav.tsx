"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import type { MobileNavProps } from "./mobile-drawer";

// Mobile hamburger nav (V27, rebuilt for ADR-0312). This shell is deliberately tiny: just the toggle
// button + route-close. The heavy drawer body (Dialog, search wiring, the accordion sections)
// lives in `mobile-drawer`, dynamically imported on idle or first
// interaction so it leaves the critical hydration path on every marketing page (ADR-0310 A4 /
// ADR-0312 §7). The toggle is display:none above 900px (global.css), so the drawer chunk never even
// arms on desktop until the button exists — no layout shift either way (the button is always there;
// the drawer is a top-layer overlay).
const MobileDrawer = dynamic(
  () => import("./mobile-drawer").then((m) => m.MobileDrawer),
  { ssr: false },
);

export function MobileNav({ sections, cta }: MobileNavProps) {
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change (a drawer link was followed). Owned here — the persistent shell — so the
  // deferred drawer never self-closes on its idle mount. Runs once at page mount (drawer closed,
  // no-op) and on each navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Arm (load the drawer chunk) on idle so it's ready before the first tap without any layout shift;
  // a tap before idle arms it immediately (the onClick below). setTimeout fallback for browsers
  // without idle callbacks. Only idle-arm where the hamburger is actually shown (<=900px, the
  // global.css toggle breakpoint) — desktop never eagerly loads the drawer; a resize-to-mobile user
  // arms on first tap.
  useEffect(() => {
    if (armed) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => setArmed(true));
    } else {
      timerId = setTimeout(() => setArmed(true), 1);
    }
    return () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [armed]);

  return (
    <>
      <button
        type="button"
        className="cs-nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="cs-mobile-menu"
        onClick={() => {
          setArmed(true);
          setOpen((v) => !v);
        }}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      {armed && (
        <MobileDrawer
          open={open}
          onClose={() => setOpen(false)}
          sections={sections}
          cta={cta}
        />
      )}
    </>
  );
}
