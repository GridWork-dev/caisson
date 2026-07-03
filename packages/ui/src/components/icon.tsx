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
  Users,
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
  users: Users,
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
  | "caisson"
  | "retention-runner"
  | "alerting"
  | "ai-meter"
  | "ai-evals"
  | "guardrails"
  | "prompt-registry"
  | "local-store"
  | "agent-kernel"
  | "agent-runner"
  | "bundle"
  | "plan-tier"
  | "edition-compliance"
  | "edition-ai-kit"
  | "edition-local-ai"
  | "edition-agent-dev";

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
  // Retention runner: policy layers narrow with data age; a scheduled arrow descends to purge the oldest one.
  "retention-runner": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="4.5"
        width="16"
        height="3.4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="3"
        y="10.3"
        width="12"
        height="3.4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="3"
        y="16.1"
        width="8"
        height="3.4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M17 8v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.7 13.7l2.3 2.3 2.3-2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="17.3" r="1.5" fill="currentColor" />
    </svg>
  ),
  // Alert pipeline: raw signals fan in through a dedup/rate-cap gate; exactly one alert survives to fire.
  alerting: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="19" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 6.5L9.5 10M12 5.5V10M19 6.5L14.5 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="8.3"
        y="10"
        width="7.4"
        height="4.6"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 14.6v3.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="19.4" r="1.6" fill="currentColor" />
    </svg>
  ),
  // Token metering: per-tenant usage bars sealed inside the meter, capped by a dashed spend-limit line.
  "ai-meter": (p) => (
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
        d="M7.5 17V11M12 17V9M16.5 17V13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 9h13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="0.2 2.3"
        opacity="0.6"
      />
      <circle cx="12" cy="9" r="1.6" fill="currentColor" />
    </svg>
  ),
  // Eval harness: a change passes node-to-node through a regression-check gate before it's let into CI.
  "ai-evals": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle
        cx="4.3"
        cy="12"
        r="1.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.9 12h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="9.9"
        y="8.3"
        width="6.2"
        height="7.4"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 12.1l1.1 1.2 2.1-2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1 12h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="20.1" cy="12" r="1.7" fill="currentColor" />
    </svg>
  ),
  // Guardrails: raw input/output funnels through one checked seam between app and model.
  guardrails: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 5h16l-6 8h-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 13v4.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.5 9h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  ),
  // Prompt registry: stacked versions with a live rail marking the current rollout.
  "prompt-registry": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="4"
        y="15"
        width="12"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="10"
        width="12"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="5"
        width="12"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M18 7v10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="18" cy="7" r="1.3" fill="currentColor" />
    </svg>
  ),
  // Local hybrid store: a sealed on-disk box holding text rows and one vector match.
  "local-store": (p) => (
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
        d="M7.5 9.5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M7.5 13h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="15" r="1.6" fill="currentColor" />
    </svg>
  ),
  // Agent kernel: a guarded hexagonal boundary holding the typed schema and its active state.
  "agent-kernel": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M12 4l7 4v8l-7 4-7-4V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10.5h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.5 13.5h5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16.3" cy="9.3" r="1.3" fill="currentColor" />
    </svg>
  ),
  // Agent runner: an execution path through an isolated worktree, node by node.
  "agent-runner": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="4.5" y="4.5" width="3" height="3" rx="1" fill="currentColor" />
      <rect x="4.5" y="15.5" width="3" height="3" rx="1" fill="currentColor" />
      <rect x="15.5" y="15.5" width="3" height="3" rx="1" fill="currentColor" />
      <path
        d="M6 8v7.5M8 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  // The Everything bundle: all four editions sharing one waterline and one chamber.
  bundle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M3 7q3-2.6 6 0t6 0t6 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 8.5v3M12 8.5v3M17.5 8.5v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="11.5"
        width="16"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="10.5" y="14" width="3" height="3" rx="0.8" fill="currentColor" />
    </svg>
  ),
  // Plan tiers: ascending steps capped by the current plan.
  "plan-tier": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="4"
        y="13"
        width="3"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="9"
        y="10"
        width="3"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="14"
        y="7"
        width="3"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="15.5" cy="5" r="1.4" fill="currentColor" />
    </svg>
  ),
  // Compliance edition: the caisson waterline/chamber plus a stamped seal-and-ribbon mark — the accreditation medal sealed inside the chamber.
  "edition-compliance": (p) => (
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
      <circle cx="12" cy="14.6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10.6 16.3l-1 3M13.4 16.3l1 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.6" r="0.8" fill="currentColor" />
    </svg>
  ),
  // AI Production Kit edition: the caisson waterline/chamber plus a gauge arc and needle — a live meter reading inside the chamber.
  "edition-ai-kit": (p) => (
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
      <path
        d="M8.8 17.4a3.2 3.2 0 0 1 6.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 17.6l2.3-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.6" r="0.9" fill="currentColor" />
    </svg>
  ),
  // Local-first AI edition: the caisson waterline/chamber plus an on-device chip grounded by one earth bar — compute resident, not phoned home.
  "edition-local-ai": (p) => (
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
      <rect
        x="9.8"
        y="13"
        width="4.4"
        height="3.2"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 16.2v1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.6 18.4h4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="14.6" r="0.7" fill="currentColor" />
    </svg>
  ),
  // Agentic-Dev edition: the caisson waterline/chamber plus a two-node right-angle path — an agent's step from start to current, echoing the node/graph family.
  "edition-agent-dev": (p) => (
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
      <path
        d="M10.6 14.5H13V18.1h0.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="8.4"
        y="13.4"
        width="2.2"
        height="2.2"
        rx="0.6"
        fill="currentColor"
        opacity="0.55"
      />
      <rect
        x="13.4"
        y="17"
        width="2.2"
        height="2.2"
        rx="0.6"
        fill="currentColor"
      />
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
