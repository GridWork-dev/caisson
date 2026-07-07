// The per-entry media manifest (ADR-0285 §3): each bundle/module resolves to an ordered list of
// media slides the <MediaCarousel> renders — in both the card viewer and the module depth pages.
// Pure data (no React): a slide is a DESCRIPTOR; the carousel maps a descriptor to a node. Slide
// sources are all real: the authored diagram set for the top entries, the produced Remotion mp4
// (audit-worm's `video` record), and ui-pro's live component demo. Where nothing else exists, the
// brand mark placeholder auto-fills slide 1 — never a fabricated screenshot (ADR-0082 honesty floor).
import type { IconName } from "@caisson/ui/components";

import { BUNDLE_MARKS, moduleMark } from "./marks";
import { MODULE_PAGES } from "./module-pages";
import { isBundleId } from "./pricing";

export type SlideKind = "diagram" | "image" | "interactive" | "video";

/** The authored token-styled diagram set (ADR-0285 §3) — the homepage's diagram language, given more
 *  character in <MarketplaceDiagram>. Each depicts SHIPPED behaviour only (copy law ADR-0080). */
export type DiagramKey = "rls-deny" | "audit-chain" | "worm-lifecycle";

export interface MediaSlide {
  kind: SlideKind;
  /** One-line honest caption — the a11y label + the visible slide caption. */
  caption: string;
  /** kind === "diagram" — which authored diagram to render. */
  diagram?: DiagramKey;
  /** kind === "image" — the brand mark rendered as placeholder art (decorative). */
  icon?: IconName;
  /** kind === "video" — same-origin asset under /public. */
  src?: string;
  poster?: string;
}

const DIAGRAM_ORDER: readonly DiagramKey[] = [
  "rls-deny",
  "audit-chain",
  "worm-lifecycle",
];

const DIAGRAM_CAPTIONS: Record<DiagramKey, string> = {
  "rls-deny":
    "Per-tenant isolation, fail-closed: a query that never set the tenant context returns zero rows, never everything.",
  "audit-chain":
    "Append-only hash chain: each entry commits SHA-256 over the previous hash — one edited row breaks every link after it.",
  "worm-lifecycle":
    "Evidence lifecycle: a privileged write joins the chain, anchors to WORM under S3 Object-Lock, then verifies and exports.",
};

// Which entries carry which authored diagram (`kind:slug`). Mapped to the top entries whose shipped
// behaviour each diagram actually depicts — the compliance/provenance seam.
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
};

/** The entry's mark, for the placeholder slide and the card glyph. */
function entryMark(kind: "bundle" | "module", id: string): IconName {
  if (kind === "bundle") {
    return isBundleId(id) ? BUNDLE_MARKS[id] : "bundle";
  }
  return moduleMark(id);
}

/** The ordered media slides for one entry (ADR-0285 §3). Authored diagrams first (in canonical
 *  order), then a produced video, then the ui-pro live demo — and if none of those apply, the brand
 *  placeholder as slide 1 so every entry has at least one slide. */
export function mediaSlides(
  kind: "bundle" | "module",
  id: string,
): readonly MediaSlide[] {
  const viewId = `${kind}:${id}`;
  const slides: MediaSlide[] = [];

  for (const key of DIAGRAM_ORDER) {
    if (DIAGRAM_TARGETS[key].has(viewId)) {
      slides.push({
        kind: "diagram",
        diagram: key,
        caption: DIAGRAM_CAPTIONS[key],
      });
    }
  }

  if (kind === "module") {
    const record = MODULE_PAGES.find((r) => r.slug === id);
    if (record?.video) {
      slides.push({
        kind: "video",
        caption:
          "A produced render of the shipped behaviour — append, a tamper attempt, and verify catching it.",
        src: record.video.src,
        ...(record.video.poster !== undefined
          ? { poster: record.video.poster }
          : {}),
      });
    }
    if (id === "ui-pro") {
      slides.push({
        kind: "interactive",
        caption: "The premium component layer on the open base, rendered live.",
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
 *  card badge read this. True when any slide is something other than the fallback placeholder. */
export function entryHasMedia(kind: "bundle" | "module", id: string): boolean {
  return mediaSlides(kind, id).some((s) => s.kind !== "image");
}
