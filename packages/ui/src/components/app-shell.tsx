"use client";

/**
 * AppShell — the dashboard application shell every buyer-dashboard screen mounts into:
 * a collapsible left sidebar nav + a persistent top bar (account/actions slot) wrapping
 * a scrollable main content region. Below the `md` rung the sidebar becomes an
 * off-canvas drawer, toggled by a topbar hamburger.
 *
 * Styled ONLY via `var(--cs-*)` (recipe rule 2/3) — never branches on light/dark in TS;
 * the token layer flips the theme. Route-agnostic: it renders whatever `nav` + `children`
 * the consumer passes and never owns routing — the consumer's framework router supplies
 * `renderNavItem` for a routed `<Link>`, or the default plain `<a href>` is used.
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./app-shell.css";

export interface AppShellNavItem {
  /** Visible label; also the collapsed-state title tooltip + aria-label. */
  label: string;
  href: string;
  /** Leading glyph via the one `<Icon>` surface. Always visible, both expanded and collapsed. */
  icon?: IconName;
  /** Marks the current route — accent-tint highlight + `aria-current="page"`. */
  active?: boolean;
}

export interface AppShellNavItemRenderProps {
  className: string;
  /** Pre-built icon + label children (the label is visually hidden when collapsed). */
  children: ReactNode;
  "aria-current": "page" | undefined;
  "aria-label": string;
  title: string | undefined;
}

export interface AppShellProps {
  /** Left-sidebar navigation items. */
  nav: readonly AppShellNavItem[];
  /** Top-bar content — account menu / actions. Right-aligned. */
  topBar?: ReactNode;
  /** Extra content rendered inside the mobile off-canvas drawer only (CSS ≤48rem; invisible on
   *  desktop) — e.g. a Sign-out control the topbar can't always spare room for on a narrow
   *  viewport. Typically the same or a subset of what `topBar` already renders. */
  mobileNavFooter?: ReactNode;
  /** Brand slot rendered top-left. Optional and brand-neutral — the kit ships no default mark;
   *  the consumer passes its own (e.g. `<Wordmark />` from `@caisson-sh/brand`). */
  brand?: ReactNode;
  /** Main content region. */
  children: ReactNode;
  /** Override how each nav item renders (e.g. a Next.js `<Link>`); defaults to a plain
   * `<a href>` so the kit stays framework-agnostic. */
  renderNavItem?: (
    item: AppShellNavItem,
    renderProps: AppShellNavItemRenderProps,
  ) => ReactNode;
}

/**
 * AppShell — a buyer-dashboard frame with responsive primary navigation, a persistent top bar,
 * and a scrollable main-content landmark. Recipe-compliant (ADR-0099): co-located CSS reading only
 * `var(--cs-*)`, `data-collapsed` / `data-mobile-nav-open` variants, BEM block `cs-shell`.
 * `"use client"` (collapse + mobile-drawer state).
 *
 * @a11y The mobile-nav and collapse controls expose their state with `aria-expanded` or
 *   `aria-pressed`; the sidebar and main region retain native landmark semantics.
 */
export function AppShell({
  nav,
  topBar,
  mobileNavFooter,
  brand,
  children,
  renderNavItem,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  // Mobile only: the sidebar is an off-canvas drawer (CSS ≤48rem). Has no effect on the
  // desktop grid layout.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  // Escape closes the mobile drawer (parity with the scrim click).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  return (
    <div
      className="cs-shell"
      data-collapsed={collapsed ? "" : undefined}
      data-mobile-nav-open={mobileNavOpen ? "" : undefined}
    >
      <header className="cs-shell__topbar">
        {/* Mobile-only hamburger — toggles the off-canvas sidebar drawer (CSS ≤48rem). */}
        <button
          type="button"
          className="cs-shell__menu-toggle"
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
          aria-controls="cs-shell-sidebar"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Icon name={mobileNavOpen ? "x" : "menu"} />
        </button>

        <div className="cs-shell__brand">{brand}</div>

        {topBar !== undefined ? (
          <div className="cs-shell__topbar-slot">{topBar}</div>
        ) : null}
      </header>

      <aside
        id="cs-shell-sidebar"
        className="cs-shell__sidebar"
        aria-label="Primary"
        data-collapsed={collapsed ? "" : undefined}
      >
        {/* A nav-item click closes the mobile drawer (no-op on desktop). */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- delegation only: the click bubbles from the interactive NavLink <a> children below, which are already keyboard-triggerable (Enter fires a click natively) */}
        <nav className="cs-shell__nav" onClick={closeMobileNav}>
          {nav.map((item) => (
            // Keyed by `label`, not `href`: the label is the item's visible + accessible
            // identity (also the collapsed-state tooltip/aria-label — see AppShellNavItem),
            // while `href` is caller-supplied routing data with no uniqueness guarantee (a
            // placeholder demo nav with repeated `href: "#"` duplicated this key and produced
            // the classic React "two children with the same key" warning).
            <NavLink
              key={item.label}
              item={item}
              collapsed={collapsed}
              renderNavItem={renderNavItem}
            />
          ))}
        </nav>

        <div className="cs-shell__sidebar-footer">
          <button
            type="button"
            className="cs-shell__collapse-toggle"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="cs-shell__collapse-glyph" aria-hidden="true">
              <Icon name={collapsed ? "panel-expand" : "panel-collapse"} />
            </span>
            <span className="cs-shell__collapse-label">Collapse</span>
          </button>
        </div>

        {/* Mobile-only (CSS ≤48rem) — e.g. Sign-out, so it's reachable even when the topbar has
         * no room for it. Invisible on desktop; the sidebar itself is a drawer only
         * below the mobile breakpoint. */}
        {mobileNavFooter !== undefined ? (
          <div className="cs-shell__mobile-nav-footer">{mobileNavFooter}</div>
        ) : null}
      </aside>

      <main className="cs-shell__main" tabIndex={-1}>
        {children}
      </main>

      {/* Mobile drawer scrim — a labeled close affordance (Escape + the hamburger also
       * close it). Hidden on desktop via CSS even if the open-state lingers after a resize. */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="cs-shell__scrim"
          aria-label="Close navigation"
          onClick={closeMobileNav}
        />
      ) : null}
    </div>
  );
}

interface NavLinkProps {
  item: AppShellNavItem;
  collapsed: boolean;
  renderNavItem: AppShellProps["renderNavItem"];
}

function NavLink({ item, collapsed, renderNavItem }: NavLinkProps) {
  const className = item.active
    ? "cs-shell__nav-item cs-shell__nav-item--active"
    : "cs-shell__nav-item";

  const linkChildren = (
    <>
      {item.icon ? (
        <span className="cs-shell__nav-icon" aria-hidden="true">
          <Icon name={item.icon} />
        </span>
      ) : null}
      <span className="cs-shell__nav-label">{item.label}</span>
    </>
  );

  // The collapsed state visually hides the label, so the accessible name comes from
  // aria-label; the native title gives a hover tooltip.
  const renderProps: AppShellNavItemRenderProps = {
    className,
    children: linkChildren,
    "aria-current": item.active ? "page" : undefined,
    "aria-label": item.label,
    title: collapsed ? item.label : undefined,
  };

  if (renderNavItem) return <>{renderNavItem(item, renderProps)}</>;

  return (
    <a
      href={item.href}
      className={className}
      aria-current={renderProps["aria-current"]}
      aria-label={item.label}
      title={renderProps.title}
    >
      {linkChildren}
    </a>
  );
}
