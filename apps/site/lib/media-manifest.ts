// The per-entry media manifest (ADR-0290, refining ADR-0285 §3): each bundle/module resolves to an
// ordered list of media slides the <MediaCarousel> renders — in both the card viewer and the module
// depth pages. Pure data (no React): a slide is a DESCRIPTOR; the carousel maps a descriptor to a
// node. Content preference per item, honest-artifact floor (ADR-0082 — every slide depicts SHIPPED
// behaviour, never a fabricated screen):
//   1. `component` — the actual @caisson/ui / @caisson/ui-pro component the item ships, rendered
//      live with static sample data (server-safe/presentational only — a slide never pulls
//      interactive state).
//   2. `code-artifact` — the item's real depth-page artifact (lib/module-pages.ts, single-sourced),
//      rendered via the same framed <CodeBlock> the homepage's honest-artifact section uses.
//   3. `diagram` — an authored mechanism/composition diagram (inline SVG / token-CSS) for
//      concept-only items with neither a showable component nor an artifact. Bundle slides use the
//      parametrized composition pattern (one component, fed each bundle's real member modules).
// Where none of those apply, the brand placeholder auto-fills slide 1 — never a fabricated
// screenshot. All 28 catalog items resolve to real media (ADR-0290) — the placeholder path stays as
// the defensive fallback for a future catalog item not yet wired in.
import type { IconName } from "@caisson/ui/components";

import { BUNDLE_MARKS, moduleMark } from "./marks";
import { MODULE_PAGES } from "./module-pages";
import { type BundleId, BUNDLE_PRICES, isBundleId } from "./pricing";

export type SlideKind = "diagram" | "component" | "code-artifact" | "image";

/** The authored token-styled diagram set (ADR-0285 §3 / ADR-0290) — each depicts SHIPPED behaviour
 *  only (copy law ADR-0080). The three original mechanism diagrams, the eight ADR-0290 additions,
 *  and eight more single-target mechanism diagrams closing the depth-page media gap (Kickoff G W3)
 *  for the modules whose only slide was their code artifact — which the depth page omits (WR-03),
 *  leaving the bare placeholder. */
export type DiagramKey =
  // The ADR-0377 bespoke schematics (blueprint sheets for modules, cross-section strata for
  // bundles — the hybrid direction). Pilot trio first; the remaining surfaces land after the
  // operator's pilot review.
  | "schematic-field-crypto"
  | "schematic-audit-worm"
  | "schematic-compliance"
  | "rls-deny"
  | "audit-chain"
  | "worm-lifecycle"
  | "credits-ledger"
  | "local-sync-merge"
  | "local-inference-egress"
  | "privacy-gate"
  | "tool-exec-gate"
  | "org-controls-mutation"
  | "billing-provider-port"
  | "frameworks-oscal"
  | "alert-pipeline"
  | "meter-reserve-reconcile"
  | "eval-baseline-gate"
  | "guard-fail-closed"
  | "prompt-render-boundary"
  | "local-hybrid-rrf"
  | "agent-lifecycle-fsm"
  | "runner-env-scrub"
  | "trajectory-run-record"
  | "retention-erasure"
  | "access-review-campaign"
  | "risk-register-residual"
  | "trust-page-redaction";

/** The live-rendered kit components wired into a media slide (ADR-0308 full-depth, extending
 *  ADR-0290). A catalog module earns a `component` slide only when it genuinely ships a showable
 *  `@caisson/ui`-rendered surface (the honest floor, ADR-0082 — every slide depicts SHIPPED
 *  behaviour, and the source is nameable):
 *    - `ui-pro` — the product IS a set of UI components (`@caisson/ui-pro`).
 *    - `audit-worm` · `ai-meter` · `prompt-registry` · `local-store` — each ships its OWN embeddable
 *      `@caisson/<mod>/ui` surface (ADR-0250 G2c/G2d): ChainViewer · UsageChart · PromptBrowser ·
 *      StoreSearch, presentational + headless-data-in.
 *    - `credits` — the real buyer-dashboard ledger surface (`@caisson/ui` LedgerList/MetricStat,
 *      apps/site/app/dashboard/credits): what the buyer sees when they hold credits.
 *  Every other catalog module is a backend/library package with no showable UI of its own and
 *  legitimately stays diagram(+code-artifact)-only. */
export type ComponentKey =
  | "ui-pro"
  | "audit-worm"
  | "ai-meter"
  | "prompt-registry"
  | "local-store"
  | "credits";

export interface MediaSlide {
  kind: SlideKind;
  /** One-line honest caption — the a11y label + the visible slide caption. */
  caption: string;
  /** kind === "diagram" — which authored mechanism diagram to render. */
  diagram?: DiagramKey;
  /** kind === "diagram" — a bundle composition slide (the modules→bundle→base pattern) instead of
   *  an authored SVG. Mutually exclusive with `diagram`. */
  compositionBundle?: BundleId;
  /** kind === "component" — which live kit component to render. */
  component?: ComponentKey;
  /** kind === "code-artifact" — the item's real depth-page artifact (module-pages.ts), resolved
   *  once here so the carousel never re-queries MODULE_PAGES itself. */
  artifact?: { label: string; file: string; code: string };
  /** kind === "image" — the brand mark rendered as placeholder art (decorative). */
  icon?: IconName;
}

const DIAGRAM_ORDER: readonly DiagramKey[] = [
  // Schematics lead their page's diagram set (ADR-0377).
  "schematic-field-crypto",
  "schematic-audit-worm",
  "schematic-compliance",
  "rls-deny",
  "audit-chain",
  "worm-lifecycle",
  "credits-ledger",
  "local-sync-merge",
  "local-inference-egress",
  "privacy-gate",
  "tool-exec-gate",
  "org-controls-mutation",
  "billing-provider-port",
  "frameworks-oscal",
  "alert-pipeline",
  "meter-reserve-reconcile",
  "eval-baseline-gate",
  "guard-fail-closed",
  "prompt-render-boundary",
  "local-hybrid-rrf",
  "agent-lifecycle-fsm",
  "runner-env-scrub",
  "trajectory-run-record",
  "retention-erasure",
  "access-review-campaign",
  "risk-register-residual",
  "trust-page-redaction",
];

const DIAGRAM_CAPTIONS: Record<DiagramKey, string> = {
  "schematic-field-crypto":
    "The package in blueprint: HKDF-SHA256 derives a distinct key per tenant, the AEAD gate binds tenant/key-version/column as authenticated data, and the self-describing envelope's byte layout means old key versions decrypt forever.",
  "schematic-audit-worm":
    "The package in blueprint: every append mints a length-keyed anchor into write-once S3 Object-Lock storage, and verify() treats that store as the trusted length oracle, so a cut tail fails even when the surviving prefix hashes clean.",
  "schematic-compliance":
    "The bundle in cross-section: commercial members at the module seam, composing onto the Apache-2.0 kernel and fail-closed RLS base, on Postgres and S3 Object-Lock bedrock; nine of the thirteen pinned members drawn.",
  "rls-deny":
    "Per-tenant isolation, fail-closed: a query that never set the tenant context returns zero rows, never everything.",
  "audit-chain":
    "Append-only hash chain: each entry commits SHA-256 over the previous hash — one edited row breaks every link after it.",
  "worm-lifecycle":
    "Evidence lifecycle: a privileged write joins the chain, anchors to WORM under S3 Object-Lock, then verifies and exports.",
  "credits-ledger":
    "PG-atomic credit ledger: grant, then FIFO-spend, fail-closed at zero — a 402, never a silent negative balance.",
  "local-sync-merge":
    "Two-way offline sync: each device's changesets reconcile through a logical clock to one converged state, no server round-trip.",
  "local-inference-egress":
    "A prompt runs against an on-device ONNX model — inference never leaves the box unless a hosted provider is opted into.",
  "privacy-gate":
    "Every outbound payload crosses a default-deny egress gate: no host is reachable unless a typed allowlist names it.",
  "tool-exec-gate":
    "An agent's command crosses a default-deny allowlist over Zod-strict argv before execFile runs it — never a shell.",
  "org-controls-mutation":
    "An owner-gated mutation crosses the admin-write RLS layer and lands two log rows: the mutation and its audit entry.",
  "billing-provider-port":
    "Four billing providers behind one port: a webhook fulfills exactly once, however many times it's redelivered.",
  "frameworks-oscal":
    "Named framework clauses map to controls, then export as an OSCAL v1.2.2 catalog the evidence packs render against.",
  "alert-pipeline":
    "Five-stage alert pipeline: dedup, rate-cap with digest fallback, timezone-aware quiet hours, then multi-channel delivery — every outcome lands an audit row.",
  "meter-reserve-reconcile":
    "Estimate, reserve, reconcile: credits debit before the provider is called and true up to actual usage — a crossed hard cap trips the breaker, fail-closed.",
  "eval-baseline-gate":
    "Every eval run gates against a committed JSON baseline: a score drop past tolerance fails the build — re-blessing is a deliberate act, never a silent pass.",
  "guard-fail-closed":
    "A flagged input, a credential-shaped string, or a moderator outage blocks the call — fail-closed by default, a typed 422, never a silent pass-through.",
  "prompt-render-boundary":
    "Injection-safe rendering: variables validate against the version's strict schema, then fill placeholders in one escaped pass — a value can never forge a role.",
  "local-hybrid-rrf":
    "Hybrid retrieval: a vec0 vector leg and an FTS5 keyword leg rank independently, then fuse by Reciprocal Rank Fusion — with no vector it degrades to keyword-only.",
  "agent-lifecycle-fsm":
    "The seven-act lifecycle FSM: only legal transitions advance — a failed verify re-opens plan, and an illegal skip throws, never a silent pass.",
  "runner-env-scrub":
    "The child env is built from scratch — a fixed non-secret allowlist plus only the target provider's key — and the run streams to an auditable .jsonl transcript.",
  "trajectory-run-record":
    "Every step, tool proposal, approval, and spend appends to the run's event log — sensitive bodies referenced by digest, a paused run's resume material encrypted at rest — and project() replays the same log to the same projection every time.",
  "retention-erasure":
    "One validated erasure request fans out to every registered target with per-target error isolation — a failing store lands in its own result, never aborting the others — then exactly one reason-tagged audit row is written.",
  "access-review-campaign":
    "An access-review campaign opens over an imported membership snapshot; each reviewee gets a WORM-logged approve/revoke attestation; and the campaign closes only once every reviewee has decided or the deadline passes — any reviewee left undecided is flagged unresolved, never auto-approved.",
  "risk-register-residual":
    "A risk entry's residual is always the computed product of its likelihood and impact rating — never a value the caller supplies — and a register snapshot builds into a byte-stable risk-treatment-plan artifact.",
  "trust-page-redaction":
    "Every evidence-pack fact crosses an allowlist-based redaction gate before either output renders — a field absent from the allowlist never reaches the page, in HTML or JSON, no exceptions.",
};

// Which entries carry which authored diagram (`kind:slug`). Mapped to the top entries whose shipped
// behaviour each diagram actually depicts — the compliance/provenance seam, plus the eight new
// single-target mechanism diagrams.
const DIAGRAM_TARGETS: Record<DiagramKey, ReadonlySet<string>> = {
  // ADR-0377 pilots: a module's bespoke sheet REPLACES the shared generic diagram(s) on that
  // module's own page (the sheet tells the page-specific story the shared diagram only gestured
  // at); the shared diagrams keep their OTHER targets. The compliance strata ADDS to the bundle's
  // set — the composition chip slide and the mechanism diagrams stay until the pilot review says
  // otherwise.
  "schematic-field-crypto": new Set(["module:field-crypto"]),
  "schematic-audit-worm": new Set(["module:audit-worm"]),
  "schematic-compliance": new Set(["bundle:compliance"]),
  // module:field-crypto moved to its bespoke sheet (ADR-0377) — rls-deny stays the isolation
  // story for the compliance seam pages.
  "rls-deny": new Set(["bundle:compliance", "module:compliance-core"]),
  // module:audit-worm moved to its bespoke sheet (ADR-0377).
  "audit-chain": new Set([
    "bundle:compliance",
    "bundle:provenance",
    "module:signing-primitive",
  ]),
  // NOT module:retention-runner — the diagram depicts audit-worm's evidence lifecycle (write/
  // chain/anchor/verify + Object-Lock), not retention sweeps or erasure; showing it on the
  // erasure module's buy surface misrepresents what ships (ADR-0082 artifacts-true-to-built).
  // retention-runner carries its own bespoke `retention-erasure` diagram below.
  // module:audit-worm moved to its bespoke sheet (ADR-0377).
  "worm-lifecycle": new Set(["bundle:compliance", "bundle:provenance"]),
  "credits-ledger": new Set(["module:credits"]),
  "local-sync-merge": new Set(["module:local-sync"]),
  "local-inference-egress": new Set(["module:local-inference"]),
  "privacy-gate": new Set(["module:local-privacy"]),
  "tool-exec-gate": new Set(["module:tool-exec"]),
  "org-controls-mutation": new Set(["module:org-controls"]),
  "billing-provider-port": new Set(["module:billing-orchestration"]),
  "frameworks-oscal": new Set(["module:frameworks-pack"]),
  "alert-pipeline": new Set(["module:alerting"]),
  "meter-reserve-reconcile": new Set(["module:ai-meter"]),
  "eval-baseline-gate": new Set(["module:ai-evals"]),
  "guard-fail-closed": new Set(["module:guardrails"]),
  "prompt-render-boundary": new Set(["module:prompt-registry"]),
  "local-hybrid-rrf": new Set(["module:local-store"]),
  "agent-lifecycle-fsm": new Set(["module:agent-kernel"]),
  "runner-env-scrub": new Set(["module:agent-runner"]),
  "trajectory-run-record": new Set(["module:agent-trajectory"]),
  "retention-erasure": new Set(["module:retention-runner"]),
  "access-review-campaign": new Set(["module:access-review"]),
  "risk-register-residual": new Set(["module:risk-register"]),
  "trust-page-redaction": new Set(["module:trust-page"]),
};

/** Which modules carry a live-component slide, and the honest one-line caption for each (ADR-0308
 *  full-depth). The `component` is the live surface the carousel renders; the caption is the visible
 *  narration + a11y label. Keyed by module id — a module absent here has no showable UI surface and
 *  legitimately stays diagram(+code-artifact)-only. Preference order (ADR-0290): the component slide
 *  leads the module's carousel, ahead of any code-artifact or diagram. */
const MODULE_COMPONENTS: Readonly<
  Record<string, { component: ComponentKey; caption: string }>
> = {
  "ui-pro": {
    component: "ui-pro",
    caption:
      "The premium component layer on the open base, rendered live: the advanced data grid and the hash-chained audit timeline.",
  },
  "audit-worm": {
    component: "audit-worm",
    caption:
      "The module's own embeddable chain viewer, rendered live over a real kernel-built hash chain — the integrity verdict is computed, not asserted.",
  },
  "ai-meter": {
    component: "ai-meter",
    caption:
      "The module's own metered-usage surface, rendered live: per-model credit and cost rollups over usage events, integer units end to end.",
  },
  "prompt-registry": {
    component: "prompt-registry",
    caption:
      "The module's own registry browser, rendered live: one row per name@version with its role shape, variable count, and preview — append-only.",
  },
  "local-store": {
    component: "local-store",
    caption:
      "The module's own search surface, rendered live: a controlled query box over the tenant hybrid store with Reciprocal-Rank-Fusion-ranked hits.",
  },
  credits: {
    component: "credits",
    caption:
      "The buyer's dashboard credits surface, rendered live: the balance tile and the append-only ledger, every delta an integer credit unit.",
  },
};

/** The entry's mark, for the placeholder slide and the card glyph. */
function entryMark(kind: "bundle" | "module", id: string): IconName {
  if (kind === "bundle") {
    return isBundleId(id) ? BUNDLE_MARKS[id] : "bundle";
  }
  return moduleMark(id);
}

/** Honest one-liner for a bundle's composition slide — the real member count, never invented. */
function bundleCompositionCaption(id: BundleId): string {
  if (id === "everything") {
    return "The whole catalog — every bundle and every module — composing onto one Apache-2.0 audited base.";
  }
  const label = BUNDLE_PRICES.find((b) => b.id === id)?.label ?? id;
  return `The ${label} bundle's real member modules, composing onto Caisson's Apache-2.0 audited base.`;
}

export interface MediaSlidesOptions {
  /** Skip the code-artifact slide (ADR-0290 WR-03) — the module depth page already renders
   *  `record.artifact` as a framed CodeBlock in its body, so its carousel would otherwise show
   *  the identical code twice. Card viewer / preview dialog omit this (code-artifact is the only
   *  place they show the code). */
  omitCodeArtifact?: boolean;
}

/** The ordered media slides for one entry (ADR-0290 / ADR-0308). Preference order: a bundle leads
 *  with its composition slide; a module leads with its live component (MODULE_COMPONENTS — the
 *  modules that ship a showable @caisson/ui surface), then its real code artifact (module-pages.ts),
 *  then any authored mechanism diagrams that target it — so a full-depth module carries all three
 *  kinds. If none apply, the brand placeholder is slide 1 so every entry has at least one slide. */
export function mediaSlides(
  kind: "bundle" | "module",
  id: string,
  options?: MediaSlidesOptions,
): readonly MediaSlide[] {
  const viewId = `${kind}:${id}`;
  const slides: MediaSlide[] = [];

  if (kind === "bundle" && isBundleId(id)) {
    slides.push({
      kind: "diagram",
      compositionBundle: id,
      caption: bundleCompositionCaption(id),
    });
  }

  if (kind === "module") {
    const comp = MODULE_COMPONENTS[id];
    if (comp) {
      slides.push({
        kind: "component",
        component: comp.component,
        caption: comp.caption,
      });
    }
  }

  if (kind === "module" && !options?.omitCodeArtifact) {
    const record = MODULE_PAGES.find((r) => r.slug === id);
    if (record) {
      slides.push({
        kind: "code-artifact",
        artifact: {
          label: record.artifact.label,
          file: record.artifact.file,
          code: record.artifact.code,
        },
        caption: record.artifact.label,
      });
    }
  }

  for (const key of DIAGRAM_ORDER) {
    if (DIAGRAM_TARGETS[key].has(viewId)) {
      slides.push({
        kind: "diagram",
        diagram: key,
        caption: DIAGRAM_CAPTIONS[key],
      });
    }
  }

  if (slides.length === 0) {
    slides.push({
      kind: "image",
      caption: "",
      icon: entryMark(kind, id),
    });
  }
  return slides;
}

/** Whether an entry's viewer shows real media (not just the brand placeholder) — the media facet +
 *  card badge read this. True when any slide is something other than the fallback placeholder — a
 *  `code-artifact` slide (a real code snippet) counts as real media on the same footing as a diagram
 *  or a live component (ADR-0290). */
export function entryHasMedia(kind: "bundle" | "module", id: string): boolean {
  return mediaSlides(kind, id).some((s) => s.kind !== "image");
}
