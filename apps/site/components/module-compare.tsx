"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import { MODULE_PAGES } from "@/lib/module-pages";
import { type BundleId, formatUsd, MODULE_PRICES } from "@/lib/pricing";

import { bundleLabel } from "./marketplace";

/** Max modules that fit side by side without the panel becoming a spreadsheet. */
export const COMPARE_MAX = 3;

interface CompareColumn {
  id: string;
  label: string;
  amount: number;
  bundles: readonly BundleId[];
  ships: readonly string[];
}

function toColumn(id: string): CompareColumn | null {
  const m = MODULE_PRICES.find((p) => p.id === id);
  if (!m) return null;
  const record = MODULE_PAGES.find((r) => r.slug === id);
  return {
    id: m.id,
    label: m.label,
    amount: m.amount,
    bundles: m.bundles,
    ships: record ? record.included.map((i) => i.title) : [],
  };
}

/**
 * The compare utility: a sticky bottom strip once one module is selected, expanding to a side-by-side
 * panel (price · bundle membership · what-ships · add-to-cart per column). Built from @caisson/ui
 * primitives. This is the lean utility surface — the /compare SEO pages own the pairwise marketing
 * comparisons. Selection state lives in the grid (`module-catalog.tsx`); this renders it.
 */
export function ModuleCompareTray({
  ids,
  onRemove,
  onClear,
}: {
  ids: readonly string[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const columns = ids
    .map(toColumn)
    .filter((c): c is CompareColumn => c !== null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  // Close the panel when the selection empties out.
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
                key={c.id}
                type="button"
                className="cs-chip"
                onClick={() => onRemove(c.id)}
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
      <dialog
        ref={ref}
        className="cs-compare-dialog"
        aria-label="Compare modules"
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
            <span className="cs-card-title">Compare modules</span>
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
              {columns.map((c) => {
                const catalogItem = moduleCatalogItem(c.id);
                return (
                  <div
                    key={c.id}
                    style={{ display: "grid", gap: "var(--cs-space-3)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--cs-space-2)",
                      }}
                    >
                      <Icon name={moduleMark(c.id)} />
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
                      {c.bundles.length === 0 ? (
                        <StatusChip label="Standalone" tone="muted" />
                      ) : (
                        c.bundles.map((b) => (
                          <StatusChip
                            key={b}
                            label={bundleLabel(b)}
                            tone="muted"
                          />
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
                        {c.ships.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        className="cs-muted"
                        style={{ margin: 0, fontSize: "var(--cs-text-sm)" }}
                      >
                        Full spec on the module page.
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
                      {catalogItem ? (
                        <AddToCartButton
                          variant="primary"
                          item={toCartItem(catalogItem)}
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onRemove(c.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
