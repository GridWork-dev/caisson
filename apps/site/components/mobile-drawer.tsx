"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchContext } from "fumadocs-ui/contexts/search";

import { Dialog, ThemeToggle } from "@caisson-sh/ui/components";
import { Icon, type IconName } from "@/components";

import { trackEvent } from "@/lib/analytics";
import { Button } from "./button";

// One mobile-drawer link, derived from the desktop panel spec (site-nav.tsx) so mobile can't drift.
export interface MobileNavItem {
  href: string;
  label: string;
  icon: IconName;
}

// A collapsed drawer section (native <details>) — one per desktop panel group.
export interface MobileNavSection {
  group: string;
  icon: IconName;
  items: readonly MobileNavItem[];
}

export interface MobileNavProps {
  sections: readonly MobileNavSection[];
  cta: { href: string; label: string };
}

// Whether `href` is the current page (exact match or a true child segment — a bare startsWith would
// light a sibling route sharing a prefix). Same predicate the desktop panels use.
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function ChevronDown() {
  return (
    <svg
      className="cs-mnav-chev"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * The mobile hamburger drawer body (ADR-0312) — the Accordion Dropdown. Dynamically imported by
 * MobileNav on idle/first-interaction so this whole tree (the Dialog and search wiring) leaves the
 * critical hydration path (ADR-0310 A4). A pinned top block
 * (search · CTA) never scrolls away; three native <details> sections carry the
 * grouped links with the current section defaulting open. Enter/exit + section-expand motion is
 * authored in dialog.css / global.css (ADR-0307). Route-close is owned by MobileNav (the persistent
 * shell), so this component never self-closes on mount.
 */
export function MobileDrawer({
  open,
  onClose,
  sections,
  cta,
}: MobileNavProps & { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Menu"
      variant="drawer"
      side="top"
      hideHeader
      className="cs-mobile-nav-drawer"
    >
      <nav
        id="cs-mobile-menu"
        className="cs-mnav"
        aria-label="Primary (mobile)"
      >
        {/* Pinned top block — sticky, never scrolls away. */}
        <div className="cs-mnav-pinned">
          <SearchRow onClose={onClose} />
          <Button
            href={cta.href}
            variant="primary"
            style={{ width: "100%", marginTop: "var(--cs-space-1)" }}
          >
            {cta.label}
          </Button>
        </div>

        {/* Collapsed sections — the current section defaults open. */}
        {sections.map((s) => {
          const current = s.items.some((it) => isCurrent(pathname, it.href));
          return (
            <details
              key={s.group}
              className="cs-mnav-sec"
              open={current ? true : undefined}
            >
              <summary className="cs-mnav-sum">
                <Icon name={s.icon} />
                <span className="cs-mnav-sum-label">{s.group}</span>
                <ChevronDown />
              </summary>
              <ul className="cs-mnav-list">
                {s.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="cs-mnav-link"
                      aria-current={
                        isCurrent(pathname, it.href) ? "page" : undefined
                      }
                      onClick={onClose}
                    >
                      <Icon name={it.icon} />
                      <span>{it.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}

        {/* Footer utility row — theme toggle moved here (ADR-0312 §5), one aligned block. */}
        <div className="cs-mnav-foot">
          <span className="cs-mnav-foot-label">Theme</span>
          <ThemeToggle />
        </div>
      </nav>
    </Dialog>
  );
}

// Search fix (P0, ADR-0312 §1): the drawer is a top-layer <dialog>; fumadocs' SearchDialog is a plain
// fixed div that would open BEHIND it. Closing the drawer first lifts its modal inertness so the
// search input is reachable and focusable — the verified fix mechanism.
function SearchRow({ onClose }: { onClose: () => void }) {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="cs-mnav-search"
      onClick={() => {
        onClose();
        setOpenSearch(true);
        trackEvent("search_open");
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span>Search</span>
    </button>
  );
}
