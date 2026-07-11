import { Button, Section, Card, Faq, Icon, Reveal } from "@/components";
import { buildMetadata } from "@/lib/metadata";
import { serializeJsonLd, breadcrumb, faqPage } from "@/lib/jsonld";
import { BUNDLE_PRICES, formatUsd } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Affiliate program",
  description:
    "Refer Caisson and earn 30% of every sale, with a personal code that gives your buyers 10% off. Apply by email, get paid directly once a sale clears its refund window, with plain refund-clawback terms.",
  path: "/affiliates",
});

// Commission economics derived from the committed bundle prices (lib/pricing.ts is the display
// SOT) so the figures on this page can never drift from the real catalog — no hand-typed dollar
// amounts (ADR-0080: no invented numbers).
const BUNDLE_AMOUNTS = BUNDLE_PRICES.map((b) => b.amount).filter(
  (a): a is number => a !== null,
);
const MIN_BUNDLE = Math.min(...BUNDLE_AMOUNTS);
const MAX_BUNDLE = Math.max(...BUNDLE_AMOUNTS);
// Commission basis is what the buyer actually pays: list minus the code's 10%
// discount, then 30% of that — 27% of list. Quoting 30%-of-list would overstate
// every figure on this page by ~11%.
const BASE_LOW = Math.round((MIN_BUNDLE * 27) / 100);
const BASE_HIGH = Math.round((MAX_BUNDLE * 27) / 100);

const HOW_IT_WORKS = [
  {
    icon: "users" as const,
    label: "Share your code",
    body: "You get a personal discount code worth 10% off at checkout. A buyer who redeems it — from your review, tutorial, or recommendation — is attributed to you on the sale itself. No cookies, no tracking pixels.",
  },
  {
    icon: "wallet" as const,
    label: "Earn 30% of every sale",
    body: `You earn 30% of every sale your code lands. Across the ${formatUsd(
      MIN_BUNDLE,
    )}–${formatUsd(MAX_BUNDLE)} bundle catalog, that is about ${formatUsd(
      BASE_LOW,
    )} to ${formatUsd(BASE_HIGH)} per referred bundle.`,
  },
  {
    icon: "check" as const,
    label: "Get paid directly",
    body: "Referred sales are processed by Paddle, our merchant of record. Caisson pays your commission to you directly once a referred sale clears its 14-day refund window.",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "How do I join the Caisson affiliate program?",
    answer:
      "Apply by email. Send support@caisson.sh your name, the audience or channel you'll refer through, and how you plan to promote Caisson. We review every application and set you up directly.",
  },
  {
    question: "How much do affiliates earn?",
    answer: `30% of every sale you refer. Caisson's bundles run ${formatUsd(
      MIN_BUNDLE,
    )} to ${formatUsd(
      MAX_BUNDLE,
    )}, so a referred bundle pays roughly ${formatUsd(BASE_LOW)} to ${formatUsd(
      BASE_HIGH,
    )}. Modules pay the same rate on their own list price.`,
  },
  {
    question: "What does my code give buyers?",
    answer:
      "10% off at checkout, on bundles and modules alike. Every referral lands with a built-in reason to buy through you, and the redeemed code is what attributes the sale — no cookies, no tracking pixels.",
  },
  {
    question: "How are commissions paid?",
    answer:
      "Directly by Caisson. Paddle, our merchant of record, bills and collects the referred sale; once it clears its 14-day refund window, we pay your commission to you on the payout details agreed when you're set up.",
  },
  {
    question: "What happens if a referred sale is refunded?",
    answer:
      "The commission is reversed. Every Caisson purchase carries a 14-day money-back guarantee; if a buyer you referred takes a refund, the commission for that sale is clawed back. You keep commissions on every sale that sticks.",
  },
];

export default function AffiliatesPage() {
  const ldBreadcrumb = breadcrumb([
    { name: "Caisson", path: "/" },
    { name: "Affiliate program", path: "/affiliates" },
  ]);
  const ldFaq = faqPage(FAQ_ITEMS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldFaq) }}
      />

      {/* ===== Header ===== */}
      <Section
        flush
        as="h1"
        eyebrow="Affiliate program"
        title="Refer Caisson. Earn 30% of every sale."
        lede={`Point regulated and production-minded teams at Caisson with a personal code that gives them 10% off — and earn 30% of every sale it lands. On the ${formatUsd(
          MIN_BUNDLE,
        )}–${formatUsd(MAX_BUNDLE)} bundle catalog that is roughly ${formatUsd(
          BASE_LOW,
        )} to ${formatUsd(BASE_HIGH)} per referral.`}
      />

      {/* ===== How it works ===== */}
      <Section
        band="tint"
        eyebrow="How it works"
        title="Three steps, no forms."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: "var(--cs-space-4)",
            marginTop: "var(--cs-space-8)",
          }}
        >
          {HOW_IT_WORKS.map((item, i) => (
            <Reveal key={item.label} delay={i * 50} as="article">
              <Card>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={item.icon} size="lg" />
                  <span
                    style={{
                      fontWeight: "var(--cs-weight-medium)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                <p className="cs-muted">{item.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ===== Commission ===== */}
      <Section eyebrow="Commission" title="What you earn.">
        <p className="cs-lede">
          You earn <strong>30% of every sale</strong> you refer. Commission is
          paid on the amount the buyer actually pays — bundle or module,
          one-time or subscription.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          Caisson bundles run {formatUsd(MIN_BUNDLE)} to {formatUsd(MAX_BUNDLE)}
          . Commission is 30% of the discounted amount the buyer actually pays
          with your code&rsquo;s 10% off — a single referred bundle pays you
          about {formatUsd(BASE_LOW)} to {formatUsd(BASE_HIGH)}. À-la-carte
          modules pay the same rate on their own list price.
        </p>
      </Section>

      {/* ===== How to join ===== */}
      <Section band="tint" eyebrow="How to join" title="Apply by email.">
        <p className="cs-lede">
          Email{" "}
          <a
            href="mailto:support@caisson.sh?subject=Caisson%20affiliate%20application"
            className="cs-link"
          >
            support@caisson.sh
          </a>{" "}
          with your name, the audience or channel you&rsquo;ll refer through,
          and how you plan to promote Caisson. We review every application and
          set you up directly.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          Referred orders are billed and collected by Paddle, our merchant of
          record; Caisson pays your commission to you directly once the sale
          clears its refund window.
        </p>
        <div style={{ marginTop: "var(--cs-space-6)" }}>
          <Button
            href="mailto:support@caisson.sh?subject=Caisson%20affiliate%20application"
            external
            variant="primary"
          >
            Apply by email
          </Button>
        </div>
      </Section>

      {/* ===== Refund clawback ===== */}
      <Section eyebrow="Refunds" title="Commissions follow the sale.">
        <Card accent>
          <p
            style={{
              fontSize: "var(--cs-text-lg)",
              fontWeight: "var(--cs-weight-medium)",
              lineHeight: "var(--cs-leading-snug)",
              marginBottom: "var(--cs-space-4)",
            }}
          >
            If a referred purchase is refunded, its commission is reversed.
          </p>
          <p className="cs-muted">
            Every Caisson purchase carries a 14-day money-back guarantee. If a
            buyer you referred takes a refund, the commission for that sale is
            clawed back. You keep commissions on every sale that sticks — the
            terms are the same for every partner.
          </p>
        </Card>
      </Section>

      {/* ===== FAQ ===== */}
      <Section band="tint" eyebrow="Affiliate FAQ" title="Common questions.">
        <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-8)" }} />
      </Section>

      {/* ===== CTA ===== */}
      <Section band="surface" eyebrow="Get started">
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-5)" }}>
          Ready to refer Caisson? Email{" "}
          <a href="mailto:support@caisson.sh" className="cs-link">
            support@caisson.sh
          </a>{" "}
          to apply, or browse the catalog to see what you&rsquo;d be referring.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          <Button
            href="mailto:support@caisson.sh?subject=Caisson%20affiliate%20application"
            external
            variant="primary"
          >
            Apply by email
          </Button>
          <Button href="/marketplace" variant="ghost">
            See the catalog
          </Button>
        </div>
      </Section>
    </>
  );
}
