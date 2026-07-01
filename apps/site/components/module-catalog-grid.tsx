import { Card, Icon } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import {
  EDITION_PRICES,
  formatUsd,
  modulesByEdition,
  type EditionId,
} from "@/lib/pricing";

// The à-la-carte module grid — every one of the 14 modules as a buyable card, grouped under the
// edition it composes into (customer-facing grouping, mirrors the SKU matrix). Server component:
// the only client leaf is each card's `AddToCartButton`. Reads the display price from
// `MODULE_PRICES` and the Paddle price id from the cart catalog (`catalogItemById`) — the two are
// kept in sync by `lib/catalog.ts`, so a module missing a catalog row is a hard error here rather
// than a silently unbuyable card.

/** Domain glyph per edition — reuses the same icons the home/pricing edition cards use. */
const EDITION_ICON: Record<
  EditionId,
  "fail-closed" | "gauge" | "cpu" | "git-branch"
> = {
  compliance: "fail-closed",
  "ai-kit": "gauge",
  "local-first": "cpu",
  "agentic-dev": "git-branch",
};

/** Display order — matches the edition cards + the SKU matrix columns. */
const EDITION_ORDER: readonly EditionId[] = [
  "compliance",
  "ai-kit",
  "local-first",
  "agentic-dev",
];

export function ModuleCatalogGrid() {
  return (
    <div style={{ display: "grid", gap: "var(--cs-space-10)" }}>
      {EDITION_ORDER.map((editionId) => {
        const edition = EDITION_PRICES.find((p) => p.id === editionId);
        const modules = modulesByEdition(editionId);
        if (modules.length === 0) return null;
        return (
          <div key={editionId}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cs-space-3)",
                marginBottom: "var(--cs-space-5)",
              }}
            >
              <Icon name={EDITION_ICON[editionId]} size="md" />
              <span
                className="cs-card-title"
                style={{ fontSize: "var(--cs-text-lg)" }}
              >
                {edition?.label ?? editionId} modules
              </span>
            </div>
            <div className="cs-grid cs-grid--3">
              {modules.map((mod) => {
                const catalogItem = moduleCatalogItem(mod.id);
                if (catalogItem === undefined) {
                  throw new Error(
                    `module-catalog-grid: no catalog entry for module "${mod.id}"`,
                  );
                }
                return (
                  <Card key={mod.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span className="cs-card-title">{mod.label}</span>
                      <span
                        className="cs-num"
                        style={{
                          fontFamily: "var(--cs-font-mono)",
                          fontSize: "var(--cs-text-base)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatUsd(mod.amount)}
                      </span>
                    </div>
                    <p
                      className="cs-muted"
                      style={{
                        marginTop: "var(--cs-space-3)",
                        fontSize: "var(--cs-text-sm)",
                        lineHeight: "var(--cs-leading-snug)",
                      }}
                    >
                      {mod.blurb}
                    </p>
                    <div style={{ marginTop: "var(--cs-space-5)" }}>
                      <AddToCartButton item={toCartItem(catalogItem)} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
