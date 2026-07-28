import Link from "next/link";

import {
  Button,
  Card,
  Faq,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import { CheckoutCta } from "@/components/checkout-cta";
import { UpdatesForm } from "@/components/waitlist-form";
import { breadcrumb, faqPage, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { baseSubstrateList, baseToolingList } from "@/lib/base-substrate";
import {
  bundleModuleSubtotal,
  bundlePrice,
  formatPrice,
  formatUsd,
  planPrice,
  PLAN_PRICES,
  RENEWAL_RATE_PERCENT,
  renewalAmount,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace — Plans",
  description: `Compliance Updates (${planPrice("compliance-updates")}) and the Developer plan (${planPrice("developer")}) are subscriptions on top of one-time, perpetual modules and bundles. No renewal gate on code you already own.`,
  path: "/marketplace/plans",
});

// Real buyer questions (ADR-0080 §6) — rendered visibly below and mirrored into FAQPage JSON-LD.
const PLANS_FAQ = [
  {
    question: "Do I need a subscription to use a bundle or module?",
    answer:
      "No. Every module and bundle is a one-time perpetual license that includes 12 months of updates from your purchase date, renewable per entitlement afterward at 40% of the then-current list price per year. Compliance Updates and the Developer plan add active-subscription updates and credits on top; they're not required for the code to run.",
  },
  {
    question: "How many developers can use one license?",
    answer:
      "Everyone at your company. Every module and bundle is licensed per organization — the entitlement belongs to the purchasing entity and can be used by any personnel you authorize to work on your products. There is no per-seat pricing and no seat counting. For contrast: a similarly priced competitor tier caps at 5 developer seats (Supastarter Startup, $799, verified 2026-07-10).",
  },
  {
    question: "What happens to my code if I cancel Compliance Updates?",
    answer:
      "You keep it. Cancelling stops new control-mapping updates and evidence-pack regeneration — it doesn't revoke the audit chain, WORM store, or field-crypto module you already own.",
  },
  {
    question: "Is Compliance Updates the same as the Compliance bundle?",
    answer: `No. The Compliance bundle (${bundlePrice("compliance")}, one-time) is the codebase. Compliance Updates (${planPrice("compliance-updates")}) is the subscription that keeps its framework mappings and evidence packs current as regulations change.`,
  },
  {
    question: "What do Developer plan credits cover?",
    answer:
      "An annual codegen and AI-feature credit allotment, plus package updates and entitlement-scoped pulls from the private registry while the plan is active.",
  },
  {
    question: "What happens after 12 months?",
    answer: `The source you bought is yours forever — a perpetual license does not expire, stop working, or phone home, and license checks verify offline for good. Only new updates lapse after month 12: renew a single entitlement for another 12 months at a flat ${RENEWAL_RATE_PERCENT}% of the then-current list price, or keep security patches and updates flowing with the Developer plan (${planPrice(
      "developer",
    )}). Either way, the code you already own is never touched.`,
  },
  {
    question: "How responsive is support, and is there an SLA?",
    answer:
      "Support is email and Discord with a business-days response, included with every license — a real person reads it. There is no separate paid support-SLA tier to buy today; enterprise procurement can arrange custom terms.",
  },
] as const;

// The Plans tab (ADR-0237 F1): the recurring SKUs — subscriptions + enterprise — plus the
// licensing explainer. One-time purchases live on the Editions/Modules/Build tabs.
type SubMeta = {
  readonly id: string;
  readonly audience: string;
  readonly includes: readonly string[];
};

const SUB_META: readonly SubMeta[] = [
  {
    id: "compliance-updates",
    audience: "For the team that has to pass the audit again next year.",
    includes: [
      "Auto-updating control mappings — SOC 2, HIPAA, EU AI Act",
      "Evidence-pack regeneration on every framework revision",
      "New-framework slots as regulations land",
      "Compliance support — email and Discord, business-days response",
    ],
  },
  {
    id: "developer",
    audience: "For the team building on the base every week.",
    includes: [
      "Annual codegen + AI-feature credit allotment",
      "Package updates while your subscription is active",
      "Private-registry pulls, entitlement-scoped",
      "Developer support — email and Discord, business-days response",
    ],
  },
] as const;

export default function MarketplacePlansPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Plans", path: "/marketplace/plans" },
  ]);
  const enterprise = PLAN_PRICES.find((p) => p.id === "enterprise");
  // A worked renewal example, computed from the SOT (ADR-0260 §5 40%-X9 ladder) — never a literal.
  const complianceRenewal = renewalAmount("compliance");
  // The "why the price looks low" sum-of-parts basis (item 4, ADR-0323) — the Compliance bundle's
  // own member-module à-la-carte total, computed from the catalog, never hand-typed.
  const complianceModuleSubtotal = bundleModuleSubtotal("compliance");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      {/* ===== One-time vs recurring — the framing ===== */}
      <Section
        eyebrow="One-time vs. recurring"
        title="Two different things are for sale here."
        lede={
          <>
            Modules, bundles, and the Everything bundle: pay once, own a
            perpetual license, ship it closed. The price never recurs, and it
            includes 12 months of updates from your purchase date — renewable
            per entitlement after that, at 40% of list per year. The two plans
            on this tab: pay yearly for the things that only make sense as a
            subscription — frameworks that change under you, credits that reset,
            a registry that keeps publishing. Stopping a plan stops new updates
            and credits. It does not revoke code you already have.
          </>
        }
      />

      {/* ===== Why the price — ROI framing + the too-cheap-to-be-true trust signal (ADR-0323
          Cookiy-response, items 1+4). Buyers already convert the price to build-weeks themselves;
          this pre-builds that pitch and answers the "why is this so cheap" objection with real
          catalog math instead of a defensive essay. ===== */}
      <Reveal>
        <Section
          id="why-the-price"
          title="The math behind the number."
          lede="Two questions come up before checkout: how do you justify this internally, and why does the number look low for what it replaces. Here's the honest answer to both."
        >
          <FeatureGrid cols={2}>
            <Card>
              <div className="cs-status">
                <Icon name="gauge" size="lg" />
                The build-time you skip
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Fail-closed RLS, WORM evidence storage, an append-only audit
                chain, and a licensed billing/credits stack are weeks of
                senior-engineer time before your product ships its first
                feature. A bundle replaces that build with one price, paid once.
                Translating it for finance: the number buys the multi-week
                engineering build you&rsquo;d otherwise staff, not a per-seat
                SaaS line item.
              </p>
            </Card>
            <Card>
              <div className="cs-status">
                <Icon name="wallet" size="lg" />
                Why the price looks low
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                {bundlePrice("compliance")} for the Compliance bundle reads too
                cheap to some buyers used to six-figure procurement. It
                isn&rsquo;t a mispricing: it&rsquo;s per organization, not per
                seat &mdash; no headcount to negotiate. It&rsquo;s one time, not
                annual &mdash; no recurring multiplier.{" "}
                {complianceModuleSubtotal > 0 ? (
                  <>
                    It&rsquo;s sum-of-parts math &mdash; the same modules priced
                    à la carte total {formatUsd(complianceModuleSubtotal)}.{" "}
                  </>
                ) : null}
                And the base substrate is Apache-2.0 &mdash; read it before you
                buy, instead of taking the price on faith.
              </p>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== After 12 months — the terms answer the research names as the top objection ===== */}
      <Section
        id="after-twelve-months"
        band="tint"
        title="What happens after 12 months?"
        lede="The honest answer, up front: the source is yours forever, and only new updates are optional after the first year. Nothing you already own expires, breaks, or gets held hostage to a renewal."
      >
        {/* Static header, the three continuity cards cascade in (ADR-0307). */}
        <Reveal stagger={70} className="cs-grid cs-grid--3 cs-feature-grid">
          <Card>
            <div className="cs-status">
              <Icon name="check" size="lg" />
              The source is yours, forever
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              A one-time license is perpetual. The code you bought does not
              expire, stop working, or phone home — license checks verify
              offline, for good. Non-payment can never brick what you already
              own, and neither can Caisson shutting down: the{" "}
              <Link href="/legal/eula#vendor-continuity" className="cs-link">
                continuity terms
              </Link>{" "}
              grant you self-maintenance rights on top of the perpetual license.
            </p>
          </Card>
          <Card>
            <div className="cs-status">
              <Icon name="shield" size="lg" />
              Your patches keep coming
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              The worry is abandonware — a bundle that goes stale after year
              one. The Developer plan ({planPrice("developer")}) is the answer:
              security patches and updates keep flowing while it is active. It
              is continuity insurance, not a gate on code you own.
            </p>
          </Card>
          <Card>
            <div className="cs-status">
              <Icon name="plan-tier" size="lg" />
              Renew one entitlement, or don&rsquo;t
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              After the 12 months of included updates, renew a single
              entitlement for another year at a flat {RENEWAL_RATE_PERCENT}% of
              list —{" "}
              {complianceRenewal !== null ? (
                <>
                  the Compliance bundle ({bundlePrice("compliance")}) renews at{" "}
                  {formatUsd(complianceRenewal)}
                </>
              ) : (
                <>a fraction of the list price</>
              )}
              . Skip it and you keep every version already delivered. Higher
              than a classic 15&ndash;20% maintenance contract because it buys a
              different thing: not a support retainer, but the product itself
              &mdash; every release your entitlement shipped that year.
            </p>
          </Card>
        </Reveal>
      </Section>

      {/* ===== Renewal vs. support — one clear surface for a distinction the R6 renewal card
          doesn't cover (ADR-0323 Cookiy-response, item 2): renewal and support are two different
          things, and neither gates the other. Extends R6 without repeating its worked-renewal
          arithmetic. ===== */}
      <Reveal>
        <Section
          id="renewal-vs-support"
          title="Renewal buys releases. Support is separate, and it's already included."
        >
          <FeatureGrid cols={2}>
            <Card>
              <div className="cs-status">
                <Icon name="plan-tier" size="lg" />
                What renewal buys
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Renewing a single entitlement keeps its updates window open
                &mdash; new releases, security patches, and for Compliance,
                refreshed framework mappings and evidence-pack regeneration. It
                doesn&rsquo;t touch code you already have. Skip a renewal and
                every version already delivered keeps working, forever.
              </p>
            </Card>
            <Card>
              <div className="cs-status">
                <Icon name="users" size="lg" />
                What support is
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Support is a different thing entirely, and it&rsquo;s included
                with every license from day one &mdash; email and Discord, a
                real person, business-days response. It&rsquo;s not gated behind
                a subscription, and it doesn&rsquo;t lapse if you skip a
                renewal.
              </p>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Subscription plans ===== */}
      <Section
        id="subscriptions"
        title="Own the code once. Subscribe only for what moves."
        lede={
          <>
            The plans below don&rsquo;t gate code you already own — they deliver
            the parts that keep changing after you buy it: updated framework
            mappings, regenerated evidence packs, and developer credits.
            <span
              className="cs-footnote"
              style={{ display: "block", marginTop: "var(--cs-space-3)" }}
            >
              Compliance Updates is not the Compliance bundle. The bundle (
              {bundlePrice("compliance")}, one-time) is the code; Compliance
              Updates ({planPrice("compliance-updates")}) is the subscription
              that keeps its framework mappings current.
            </span>
          </>
        }
      >
        <FeatureGrid cols={2}>
          {SUB_META.map((sub, i) => {
            const plan = PLAN_PRICES.find((p) => p.id === sub.id);
            return (
              <Reveal key={sub.id} delay={i * 80}>
                <div id={sub.id}>
                  <Card>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span className="cs-card-title">
                        {plan?.label ?? sub.id}
                      </span>
                      {/* Type chip (ADR-0237 F5) + the committed price. */}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "baseline",
                          gap: "var(--cs-space-3)",
                        }}
                      >
                        <StatusChip label="Plan" />
                        {plan && (
                          <span
                            className="cs-num"
                            style={{
                              fontFamily: "var(--cs-font-mono)",
                              fontSize: "var(--cs-text-xl)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatPrice(plan)}
                          </span>
                        )}
                      </span>
                    </div>

                    <p
                      className="cs-muted"
                      style={{
                        marginTop: "var(--cs-space-3)",
                        fontSize: "var(--cs-text-sm)",
                      }}
                    >
                      {sub.audience}
                    </p>

                    <ul
                      style={{
                        margin: "var(--cs-space-4) 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "grid",
                        gap: "var(--cs-space-2)",
                      }}
                    >
                      {sub.includes.map((item) => (
                        <li
                          key={item}
                          className="cs-muted"
                          style={{
                            display: "flex",
                            gap: "var(--cs-space-2)",
                            fontSize: "var(--cs-text-sm)",
                            lineHeight: "var(--cs-leading-snug)",
                          }}
                        >
                          <Icon name="check" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <div style={{ marginTop: "var(--cs-space-6)" }}>
                      <CheckoutCta
                        edition={sub.id}
                        href={`/dashboard/plan?plan=${sub.id}`}
                        variant="ghost"
                      >
                        Subscribe
                      </CheckoutCta>
                    </div>
                  </Card>
                </div>
              </Reveal>
            );
          })}
        </FeatureGrid>

        {/* Enterprise — custom procurement, no fixed price (ADR-0106: "Contact us"). */}
        {enterprise && (
          <Reveal delay={160}>
            <div id={enterprise.id} style={{ marginTop: "var(--cs-space-6)" }}>
              <Card>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "var(--cs-space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="cs-card-title">{enterprise.label}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    <StatusChip label="Plan" />
                    <span
                      className="cs-num"
                      style={{
                        fontFamily: "var(--cs-font-mono)",
                        fontSize: "var(--cs-text-xl)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatPrice(enterprise)}
                    </span>
                  </span>
                </div>
                <p
                  className="cs-muted"
                  style={{
                    marginTop: "var(--cs-space-3)",
                    fontSize: "var(--cs-text-sm)",
                  }}
                >
                  {enterprise.note}
                </p>
                <div style={{ marginTop: "var(--cs-space-6)" }}>
                  <Button
                    href="mailto:security@caisson.sh"
                    external
                    variant="ghost"
                  >
                    Contact us
                  </Button>
                </div>
              </Card>
            </div>
          </Reveal>
        )}
      </Section>

      {/* ===== Licensing — what's open, what you're paying for ===== */}
      <Reveal>
        <Section
          id="licensing"
          title="What's open, what you're paying for."
          lede={
            <>
              The base substrate — {baseSubstrateList()}, and the generator
              tooling ({baseToolingList()}) — is{" "}
              <code className="mono">Apache-2.0</code>, free to use. What you
              buy above is the six bundles, the commercial modules
              (field-crypto, audit-worm, and the rest of the catalog), the
              registry service, and Compliance Updates — under the{" "}
              <Link href="/legal/license" className="mono">
                Commercial License
              </Link>
              .
            </>
          }
        />
      </Reveal>

      {/* ===== Terms near checkout — redistribution + support clarity (ADR-0272 §5) ===== */}
      <Reveal>
        <Section
          id="terms"
          title="What the license lets you do, and how support works."
        >
          <FeatureGrid cols={2}>
            <Card>
              <div className="cs-status">
                <Icon name="scale" size="lg" />
                Licensing and redistribution
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Your license is for internal use in the products you build and
                sell — unlimited. Your customers use your product; they do not
                receive the Caisson source. You may not redistribute, resell, or
                republish the source as a kit, boilerplate, or competing
                library.
              </p>
              <div style={{ marginTop: "var(--cs-space-5)" }}>
                <Button href="/legal/eula" variant="ghost">
                  Read the EULA
                </Button>
              </div>
            </Card>
            <Card>
              <div className="cs-status">
                <Icon name="check" size="lg" />
                Support and refunds
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Support is email and Discord with a business-days response,
                included with every license — no separate SLA tier to buy today.
                Every purchase carries a 14-day money-back guarantee through
                Paddle, our merchant of record.
              </p>
              <div style={{ marginTop: "var(--cs-space-5)" }}>
                <Link href="/legal/license" className="mono">
                  What&rsquo;s open, what&rsquo;s commercial
                </Link>
              </div>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(faqPage(PLANS_FAQ)),
        }}
      />
      <Reveal>
        <Section title="Subscriptions, briefly.">
          <Faq items={PLANS_FAQ} defaultOpenFirst />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section
          id="get-started"
          title="Start building on the audited substrate."
          lede="The base is built and tested. Pick a module or a bundle, scaffold a project, and own the source from day one."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <Terminal
              label="bunx @caisson-sh/cli@latest"
              status={<StatusChip label="ready" tone="success" dot />}
            >
              {
                "$ bunx @caisson-sh/cli@latest\n✓ Caisson base substrate\n  initialized\n✓ Fail-closed RLS (FORCE)\n  + cross-tenant\n  isolation tests\n✓ Append-only audit chain —\n  SHA-256 verified\n✓ Field encryption —\n  per-tenant DEK\n  (HKDF-SHA256)\n✓ Standards gate —\n  lint · test · golden-file"
              }
            </Terminal>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              flexWrap: "wrap",
              marginTop: "var(--cs-space-6)",
            }}
          >
            <Button href="/marketplace?type=bundles" variant="primary">
              See the bundles
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </div>
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <UpdatesForm source="pricing" />
          </div>
        </Section>
      </Reveal>
    </>
  );
}
