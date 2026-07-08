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
 *  only (copy law ADR-0080). The three original mechanism diagrams plus eight new ones closing the
 *  media gap for the modules with neither a showable component nor a depth-page artifact. */
export type DiagramKey =
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
  | "frameworks-oscal";

/** The one live-rendered kit component wired into a media slide today (ADR-0290) — ui-pro is the
 *  only catalog item whose product IS a set of UI components; every other item is a backend/library
 *  package with no showable UI surface of its own. */
export type ComponentKey = "ui-pro";

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
];

const DIAGRAM_CAPTIONS: Record<DiagramKey, string> = {
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
};

// Which entries carry which authored diagram (`kind:slug`). Mapped to the top entries whose shipped
// behaviour each diagram actually depicts — the compliance/provenance seam, plus the eight new
// single-target mechanism diagrams.
const DIAGRAM_TARGETS: Record<DiagramKey, ReadonlySet<string>> = {
  "rls-deny": new Set([
    "bundle:compliance",
    "module:compliance-core",
    "module:field-crypto",
  ]),
  "audit-chain": new Set([
    "bundle:compliance",
    "bundle:provenance",
    "module:audit-worm",
    "module:signing-primitive",
  ]),
  "worm-lifecycle": new Set([
    "bundle:compliance",
    "bundle:provenance",
    "module:audit-worm",
    "module:retention-runner",
  ]),
  "credits-ledger": new Set(["module:credits"]),
  "local-sync-merge": new Set(["module:local-sync"]),
  "local-inference-egress": new Set(["module:local-inference"]),
  "privacy-gate": new Set(["module:local-privacy"]),
  "tool-exec-gate": new Set(["module:tool-exec"]),
  "org-controls-mutation": new Set(["module:org-controls"]),
  "billing-provider-port": new Set(["module:billing-orchestration"]),
  "frameworks-oscal": new Set(["module:frameworks-pack"]),
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

/** The ordered media slides for one entry (ADR-0290). Preference order: a bundle leads with its
 *  composition slide; a module leads with its live component (ui-pro only) or its real code
 *  artifact (module-pages.ts), then any authored mechanism diagrams that target it — and if none of
 *  those apply, the brand placeholder as slide 1 so every entry has at least one slide. */
export function mediaSlides(
  kind: "bundle" | "module",
  id: string,
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

  if (kind === "module" && id === "ui-pro") {
    slides.push({
      kind: "component",
      component: "ui-pro",
      caption:
        "The premium component layer on the open base, rendered live: the advanced data grid and the hash-chained audit timeline.",
    });
  }

  if (kind === "module") {
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
