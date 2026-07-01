// Icon system (ADR-0078 §3): a Lucide line workhorse tuned to 2px stroke on a 24px grid, PLUS
// bespoke domain glyphs for the compliance concepts stock libraries lack (RLS, WORM, audit-chain,
// fail-closed, field-crypto, evidence-pack, the caisson cross-section). One `<Icon name=… />`
// surface so pages never reach for raw Unicode box glyphs again. Server-safe (plain SVG); no
// framework import. lucide-react is a PEER dep. Size is a `data-size` attribute (recipe rule 3),
// not a BEM modifier class.
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  Circle,
  CircleAlert,
  CircleDot,
  Cpu,
  Database,
  FileCheck2,
  Gauge,
  GitBranch,
  Inbox,
  Info,
  KeyRound,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Server,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Terminal,
  TriangleAlert,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, type ReactNode, type Ref, type SVGProps } from "react";

import "./icon.css";

/** Curated Lucide subset — extend here, not with ad-hoc imports in pages. */
const LUCIDE: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  lock: Lock,
  database: Database,
  "file-check": FileCheck2,
  "git-branch": GitBranch,
  terminal: Terminal,
  gauge: Gauge,
  key: KeyRound,
  server: Server,
  cpu: Cpu,
  scale: Scale,
  book: BookOpen,
  wallet: Wallet,
  boxes: Boxes,
  check: Check,
  alert: CircleAlert,
  x: X,
  info: Info,
  circle: Circle,
  "circle-dot": CircleDot,
  arrow: ArrowRight,
  sun: Sun,
  moon: Moon,
  inbox: Inbox,
  "alert-triangle": TriangleAlert,
  dashboard: LayoutDashboard,
  menu: Menu,
  "panel-collapse": PanelLeftClose,
  "panel-expand": PanelLeftOpen,
  cart: ShoppingCart,
};

type BespokeName =
  | "rls"
  | "worm"
  | "audit-chain"
  | "fail-closed"
  | "field-crypto"
  | "evidence-pack"
  | "caisson";

/** Bespoke domain glyphs — 24-grid, 2px stroke, currentColor, no fill (matches Lucide). */
const BESPOKE: Record<
  BespokeName,
  (
    p: SVGProps<SVGSVGElement> & {
      "data-size"?: "md" | "lg";
      ref?: Ref<SVGSVGElement>;
    },
  ) => ReactNode
> = {
  // Row-level security: a table whose locked row admits only the keyed tenant.
  rls: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="2" />
      <path d="M3 14h18" stroke="currentColor" strokeWidth="2" />
      <rect
        x="9.5"
        y="11.2"
        width="5"
        height="4.6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10.6 11.2v-0.8a1.4 1.4 0 0 1 2.8 0v0.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  // WORM: write once, then locked against rewrite.
  worm: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 14v2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Append-only audit chain: interlocking links (link-2 form) with a verified hash tick.
  "audit-chain": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M9.5 16H7.5a4 4 0 0 1 0-8H9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14.5 8h2a4 4 0 0 1 0 8h-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12h7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 4.5v2M12 17.5v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  ),
  // Fail-closed: a gate that defaults shut, denying the crossing.
  "fail-closed": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 8l8 8M16 8l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Per-tenant field encryption: a data field/row locked by a keyhole.
  "field-crypto": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 9.5h18"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.5"
      />
      <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 15v2.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Evidence pack: a stamped, sealed document set.
  "evidence-pack": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M6 3h8l4 4v14H6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.5 14.5l1.8 1.8 3.2-3.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // The caisson cross-section: cold waterline, a shaft down to the working chamber, one light.
  caisson: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M3 6.5q2.2-2 4.5 0t4.5 0t4.5 0t4-0.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11.5V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="6"
        y="11.5"
        width="12"
        height="8.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="15.75" r="1.7" fill="currentColor" />
    </svg>
  ),
};

export type IconName = keyof typeof LUCIDE | BespokeName;

export interface IconProps {
  name: IconName;
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = "md", className, "aria-label": ariaLabel },
  ref,
) {
  const cls = className ? `cs-icon ${className}` : "cs-icon";
  const a11y = ariaLabel
    ? ({ role: "img", "aria-label": ariaLabel } as const)
    : ({ "aria-hidden": true } as const);

  const bespoke = BESPOKE[name as BespokeName];
  if (bespoke)
    return bespoke({ ref, className: cls, "data-size": size, ...a11y });

  const Lucide = LUCIDE[name];
  if (!Lucide) return null;
  return (
    <Lucide
      ref={ref}
      className={cls}
      data-size={size}
      strokeWidth={2}
      {...a11y}
    />
  );
});
