// The Caisson bespoke domain glyphs — the compliance/AI/agent concepts stock icon libraries lack
// (RLS, WORM, audit-chain, field-crypto, evidence-pack, the caisson cross-section, and the module
// marks). 24-grid, 2px stroke, currentColor, no fill (matches the Lucide floor). Private brand IP:
// registered into the @caisson-sh/ui icon surface at app startup via `registerIcons(brandGlyphs)`;
// the kit floor ships no bespoke glyphs of its own. Server-safe (plain SVG, no framework import).
import type { IconGlyph, RegisteredIconName } from "@caisson-sh/ui/components";

/** The 37 bespoke domain glyphs, keyed by the @caisson-sh/ui registry name contract. */
export const brandGlyphs: Record<RegisteredIconName, IconGlyph> = {
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
  // Agent runner: an execution path through an isolated worktree, node by node. A stepped
  // diagonal (not a single right-angle elbow) so the glyph reads as a path, not the letter "L".
  "agent-runner": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="4.5" y="4.5" width="3" height="3" rx="1" fill="currentColor" />
      <rect x="10.5" y="10.5" width="3" height="3" rx="1" fill="currentColor" />
      <rect x="16.5" y="16.5" width="3" height="3" rx="1" fill="currentColor" />
      <path
        d="M6 8v3.5h5M12 14v3.5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  // Access review: a frozen campaign roster with explicit approve and revoke decisions.
  "access-review": (p) => (
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
      <circle cx="7" cy="9" r="1" fill="currentColor" />
      <path
        d="M10 9h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.3 8.8l1.2 1.2 2.3-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="15" r="1" fill="currentColor" />
      <path
        d="M10 15h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M15.8 13.8l2.6 2.6M18.4 13.8l-2.6 2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Risk register: a likelihood × impact matrix with one scored risk moving into treatment.
  "risk-register": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M9 3v18M15 3v18M3 9h18M3 15h18"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.45"
      />
      <circle cx="17.5" cy="6.5" r="1.4" fill="currentColor" />
      <path
        d="M17 8l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11.5 10.7v2.8h2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Trust page: a host-anywhere browser surface exposing only the facts a customer may inspect.
  "trust-page": (p) => (
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
      <path d="M3 8h18" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <circle cx="6" cy="6" r="0.8" fill="currentColor" />
      <path
        d="M6.5 14c1.4-2 3.2-3 5.5-3s4.1 1 5.5 3c-1.4 2-3.2 3-5.5 3s-4.1-1-5.5-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" />
    </svg>
  ),
  // Agent trajectory: an append-only run record — step-dots along a replayable path that branches once.
  "agent-trajectory": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 18h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.5 18l3.5-4.5H18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
      <circle cx="10.5" cy="18" r="1.5" fill="currentColor" />
      <circle cx="17" cy="18" r="1.5" fill="currentColor" />
      <circle cx="18" cy="13.5" r="1.5" fill="currentColor" />
    </svg>
  ),
  // Governed tool execution: a prompt chevron and cursor sealed inside a terminal frame with a title rail.
  "tool-exec": (p) => (
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
        d="M3 8.5h18"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.5"
      />
      <path
        d="M7 11.5l3 2.3-3 2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 16h4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Cross-tenant admin controls: a row of tenant panels governed by one admin key held above them.
  "org-controls": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="13"
        width="5"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="9.5"
        y="13"
        width="5"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="16"
        y="13"
        width="5"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="6" r="2.4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8.4v2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M11 10h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Compliance core: nested evidence layers wrapped around one verified OSCAL center.
  "compliance-core": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.55"
      />
      <path
        d="M9.6 12l1.7 1.7 3.1-3.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Billing orchestration: a subscription cycle that grants one credit unit each turn.
  "billing-orchestration": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17.5 3.5v3.5H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 10.6v2.8M10.6 12h2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Premium component tier: an elevated component card raised above the base panel.
  "ui-pro": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.5"
      />
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 8.3h12"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.6"
      />
      <circle cx="7.3" cy="6.1" r="0.9" fill="currentColor" />
    </svg>
  ),
  // On-device inference: a compute chip processing a live signal pulse.
  "local-inference": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 10h2M4 14h2M18 10h2M18 14h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.5 12.5h1.5l1.5-3 2 5 1.5-2h1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // On-device privacy: data guarded by a shield resident inside the chip.
  "local-privacy": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 10h2M4 14h2M18 10h2M18 14h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 8l3.2 1.3v2.4c0 2.1-1.5 3.2-3.2 3.9-1.7-0.7-3.2-1.8-3.2-3.9V9.3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Local-first sync: records exchanged both ways from the on-device chip.
  "local-sync": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 10h2M4 14h2M18 10h2M18 14h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 11.5h4.5l-1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 14.5h-4.5l1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Frameworks pack: multiple compliance frameworks tiled into one registry, one verified.
  "frameworks-pack": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="13"
        y="13"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M14.8 16.6l1.3 1.3 2.3-2.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Ed25519 signing primitive: a key laying down a signature flourish.
  "signing-primitive": (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="7.5" cy="8.5" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.6 10.6l5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.8 13.8l1.5-1.5M14.6 15.6l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 19.5q2.5-2 4.5 0t4.5-0.4t3-0.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  ),
  // Integer credit ledger: usage rows posted beside one credit unit token.
  credits: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 7.5h8M4 12h8M4 16.5h5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17" cy="14" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="14" r="0.9" fill="currentColor" />
    </svg>
  ),
};
