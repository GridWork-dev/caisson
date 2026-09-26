"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodeBlock, Faq, Icon, StatusChip } from "@/components";
import { EntryLinks } from "@/components/entry-links";
import { MediaCarousel } from "@/components/media-carousel";
import { bundleLabel, bundlePagePath } from "@/components/marketplace";
import { TrialPath } from "@/components/trial-path";
import { bundlePageRecord } from "@/lib/bundle-pages";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import { mediaSlides, type MediaSlide } from "@/lib/media-manifest";
import { MODULE_PAGES } from "@/lib/module-pages";
import { entryByViewId, type SurfaceEntry } from "@/lib/marketplace-surface";
import { modulePostureGroup } from "@/lib/stack-fit";
import { TruthfulSignals } from "@/components/truthful-signals";
import type { TruthfulSignal } from "@/lib/trust-signals";
import { isBundleId, MODULES, modulesByBundle } from "@/lib/catalog";

// Universal stack-compat badges — true of every module (TypeScript source, composed on the shared
// base). No per-module compat field exists, so these are the honest shared facts, never a
// fabricated per-module claim (copy law ADR-0080).
const STACK_COMPAT: readonly string[] = ["TypeScript", "Composes on the base"];

/** The normalized view model — the ONE shape the shared chrome renders, adapted from the two data
 *  shapes (a module's depth record vs a family's members). */
interface ViewModel {
  entry: SurfaceEntry;
  mark: string;
  kindLabel: "Module" | "Module family";
  slides: readonly MediaSlide[];
  faq: readonly { question: string; answer: string }[];
  footer: { href: string; label: string } | null;
  /** Kind-specific metadata rendered ABOVE the media region (CAISSON-68: blurb + badges first,
   *  so the dialog opens on what the thing IS, never on a full-height code panel). */
  badges?: React.ReactNode;
  /** Kind-specific body — rendered below the shared media + blurb. */
  body: React.ReactNode;
}

function buildViewModel(
  entry: SurfaceEntry,
  signals: readonly TruthfulSignal[],
): ViewModel {
  // omitCodeArtifact (ADR-0290 WR-03): the dialog body renders the record's artifact itself as a
  // bounded CodeBlock below, so a code-artifact carousel slide would show the identical code
  // twice — and, unclamped, it filled the whole dialog (CAISSON-68).
  // leadWithPoke (ADR-0378 lock 1): the card viewer leads with the interactive poke.
  const slides = mediaSlides(entry.kind, entry.id, {
    omitCodeArtifact: true,
    leadWithPoke: true,
  });
  if (entry.kind === "module") return moduleViewModel(entry, slides);
  return bundleViewModel(entry, slides, signals);
}

function moduleViewModel(
  entry: SurfaceEntry,
  slides: readonly MediaSlide[],
): ViewModel {
  const m = MODULES.find((p) => p.id === entry.id);
  const record = MODULE_PAGES.find((r) => r.slug === entry.id);
  const hasDetail = record !== undefined;
  // The module's honest DB posture (ADR-0285 §2).
  const posture = modulePostureGroup(entry.id);
  return {
    entry,
    mark: moduleMark(entry.id),
    kindLabel: "Module",
    slides,
    faq: record?.faq ?? [],
    footer: hasDetail
      ? { href: `/marketplace/modules/${entry.id}`, label: "Open full page →" }
      : null,
    badges: (
      // DB posture (single-sourced from lib/stack-fit) + stack-compat + family-membership badges —
      // above the media region, so the module's identity reads before any artifact (CAISSON-68).
      <div className="cs-preview-badges">
        {posture ? (
          <StatusChip
            label={posture.heading}
            icon={posture.icon}
            tone="accent"
          />
        ) : null}
        {STACK_COMPAT.map((c) => (
          <StatusChip key={c} label={c} tone="muted" />
        ))}
        {m && m.bundles.length === 0 ? (
          <span className="cs-muted" style={{ fontSize: "var(--cs-text-xs)" }}>
            Standalone: not part of any module family.
          </span>
        ) : (
          m?.bundles.map((b) => (
            <Link
              key={b}
              href={bundlePagePath(b)}
              className="cs-chip"
              style={{ textDecoration: "none" }}
            >
              {bundleLabel(b)}
            </Link>
          ))
        )}
      </div>
    ),
    body: (
      <>
        <TrialPath compact />

        {record ? (
          <>
            <p className="cs-preview-def">{record.definition}</p>
            <ul className="cs-preview-list">
              {record.included.map((item, i) => (
                <li key={`${entry.id}-${i}`}>
                  <strong>{item.title}:</strong> {item.body}
                </li>
              ))}
            </ul>
            {/* Bounded code region (CAISSON-68): the artifact scrolls inside its own clamp instead
                of consuming the whole dialog — context first, code as its own bounded panel. */}
            <div className="cs-preview-code">
              <CodeBlock
                frame
                code={record.artifact.code}
                label={`${record.artifact.label}: ${record.artifact.file}`}
              />
            </div>
            {record.faq.length > 0 ? <Faq items={record.faq} /> : null}
          </>
        ) : null}
      </>
    ),
  };
}

function bundleViewModel(
  entry: SurfaceEntry,
  slides: readonly MediaSlide[],
  signals: readonly TruthfulSignal[],
): ViewModel {
  const record = bundlePageRecord(entry.id);
  const isEverything = entry.id === "everything";
  const members = isBundleId(entry.id) ? modulesByBundle(entry.id) : [];

  return {
    entry,
    mark: isBundleId(entry.id) ? BUNDLE_MARKS[entry.id] : "bundle",
    kindLabel: "Module family",
    slides,
    faq: record?.faq ?? [],
    footer:
      isBundleId(entry.id) && !isEverything
        ? {
            href: bundlePagePath(entry.id),
            label: `Open the ${bundleLabel(entry.id)} page →`,
          }
        : null,
    body: (
      <>
        {record ? <p className="cs-preview-def">{record.definition}</p> : null}

        <TruthfulSignals signals={signals} />

        {isEverything ? (
          <p className="cs-muted cs-preview-def">
            Everything is the whole catalog: all {MODULES.length} modules across
            every module family, composed onto one audited base.
          </p>
        ) : members.length > 0 ? (
          <ul className="cs-preview-members">
            {members.map((m) => (
              <li key={m.id}>
                <Icon name={moduleMark(m.id)} />
                <span style={{ flex: 1 }}>{m.label}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <TrialPath compact />

        {record && record.faq.length > 0 ? <Faq items={record.faq} /> : null}
      </>
    ),
  };
}

/**
 * The unified card-viewer dialog (ADR-0285 §1) — ONE dialog serving both kinds over a discriminated
 * union `{kind, id}` (resolved from the kind-namespaced `viewId`). Merges the two near-identical
 * preview dialogs' chrome: native `<dialog>` + `showModal()` (focus trap, Escape-to-close,
 * focus-return), a fixed header, a scrolling body led by the media carousel, and a fixed footer
 * (docs · live demo · full page). The data-shape difference (a module's depth record vs a family's
 * members) is normalized in the adapter above; the chrome never forks.
 */
export function PreviewDialog({
  viewId,
  onClose,
  signals,
  docsHrefs,
}: {
  viewId: string | null;
  onClose: () => void;
  signals: readonly TruthfulSignal[];
  docsHrefs: Readonly<Record<string, string>>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Memoized on viewId so vm (and vm.slides) keeps a stable identity across parent re-renders —
  // MediaCarousel resets its index on a new `slides` reference, so a fresh array every render
  // would snap an open carousel back to slide 1 whenever theme context re-renders the tree.
  const liveVm = useMemo(() => {
    const entry = viewId ? entryByViewId(viewId) : undefined;
    return entry ? buildViewModel(entry, signals) : undefined;
  }, [viewId, signals]);

  // Retain the last-resolved view model through the authored close (ADR-0307): the parent nulls
  // viewId at close, and unmounting the shell in that same render would leave the exit transition
  // animating an empty panel. `heldVm` keeps the content mounted until the dialog's exit
  // transition finishes (cleared on transitionend while closed).
  const [heldVm, setHeldVm] = useState<ViewModel | undefined>(undefined);
  if (liveVm && liveVm !== heldVm) setHeldVm(liveVm);
  const vm = liveVm ?? heldVm;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (liveVm && !dlg.open) dlg.showModal();
    else if (!liveVm && dlg.open) dlg.close();
  }, [liveVm]);

  return (
    <>
      {/* ponytail: the position/::backdrop/breakpoint rules a <dialog> needs can't ride inline
       *  styles, so they live in one scoped <style> tag (the module/bundle-dialog precedent this
       *  merges). max-height (not height) so a record-less entry renders a short card. */}
      <style>{`
        .cs-preview-dialog {
          margin: auto;
          padding: 0;
          width: min(92vw, 64rem);
          max-height: min(90vh, 52rem);
          border: 0;
          border-radius: var(--cs-radius-lg);
          background: var(--cs-surface-1);
          color: var(--cs-fg);
          box-shadow: var(--cs-shadow-lg);
          overflow: hidden;
          /* Authored open/close (ADR-0078 §6). @starting-style + allow-discrete animate a top-layer
             <dialog> across display; transform/opacity only. This base rule's timing is the EXIT
             (closing settles back to it) — a token faster than the enter on [open] below. Reduced
             motion: base.css zeroes every transition-duration !important, so this collapses to an
             instant swap with the element never stuck hidden ([open] sets opacity:1 regardless). */
          opacity: 0;
          transform: scale(0.98) translateY(4px);
          transition:
            opacity var(--cs-duration-fast) var(--cs-ease-out),
            transform var(--cs-duration-fast) var(--cs-ease-out),
            overlay var(--cs-duration-fast) allow-discrete,
            display var(--cs-duration-fast) allow-discrete;
        }
        .cs-preview-dialog[open] {
          opacity: 1;
          transform: scale(1) translateY(0);
          transition:
            opacity var(--cs-duration-base) var(--cs-ease-out),
            transform var(--cs-duration-base) var(--cs-ease-out),
            overlay var(--cs-duration-base) allow-discrete,
            display var(--cs-duration-base) allow-discrete;
        }
        @starting-style {
          .cs-preview-dialog[open] {
            opacity: 0;
            transform: scale(0.98) translateY(4px);
          }
        }
        .cs-preview-dialog::backdrop {
          background: var(--cs-scrim);
          opacity: 0;
          transition:
            opacity var(--cs-duration-fast) var(--cs-ease-out),
            overlay var(--cs-duration-fast) allow-discrete,
            display var(--cs-duration-fast) allow-discrete;
        }
        .cs-preview-dialog[open]::backdrop {
          opacity: 1;
          transition:
            opacity var(--cs-duration-base) var(--cs-ease-out),
            overlay var(--cs-duration-base) allow-discrete,
            display var(--cs-duration-base) allow-discrete;
        }
        @starting-style {
          .cs-preview-dialog[open]::backdrop { opacity: 0; }
        }
        .cs-preview-shell { max-height: inherit; display: flex; flex-direction: column; }
        .cs-preview-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: var(--cs-space-4);
          padding: var(--cs-space-5) var(--cs-space-6) var(--cs-space-4);
          border-bottom: 1px solid var(--cs-border);
        }
        .cs-preview-close {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.75rem; height: 1.75rem; flex: none; border: 0;
          border-radius: var(--cs-radius-sm); background: none;
          color: var(--cs-fg-muted); cursor: pointer;
        }
        .cs-preview-body {
          flex: 1 1 auto; min-height: 0; overflow-y: auto;
          padding: var(--cs-space-5) var(--cs-space-6);
          display: grid; gap: var(--cs-space-5);
        }
        /* Grid items default to min-width auto — a wide artifact (a code pre, a diagram frame)
           would expand the track past the dialog, clipping the carousel controls and the page
           count. Every body child must shrink to the dialog's width; inner surfaces scroll. */
        .cs-preview-body > * { min-width: 0; max-width: 100%; }
        /* Bounded code region: the artifact's terminal BODY scrolls internally (both axes)
           instead of consuming the dialog — blurb, badges, and media stay reachable within the
           90vh shell. The clamp sits on the scrolling pre itself, not the wrapper: a max-height +
           overflow grid item resolves to a 0-height row in Chromium and overlaps the FAQ. */
        .cs-preview-code .cs-terminal__body {
          max-height: min(40vh, 20rem); overflow-y: auto;
        }
        .cs-preview-foot {
          padding: var(--cs-space-4) var(--cs-space-6) var(--cs-space-5);
          border-top: 1px solid var(--cs-border);
          display: flex; align-items: center; gap: var(--cs-space-4); flex-wrap: wrap;
        }
        .cs-preview-badges {
          display: flex; flex-wrap: wrap; gap: var(--cs-space-2); align-items: center;
        }
        .cs-preview-def {
          margin: 0; font-size: var(--cs-text-sm); line-height: var(--cs-leading-snug);
        }
        .cs-preview-list {
          margin: 0; padding-left: var(--cs-space-5); display: grid; gap: var(--cs-space-3);
          font-size: var(--cs-text-sm); line-height: var(--cs-leading-snug);
        }
        .cs-preview-members {
          margin: 0; padding: 0; list-style: none; display: grid; gap: var(--cs-space-2);
        }
        .cs-preview-members li {
          display: flex; align-items: baseline; gap: var(--cs-space-2);
          font-size: var(--cs-text-sm); line-height: var(--cs-leading-snug);
        }
        @media (max-width: 48rem) {
          .cs-preview-dialog {
            width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh;
            inset: 0; border-radius: 0;
          }
        }
      `}</style>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- native <dialog>, not a div: Escape already closes it (onClose below); onClick only detects a backdrop click (target === the dialog itself, never a panel child) */}
      <dialog
        ref={ref}
        className="cs-preview-dialog"
        aria-labelledby="cs-preview-title"
        onClose={onClose}
        onClick={(e) => {
          if (e.target === ref.current) onClose();
        }}
        onTransitionEnd={(e) => {
          // Exit settled while closed → release the held content (never mid-reopen: `open` is
          // true again by then, so the guard holds and the fresh vm stays mounted).
          if (e.target === ref.current && !ref.current?.open) {
            setHeldVm(undefined);
          }
        }}
      >
        {vm ? (
          <div className="cs-preview-shell">
            {/* ===== Header (fixed) ===== */}
            <div className="cs-preview-head">
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-2)",
                    minWidth: 0,
                  }}
                >
                  <Icon name={vm.mark} />
                  <h2
                    id="cs-preview-title"
                    className="cs-card-title"
                    style={{ margin: 0 }}
                  >
                    {vm.entry.label}
                  </h2>
                  <StatusChip label={vm.kindLabel} />
                </div>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={onClose}
                className="cs-preview-close"
              >
                <Icon name="x" />
              </button>
            </div>

            {/* ===== Scroll body — metadata first (blurb + badges), then media, then depth ===== */}
            <div className="cs-preview-body">
              <p className="cs-muted cs-preview-def">{vm.entry.blurb}</p>
              {vm.badges}
              <MediaCarousel
                slides={vm.slides}
                label={`${vm.entry.label} media`}
              />
              {vm.body}
            </div>

            {/* ===== Footer (fixed) — docs + live demo + open full page ===== */}
            <div className="cs-preview-foot">
              <EntryLinks
                label={vm.entry.label}
                docsHref={docsHrefs[vm.entry.viewId]}
                demoHref={vm.entry.demoHref}
              />
              {vm.footer ? (
                <Link
                  href={vm.footer.href}
                  className="cs-muted"
                  style={{ fontSize: "var(--cs-text-sm)" }}
                >
                  {vm.footer.label}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
