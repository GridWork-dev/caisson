"use client";

import { Icon } from "@caisson/ui/components";

import { Button, Card } from "@/components";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";

/** Slide-out cart summary, mounted once in the marketing layout and toggled by `CartTrigger`.
 *  Full review + checkout happens on `/cart` (and the authed `/dashboard/cart`) — this drawer is
 *  a fast glance + remove, not the whole flow. */
export function CartDrawer() {
  const { items, subtotal, drawerOpen, removeItem, closeDrawer } = useCart();

  if (!drawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cart"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeDrawer}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--cs-scrim)",
          border: "none",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "min(24rem, 100vw)",
          height: "100%",
          background: "var(--cs-surface-1)",
          borderLeft: "1px solid var(--cs-border)",
          padding: "var(--cs-space-6)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--cs-space-4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="cs-card-title">Cart</span>
          <button
            type="button"
            aria-label="Close cart"
            onClick={closeDrawer}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--cs-fg-muted)",
            }}
          >
            <Icon name="x" />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="cs-muted">
            Your cart is empty. Add an edition or a module to get started.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--cs-space-3)",
              }}
            >
              {items.map((item) => (
                <Card key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    <span style={{ fontSize: "var(--cs-text-sm)" }}>
                      {item.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span
                        className="cs-num"
                        style={{
                          fontFamily: "var(--cs-font-mono)",
                          fontSize: "var(--cs-text-sm)",
                        }}
                      >
                        {formatUsd(item.amount)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${item.label} from cart`}
                        onClick={() => removeItem(item.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--cs-fg-muted)",
                        }}
                      >
                        <Icon name="x" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: "1px solid var(--cs-border)",
                paddingTop: "var(--cs-space-4)",
              }}
            >
              <span
                className="cs-muted"
                style={{ fontSize: "var(--cs-text-sm)" }}
              >
                Subtotal
              </span>
              <span
                className="cs-num"
                style={{
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-lg)",
                }}
              >
                {formatUsd(subtotal)}
              </span>
            </div>

            <Button href="/cart" variant="primary" onClick={closeDrawer}>
              Review cart
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
