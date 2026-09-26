// Icon system: a Lucide line workhorse tuned to 2px stroke on a 24px grid, PLUS a runtime registry
// for bespoke domain glyphs the consuming app supplies. One `<Icon name=… />` surface so pages never
// reach for raw Unicode box glyphs again. The kit floor ships ONLY the Lucide set — bespoke glyphs
// are private brand IP; an app registers them at module scope via `registerIcons(...)`. Server-safe
// (plain SVG, no React Context); no framework import. lucide-react is a PEER dep. Size is a
// `data-size` attribute (recipe rule 3), not a BEM modifier class.
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Check,
  Circle,
  CircleAlert,
  CircleDot,
  CircleUser,
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
  "circle-user": CircleUser,
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

/**
 * The bespoke domain-glyph name contract. The kit floor ships NO bespoke glyphs — their SVG art is
 * private brand IP in `@caisson-sh/brand`. This union is the type-only registry key set: it keeps every
 * `<Icon name="worm" />` call site fully type-checked (a typo is a compile error), while the glyphs
 * themselves are supplied at runtime by the consuming app via `registerIcons(brandGlyphs)`. Adding a
 * name here obliges `@caisson-sh/brand` to provide its glyph (its map is typed against this union).
 */
export type RegisteredIconName =
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
  | "edition-agent-dev"
  | "access-review"
  | "risk-register"
  | "trust-page"
  | "agent-trajectory"
  | "tool-exec"
  | "org-controls"
  | "compliance-core"
  | "billing-orchestration"
  | "ui-pro"
  | "local-inference"
  | "local-privacy"
  | "local-sync"
  | "frameworks-pack"
  | "signing-primitive"
  | "credits";

/** A bespoke glyph: the render-function shape the registry stores and `<Icon>` invokes. */
export type IconGlyph = (
  props: SVGProps<SVGSVGElement> & {
    "data-size"?: "md" | "lg";
    ref?: Ref<SVGSVGElement>;
  },
) => ReactNode;

/**
 * The bespoke-glyph registry: a module-level mutable map, one instance per bundle graph. Server-safe
 * (no React Context, no hook) so it works in RSC and client bundles alike. Empty by default — the
 * open kit ships no bespoke glyphs; the consuming app populates it via `registerIcons`.
 */
const REGISTRY: Partial<Record<RegisteredIconName, IconGlyph>> = {};

/**
 * Register bespoke glyphs into the kit icon surface. Idempotent (later keys override). Call at MODULE
 * scope so it runs before render. The registry is per-bundle-graph mutable state: a Next app that
 * renders bespoke icons in BOTH server and client components must run this in each graph (e.g. from
 * the root layout for the server graph and a shared client barrel for the client graph).
 */
export function registerIcons(
  glyphs: Partial<Record<RegisteredIconName, IconGlyph>>,
): void {
  Object.assign(REGISTRY, glyphs);
}

export type IconName = keyof typeof LUCIDE | RegisteredIconName;

export interface IconProps {
  name: IconName;
  size?: "md" | "lg";
  className?: string;
  "aria-label"?: string;
}

/**
 * Icon — the one glyph surface for Lucide icons and registered Caisson domain marks. Decorative
 * icons are hidden from assistive technology by default; supplying `aria-label` promotes the SVG
 * to a named `img`. The fixed size union is expressed through `data-size` for token-driven CSS.
 *
 * @a11y Omit `aria-label` for decorative glyphs; provide it to expose a named image.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = "md", className, "aria-label": ariaLabel },
  ref,
) {
  const cls = className ? `cs-icon ${className}` : "cs-icon";
  const a11y = ariaLabel
    ? ({ role: "img", "aria-label": ariaLabel } as const)
    : ({ "aria-hidden": true } as const);

  const registered = REGISTRY[name as RegisteredIconName];
  if (registered)
    return registered({ ref, className: cls, "data-size": size, ...a11y });

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
