import type { Metadata } from "next";

import { Section } from "@/components";
import { CartView } from "@/components/cart-view";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cart",
  description:
    "Review the editions and modules in your cart, then pay for the whole cart in one checkout.",
  path: "/cart",
});

export default function CartPage() {
  return (
    <Section
      eyebrow="Cart"
      title="Review your cart."
      lede="Add editions and modules from pricing, then pay for the whole cart in one Paddle checkout — not one overlay per line."
    >
      <div style={{ marginTop: "var(--cs-space-8)" }}>
        <CartView />
      </div>
    </Section>
  );
}
