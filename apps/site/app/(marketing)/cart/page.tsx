import type { Metadata } from "next";

import { Section } from "@/components";
import { CartView } from "@/components/cart-view";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cart",
  description:
    "Review the bundles and modules in your cart, then pay for the whole cart in one checkout.",
  path: "/cart",
});

export default function CartPage() {
  return (
    <Section
      eyebrow="Cart"
      title="Review your cart."
      lede="Add bundles and modules from the marketplace, then pay for the whole cart in one checkout instead of a separate purchase per line."
    >
      <div style={{ marginTop: "var(--cs-space-8)" }}>
        <CartView />
      </div>
    </Section>
  );
}
