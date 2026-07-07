"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Faq, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { bundlePageRecord } from "@/lib/bundle-pages";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import {
  bundleModuleSubtotal,
  bundlePriceById,
  everythingSavings,
  formatPrice,
  formatUsd,
  isBundleId,
  moduleCatalogSubtotal,
  modulesByBundle,
} from "@/lib/pricing";

import { bundleLabel, bundlePagePath } from "./marketplace";

export interface BundlePreviewDialogProps {
  /** The previewed bundle's slug, or null when closed. */
  bundleId: string | null;
  onClose: () => void;
}

/**
 * The full bundle purchase card, opened by clicking a hub bundle card (`bundle-catalog.tsx`). Mirrors
 * `ModulePreviewDialog`: native `<dialog>` + `showModal()`, a media placeholder (the bundle's mark),
 * the member modules with their prices, the pricing ladder (bundle price vs. buying the members à la
 * carte), the FAQ, and add-to-cart — all read from `lib/bundle-pages.ts` + `lib/pricing.ts`. The
 * whole-catalog Everything bundle has no per-bundle members, so it shows the catalog savings ladder
 * instead.
 */
export function BundlePreviewDialog({
  bundleId,
  onClose,
}: BundlePreviewDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const valid = bundleId !== null && isBundleId(bundleId);
  const record = valid ? bundlePageRecord(bundleId) : undefined;
  const anchor = valid ? bundlePriceById(bundleId) : undefined;
  const catalogItem = valid ? bundleCatalogItem(bundleId) : undefined;
  const members = valid ? modulesByBundle(bundleId) : [];
  const isEverything = bundleId === "everything";

  // Savings: a persona bundle sits below the sum of its members; Everything sits below the whole
  // à-la-carte catalog. Both are real savings, never a fabricated "was" price (ADR-0130).
  const memberSubtotal = valid ? bundleModuleSubtotal(bundleId) : 0;
  const price = anchor?.amount ?? null;
  const saves = isEverything
    ? everythingSavings()
    : price !== null
      ? Math.max(0, memberSubtotal - price)
      : 0;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (record && !dlg.open) dlg.showModal();
    else if (!record && dlg.open) dlg.close();
  }, [record]);

  return (
    <>
      <style>{`
        .cs-bundle-preview-dialog {
          margin: auto;
          padding: 0;
          width: min(92vw, 60rem);
          max-height: min(90vh, 52rem);
          border: 0;
          border-radius: var(--cs-radius-lg);
          background: var(--cs-surface-1);
          color: var(--cs-fg);
          box-shadow: var(--cs-shadow-lg);
          overflow: hidden;
        }
        .cs-bundle-preview-dialog::backdrop {
          background: var(--cs-scrim);
        }
        @media (max-width: 48rem) {
          .cs-bundle-preview-dialog {
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
        className="cs-bundle-preview-dialog"
        aria-labelledby="bundle-preview-title"
        onClose={onClose}
        onClick={(e) => {
          if (e.target === ref.current) onClose();
        }}
      >
        {record && anchor ? (
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
                  {isBundleId(record.slug) && (
                    <Icon name={BUNDLE_MARKS[record.slug]} />
                  )}
                  <h2
                    id="bundle-preview-title"
                    className="cs-card-title"
                    style={{ margin: 0 }}
                  >
                    {anchor.label}
                  </h2>
                  <StatusChip label="Bundle" />
                </div>
                <div
                  className="cs-num"
                  style={{
                    marginTop: "var(--cs-space-2)",
                    fontFamily: "var(--cs-font-mono)",
                    fontSize: "var(--cs-text-lg)",
                  }}
                >
                  {formatPrice(anchor)}
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
              {/* Media placeholder — the bundle's mark. */}
              {isBundleId(record.slug) && (
                <MediaPlaceholder icon={BUNDLE_MARKS[record.slug]} />
              )}

              {/* Definition */}
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--cs-text-sm)",
                  lineHeight: "var(--cs-leading-snug)",
                }}
              >
                {record.definition}
              </p>

              {/* Pricing ladder — bundle price vs à-la-carte member sum. */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: "var(--cs-space-3)",
                }}
              >
                <span
                  className="cs-num"
                  style={{
                    fontSize: "var(--cs-text-2xl)",
                    fontFamily: "var(--cs-font-mono)",
                    letterSpacing: "var(--cs-tracking-tight)",
                  }}
                >
                  {formatPrice(anchor)}
                </span>
                <span className="cs-tag">One-time · own the source</span>
                {saves > 0 && (
                  <StatusChip
                    tone="accent"
                    label={`Save ${formatUsd(saves)} vs à la carte`}
                    dot
                  />
                )}
              </div>

              {/* Member modules with prices — or, for Everything, the whole-catalog summary. */}
              {isEverything ? (
                <p
                  className="cs-muted"
                  style={{
                    margin: 0,
                    fontSize: "var(--cs-text-sm)",
                    lineHeight: "var(--cs-leading-snug)",
                  }}
                >
                  Every à-la-carte module totals{" "}
                  {formatUsd(moduleCatalogSubtotal())}. The Everything bundle is
                  the whole commercial catalog — every bundle and every module —
                  for {formatPrice(anchor)}. One purchase, the whole library.
                </p>
              ) : members.length > 0 ? (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "grid",
                    gap: "var(--cs-space-2)",
                  }}
                >
                  {members.map((m) => (
                    <li
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "var(--cs-space-2)",
                        fontSize: "var(--cs-text-sm)",
                        lineHeight: "var(--cs-leading-snug)",
                      }}
                    >
                      <Icon name={moduleMark(m.id)} />
                      <span style={{ flex: 1 }}>{m.label}</span>
                      <span
                        className="cs-num"
                        style={{
                          fontSize: "var(--cs-text-xs)",
                          color: "var(--cs-fg-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatUsd(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Collapsed FAQ accordion (native <details>, closed by default). */}
              {record.faq.length > 0 ? <Faq items={record.faq} /> : null}
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
              {catalogItem ? (
                <AddToCartButton
                  variant="primary"
                  item={toCartItem(catalogItem)}
                  onAdded={onClose}
                />
              ) : null}
              {isBundleId(record.slug) && (
                <Link
                  href={bundlePagePath(record.slug)}
                  className="cs-muted"
                  style={{ fontSize: "var(--cs-text-sm)" }}
                >
                  {isEverything
                    ? "See it on the marketplace →"
                    : `Open the ${bundleLabel(record.slug)} page →`}
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
