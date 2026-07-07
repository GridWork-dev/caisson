"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Icon } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import { MODULE_PAGES } from "@/lib/module-pages";
import { formatUsd, MODULE_PRICES } from "@/lib/pricing";

import { bundleLabel, bundlePagePath } from "./marketplace";

export interface ModulePreviewDialogProps {
  /** The previewed module's slug, or null when closed. Resolved here (price row, depth-page
   *  record, cart item) rather than passed as objects, so the catalog only threads one id through
   *  its click handlers. */
  moduleId: string | null;
  /** Whether `moduleId` has a depth page (`lib/module-pages.ts`) — gates the "Full details" link. */
  hasDetail: boolean;
  onClose: () => void;
}

/**
 * Large module-preview modal opened by clicking a catalog card (`module-catalog.tsx`). Native
 * `<dialog>` + `showModal()` — the `cart-drawer.tsx` precedent — for the focus trap,
 * Escape-to-close, and focus-return a hand-rolled `role="dialog"` div lacks. Content never assumes
 * a depth-page record exists: 11 of 22 module slugs have none, so `record` degrades to just the
 * price-row facts (name, price, blurb, bundle membership) with no definition/included section.
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
      {/* ponytail: scope for this change is locked to this file + module-catalog.tsx (no new CSS
       *  module). The position/::backdrop/breakpoint rules a <dialog> needs can't ride inline
       *  styles (the cart.module.css precedent this mirrors), so they live in one scoped <style>
       *  tag instead of a third file. Upgrade path: fold into a CSS module alongside
       *  cart.module.css if a second component ever needs this same chrome. max-height (not
       *  height) so the 11 slugs without a depth record render a short card, not a fixed-height
       *  shell with a void; deep records still cap and scroll internally. */}
      <style>{`
        .cs-module-preview-dialog {
          margin: auto;
          padding: 0;
          width: min(92vw, 64rem);
          max-height: min(88vh, 46rem);
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
              padding: "var(--cs-space-6)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "var(--cs-space-4)",
              }}
            >
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

            <p
              className="cs-muted"
              style={{
                marginTop: "var(--cs-space-3)",
                fontSize: "var(--cs-text-sm)",
                lineHeight: "var(--cs-leading-snug)",
              }}
            >
              {m.blurb}
            </p>

            <div
              style={{
                marginTop: "var(--cs-space-4)",
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--cs-space-2)",
              }}
            >
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

            <div
              style={{
                marginTop: "var(--cs-space-5)",
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              {record ? (
                <>
                  <p
                    style={{
                      fontSize: "var(--cs-text-sm)",
                      lineHeight: "var(--cs-leading-snug)",
                    }}
                  >
                    {record.definition}
                  </p>
                  <ul
                    style={{
                      marginTop: "var(--cs-space-4)",
                      paddingLeft: "var(--cs-space-5)",
                      display: "grid",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    {record.included.map((item) => (
                      <li
                        key={item.title}
                        style={{
                          fontSize: "var(--cs-text-sm)",
                          lineHeight: "var(--cs-leading-snug)",
                        }}
                      >
                        <strong>{item.title}</strong> — {item.body}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <div
              style={{
                marginTop: "var(--cs-space-5)",
                paddingTop: "var(--cs-space-4)",
                borderTop: "1px solid var(--cs-border)",
                display: "flex",
                alignItems: "center",
                gap: "var(--cs-space-4)",
                flexWrap: "wrap",
              }}
            >
              {/* moduleCatalogItem resolves for every MODULE_PRICES id (MODULE_CATALOG is a
               *  straight map of it, and moduleRealPriceId throws at build otherwise) — the null
               *  arm is type-narrowing only, never a rendered state. */}
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
                  Full details →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
