"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { CodeBlock, Faq, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { MediaVideo } from "@/components/media-video";
import { TrialPath } from "@/components/trial-path";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import { MODULE_PAGES } from "@/lib/module-pages";
import { formatUsd, MODULE_PRICES } from "@/lib/pricing";

import { bundleLabel, bundlePagePath } from "./marketplace";

// The ui-pro module's media slot renders LIVE @caisson/ui-pro components rather than a placeholder.
// Loaded client-side only (ssr: false) so the commercial-tier tree never bloats the shared bundle,
// and only for that one module (the import is lazy — nothing loads until it renders).
const UiProDemo = dynamic(() => import("./ui-pro-demo"), {
  ssr: false,
  loading: () => <MediaPlaceholder icon="boxes" />,
});

// Universal stack-compat badges — true of every sellable module (TypeScript source, a perpetual
// one-time license, composed on the shared base). There is no per-module compat field in the
// records, so these are the honest shared facts rather than a fabricated per-module claim.
const STACK_COMPAT: readonly string[] = [
  "TypeScript",
  "One-time license",
  "Composes on the base",
];

export interface ModulePreviewDialogProps {
  /** The previewed module's slug, or null when closed. Resolved here (price row, depth-page
   *  record, cart item) rather than passed as objects, so the catalog only threads one id through
   *  its click handlers. */
  moduleId: string | null;
  /** Whether `moduleId` has a depth page (`lib/module-pages.ts`) — gates the "Open full page" link. */
  hasDetail: boolean;
  onClose: () => void;
}

/**
 * The full module purchase card, opened by clicking a catalog card (`module-catalog.tsx`). Native
 * `<dialog>` + `showModal()` — the `cart-drawer.tsx` precedent — for the focus trap, Escape-to-close,
 * and focus-return a hand-rolled `role="dialog"` div lacks. Everything below the price degrades
 * gracefully: 11 of 22 module slugs have no depth-page record, so the definition, what-ships list,
 * code artifact, and FAQ only render when the record exists — a record-less module still shows its
 * media, price, blurb, stack/bundle badges, and add-to-cart.
 */
export function ModulePreviewDialog({
  moduleId,
  hasDetail,
  onClose,
}: ModulePreviewDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const m = moduleId ? MODULE_PRICES.find((p) => p.id === moduleId) : undefined;
  const record = moduleId
    ? MODULE_PAGES.find((r) => r.slug === moduleId)
    : undefined;
  const catalogItem = moduleId ? moduleCatalogItem(moduleId) : undefined;
  const isUiPro = m?.id === "ui-pro";

  // Drive the native dialog from `moduleId` state, same idempotent-guarded effect as the cart
  // drawer (the dialog's own `close` event — Escape — calls `onClose`, which nulls `moduleId`
  // upstream, so this is a no-op re-entry, not a loop).
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (m && !dlg.open) dlg.showModal();
    else if (!m && dlg.open) dlg.close();
  }, [m]);

  return (
    <>
      {/* ponytail: the position/::backdrop/breakpoint rules a <dialog> needs can't ride inline
       *  styles (the cart.module.css precedent this mirrors), so they live in one scoped <style>
       *  tag. max-height (not height) so a record-less module renders a short card, not a
       *  fixed-height shell with a void; deep records cap and scroll internally. */}
      <style>{`
        .cs-module-preview-dialog {
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
        }
        .cs-module-preview-dialog::backdrop {
          background: var(--cs-scrim);
        }
        @media (max-width: 48rem) {
          .cs-module-preview-dialog {
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            max-height: 100vh;
            inset: 0;
            border-radius: 0;
          }
        }
      `}</style>
      <dialog
        ref={ref}
        className="cs-module-preview-dialog"
        aria-labelledby="module-preview-title"
        onClose={onClose}
        onClick={(e) => {
          // A click on the dialog element itself (not a descendant) is a backdrop click.
          if (e.target === ref.current) onClose();
        }}
      >
        {m ? (
          <div
            style={{
              maxHeight: "inherit",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* ===== Header (fixed) ===== */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "var(--cs-space-4)",
                padding:
                  "var(--cs-space-5) var(--cs-space-6) var(--cs-space-4)",
                borderBottom: "1px solid var(--cs-border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-2)",
                    minWidth: 0,
                  }}
                >
                  <Icon name={moduleMark(m.id)} />
                  <h2
                    id="module-preview-title"
                    className="cs-card-title"
                    style={{ margin: 0 }}
                  >
                    {m.label}
                  </h2>
                  <StatusChip label="Module" />
                </div>
                <div
                  className="cs-num"
                  style={{
                    marginTop: "var(--cs-space-2)",
                    fontFamily: "var(--cs-font-mono)",
                    fontSize: "var(--cs-text-lg)",
                  }}
                >
                  {formatUsd(m.amount)}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                onClick={onClose}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1.75rem",
                  height: "1.75rem",
                  flex: "none",
                  border: 0,
                  borderRadius: "var(--cs-radius-sm)",
                  background: "none",
                  color: "var(--cs-fg-muted)",
                  cursor: "pointer",
                }}
              >
                <Icon name="x" />
              </button>
            </div>

            {/* ===== Scroll body ===== */}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                padding: "var(--cs-space-5) var(--cs-space-6)",
                display: "grid",
                gap: "var(--cs-space-5)",
              }}
            >
              {/* Media slot — live ui-pro demo, a produced video, or the mark placeholder. */}
              <div>
                {isUiPro ? (
                  <UiProDemo />
                ) : record?.video ? (
                  <MediaVideo
                    src={record.video.src}
                    {...(record.video.poster !== undefined
                      ? { poster: record.video.poster }
                      : {})}
                  />
                ) : (
                  <MediaPlaceholder icon={moduleMark(m.id)} />
                )}
              </div>

              {/* Blurb */}
              <p
                className="cs-muted"
                style={{
                  margin: 0,
                  fontSize: "var(--cs-text-sm)",
                  lineHeight: "var(--cs-leading-snug)",
                }}
              >
                {m.blurb}
              </p>

              {/* Stack-compat + bundle-membership badges */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--cs-space-2)",
                  alignItems: "center",
                }}
              >
                {STACK_COMPAT.map((c) => (
                  <StatusChip key={c} label={c} tone="muted" />
                ))}
                {m.bundles.length === 0 ? (
                  <span
                    className="cs-muted"
                    style={{ fontSize: "var(--cs-text-xs)" }}
                  >
                    Sold standalone — not included in any bundle.
                  </span>
                ) : (
                  m.bundles.map((b) => (
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

              {/* Prove fit in week one (ADR-0272 §3) — shown for every module, record or not. */}
              <TrialPath compact />

              {/* Definition + what-ships (record only) */}
              {record ? (
                <>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--cs-text-sm)",
                      lineHeight: "var(--cs-leading-snug)",
                    }}
                  >
                    {record.definition}
                  </p>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "var(--cs-space-5)",
                      display: "grid",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    {record.included.map((item, i) => (
                      <li
                        key={`${m.id}-${i}`}
                        style={{
                          fontSize: "var(--cs-text-sm)",
                          lineHeight: "var(--cs-leading-snug)",
                        }}
                      >
                        <strong>{item.title}</strong> — {item.body}
                      </li>
                    ))}
                  </ul>

                  {/* Code artifact — real package code, mirrors the depth page's codeArtifact. */}
                  <CodeBlock
                    frame
                    code={record.artifact.code}
                    label={`${record.artifact.label}: ${record.artifact.file}`}
                  />

                  {/* Collapsed FAQ accordion (native <details>, closed by default). */}
                  {record.faq.length > 0 ? <Faq items={record.faq} /> : null}
                </>
              ) : null}
            </div>

            {/* ===== Footer (fixed) — add to cart + open full page ===== */}
            <div
              style={{
                padding:
                  "var(--cs-space-4) var(--cs-space-6) var(--cs-space-5)",
                borderTop: "1px solid var(--cs-border)",
                display: "flex",
                alignItems: "center",
                gap: "var(--cs-space-4)",
                flexWrap: "wrap",
              }}
            >
              {/* moduleCatalogItem resolves for every MODULE_PRICES id (MODULE_CATALOG is a straight
               *  map of it, and moduleRealPriceId throws at build otherwise) — the null arm is
               *  type-narrowing only, never a rendered state. The onAdded → onClose wiring closes
               *  this dialog so the opened cart drawer is never stacked under it. */}
              {catalogItem ? (
                <AddToCartButton
                  variant="primary"
                  item={toCartItem(catalogItem)}
                  onAdded={onClose}
                />
              ) : null}
              {hasDetail ? (
                <Link
                  href={`/marketplace/modules/${m.id}`}
                  className="cs-muted"
                  style={{ fontSize: "var(--cs-text-sm)" }}
                >
                  Open full page →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
