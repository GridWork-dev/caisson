"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { bundleLabel } from "@/components/marketplace";
import {
  bundleCatalogItem,
  moduleCatalogItem,
  toCartItem,
  type CatalogItem,
} from "@/lib/catalog";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import { MODULE_PAGES } from "@/lib/module-pages";
import { entryByViewId } from "@/lib/marketplace-surface";
import {
  formatUsd,
  isBundleId,
  MODULE_PRICES,
  modulesByBundle,
} from "@/lib/pricing";

/** Max cards that fit side by side without the panel becoming a spreadsheet. */
export const COMPARE_MAX = 3;

interface CompareColumn {
  viewId: string;
  id: string;
  kind: "bundle" | "module";
  label: string;
  mark: string;
  amount: number;
  /** Membership / kind line — a module's bundles, or the bundle's own chip. */
  membership: readonly string[];
  standalone: boolean;
  /** "What ships": a module's included titles, or a bundle's member module labels. */
  ships: readonly string[];
  cartItem: CatalogItem | undefined;
}

function toColumn(viewId: string): CompareColumn | null {
  const entry = entryByViewId(viewId);
  if (!entry) return null;
  if (entry.kind === "module") {
    const m = MODULE_PRICES.find((p) => p.id === entry.id);
    if (!m) return null;
    const record = MODULE_PAGES.find((r) => r.slug === entry.id);
    return {
      viewId,
      id: m.id,
      kind: "module",
      label: m.label,
      mark: moduleMark(m.id),
      amount: m.amount,
      membership: m.bundles.map((b) => bundleLabel(b)),
      standalone: m.bundles.length === 0,
      ships: record ? record.included.map((i) => i.title) : [],
      cartItem: moduleCatalogItem(m.id),
    };
  }
  const members = isBundleId(entry.id) ? modulesByBundle(entry.id) : [];
  return {
    viewId,
    id: entry.id,
    kind: "bundle",
    label: entry.label,
    mark: isBundleId(entry.id) ? BUNDLE_MARKS[entry.id] : "bundle",
    amount: entry.amount,
    membership: ["Bundle"],
    standalone: false,
    ships:
      members.length > 0
        ? members.map((m) => m.label)
        : ["The whole catalog — every bundle and module"],
    cartItem: bundleCatalogItem(entry.id),
  };
}

/**
 * The in-catalog compare tray (ADR-0285 §1) — a sticky bottom strip once one card is selected,
 * expanding to a side-by-side panel (price · membership · what-ships · add-to-cart per column).
 * Extended from modules-only to BOTH kinds: a mixed selection of up to three bundles and modules.
 * This is the lean in-catalog compare; the /compare SEO pages own the pairwise COMPETITOR
 * comparisons. Selection state lives in the surface grid; this renders it.
 */
export function CompareTray({
  viewIds,
  onRemove,
  onClear,
}: {
  viewIds: readonly string[];
  onRemove: (viewId: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const columns = viewIds
    .map(toColumn)
    .filter((c): c is CompareColumn => c !== null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    if (columns.length === 0) setOpen(false);
  }, [columns.length]);

  if (columns.length === 0) return null;

  return (
    <>
      <style>{`
        .cs-compare-dialog {
          margin: auto;
          padding: 0;
          width: min(94vw, 60rem);
          max-height: min(88vh, 44rem);
          border: 0;
          border-radius: var(--cs-radius-lg);
          background: var(--cs-surface-1);
          color: var(--cs-fg);
          box-shadow: var(--cs-shadow-lg);
          overflow: hidden;
        }
        .cs-compare-dialog::backdrop { background: var(--cs-scrim); }
      `}</style>

      {/* Sticky bottom strip */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: "var(--cs-space-4)",
          transform: "translateX(-50%)",
          zIndex: 40,
          maxWidth: "min(92vw, 48rem)",
        }}
      >
        <Card
          className="cs-elevate-md"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
            padding: "var(--cs-space-3) var(--cs-space-4)",
          }}
        >
          <span
            className="cs-num"
            style={{ fontSize: "var(--cs-text-sm)", whiteSpace: "nowrap" }}
          >
            Comparing {columns.length}/{COMPARE_MAX}
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--cs-space-2)",
              flex: 1,
            }}
          >
            {columns.map((c) => (
              <button
                key={c.viewId}
                type="button"
                className="cs-chip"
                onClick={() => onRemove(c.viewId)}
                aria-label={`Remove ${c.label} from compare`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--cs-space-1)",
                  cursor: "pointer",
                }}
              >
                {c.label}
                <Icon name="x" />
              </button>
            ))}
          </div>
          <Button type="button" variant="primary" onClick={() => setOpen(true)}>
            Compare
          </Button>
          <Button type="button" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        </Card>
      </div>

      {/* Side-by-side panel */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- native <dialog>, not a div: Escape already closes it (onClose below); onClick only detects a backdrop click (target === the dialog itself, never a panel child) */}
      <dialog
        ref={ref}
        className="cs-compare-dialog"
        aria-label="Compare bundles and modules"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
      >
        <div
          style={{
            maxHeight: "inherit",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--cs-space-4) var(--cs-space-5)",
              borderBottom: "1px solid var(--cs-border)",
            }}
          >
            <span className="cs-card-title">Compare</span>
            <button
              type="button"
              aria-label="Close compare"
              onClick={() => setOpen(false)}
              style={{
                border: 0,
                background: "none",
                color: "var(--cs-fg-muted)",
                cursor: "pointer",
              }}
            >
              <Icon name="x" />
            </button>
          </div>

          <div style={{ overflow: "auto", padding: "var(--cs-space-5)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns.length}, minmax(12rem, 1fr))`,
                gap: "var(--cs-space-4)",
              }}
            >
              {columns.map((c) => (
                <div
                  key={c.viewId}
                  style={{ display: "grid", gap: "var(--cs-space-3)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--cs-space-2)",
                    }}
                  >
                    <Icon name={c.mark} />
                    <span className="cs-card-title">{c.label}</span>
                  </div>
                  <div
                    className="cs-num"
                    style={{
                      fontFamily: "var(--cs-font-mono)",
                      fontSize: "var(--cs-text-lg)",
                    }}
                  >
                    {formatUsd(c.amount)}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--cs-space-1)",
                    }}
                  >
                    {c.standalone ? (
                      <StatusChip label="Standalone" tone="muted" />
                    ) : (
                      c.membership.map((b) => (
                        <StatusChip key={b} label={b} tone="muted" />
                      ))
                    )}
                  </div>
                  {c.ships.length > 0 ? (
                    <ul
                      className="cs-muted"
                      style={{
                        margin: 0,
                        paddingLeft: "var(--cs-space-5)",
                        display: "grid",
                        gap: "var(--cs-space-1)",
                        fontSize: "var(--cs-text-sm)",
                      }}
                    >
                      {c.ships.map((s, i) => (
                        <li key={`${c.viewId}-${i}`}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p
                      className="cs-muted"
                      style={{ margin: 0, fontSize: "var(--cs-text-sm)" }}
                    >
                      Full spec on the {c.kind} page.
                    </p>
                  )}
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--cs-space-2)",
                    }}
                  >
                    {c.cartItem ? (
                      <AddToCartButton
                        variant="primary"
                        item={toCartItem(c.cartItem)}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onRemove(c.viewId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
