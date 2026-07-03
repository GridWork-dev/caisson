import Link from "next/link";

import {
  Button,
  Card,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import { CheckoutCta } from "@/components/checkout-cta";
import { UpdatesForm } from "@/components/waitlist-form";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { formatPrice, PLAN_PRICES } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace — Plans",
  description:
    "Caisson subscription plans: Compliance Updates keeps framework mappings and evidence packs current; Developer delivers monthly credits and module updates. The codebase is yours either way.",
  path: "/marketplace/plans",
});

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
      "Compliance support SLA",
    ],
  },
  {
    id: "developer",
    audience: "For the team building on the base every week.",
    includes: [
      "Monthly codegen + AI-feature credit allotment",
      "Framework and module updates as they ship",
      "Private-registry pulls, entitlement-scoped",
      "New-edition access on release",
      "Priority developer support",
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />

      {/* ===== Subscription plans ===== */}
      <Section
        id="subscriptions"
        eyebrow="Subscriptions"
        title="Own it once, or subscribe to keep it current."
        lede="Regulations don&rsquo;t hold still. The codebase is yours either way — subscriptions deliver the parts that move: framework maps, evidence-pack refreshes, and developer credits."
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
          eyebrow="Licensing"
          title="What's open, what you're paying for."
          lede={
            <>
              The base substrate — kernel, auth, tenancy-rls, ui, billing,
              credits, jobs, email, ai-config, mcp-server, registry-schema,
              observability, and the generator tooling (cli, migrate,
              license-verify) — is <code className="mono">Apache-2.0</code>,
              free to use. What you buy above is the four editions, the
              compliance primitives (field-crypto, audit-worm), the registry
              service, and Compliance Updates — under the{" "}
              <Link href="/legal/license" className="mono">
                Commercial License
              </Link>
              .
            </>
          }
        />
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section
          id="get-started"
          eyebrow="Get started"
          title="Start building on the audited substrate."
          lede="The base is built and tested. Pick a module or an edition, scaffold a project, and own the source from day one."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <Terminal
              label="npx create-caisson@latest"
              status={<StatusChip label="ready" tone="success" dot />}
            >
              {
                "$ npx create-caisson@latest\n✓ Caisson base substrate initialized\n✓ Fail-closed RLS (FORCE) + cross-tenant isolation tests\n✓ Append-only audit chain — SHA-256 verified\n✓ Field encryption — per-tenant DEK (HKDF-SHA256)\n✓ Standards gate — lint · test · golden-file"
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
            <Button href="/marketplace#editions" variant="primary">
              See the editions
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
