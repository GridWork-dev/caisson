import { Button, Card, Faq, Icon, Reveal, Section } from "@/components";
import {
  PartnersApplyButton,
  PartnersApplyLink,
} from "@/components/partners-apply";
import { breadcrumb, faqPage, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Design partners",
  description:
    "The first five Caisson design partners get 40% off their initial purchase in exchange for a citable case study (only if Caisson earns it) and a direct feedback loop. Apply by email — a reference partnership, not a waitlist.",
  path: "/partners",
});

// The quiet application surface (ADR-0273). The terms are LOCKED and
// published (ADR-0297, stated on-page per the 2026-07-10 Kickoff-J picker): 5 partners · 40% off
// the initial purchase · partner pricing reverts to list after 12 months on renewal/subscription
// surfaces · case-study rights contingent on conversion. The cohort cap is a real term, not
// manufactured scarcity — still no countdown, no roadmap framing (ADR-0237).
const WHAT_YOU_GET = [
  {
    icon: "wallet" as const,
    label: "40% off your initial purchase",
    body: "Any bundle or module set, 40% off list at purchase time. You own the source perpetually, the same way every buyer does — 12 months of updates and security patches included as standard.",
  },
  {
    icon: "users" as const,
    label: "A direct line to the engineer",
    body: "Caisson is built by a named engineer, not a ticket queue. As a design partner your integration questions and feature needs reach the person who writes the code.",
  },
  {
    icon: "git-branch" as const,
    label: "A real say in priorities",
    body: "Your integration is a live deployment the engineer works against directly — a real use case with real attention, not a hypothetical in a backlog. Partner pricing also holds on any renewal or subscription surface for your first 12 months, then reverts to list.",
  },
] as const;

const WHAT_WE_ASK = [
  {
    icon: "file-check" as const,
    label: "A case study — only if Caisson earns it",
    body: "If you continue at standard terms after your first year, you grant a short, reviewed case study with your logo. Nothing is published without your sign-off; claims are scraped and dated, never invented. If you walk away instead, you owe nothing.",
  },
  {
    icon: "check" as const,
    label: "A feedback loop",
    body: "A regular, candid conversation about what works, what's missing, and what broke. That signal is the whole point of a first cohort.",
  },
] as const;

const FAQ = [
  {
    question: "What is the Caisson design-partner program?",
    answer:
      "The first five reference customers get 40% off their initial purchase in exchange for a citable case study — owed only if Caisson earns your continued business — and a direct feedback loop with the engineer who builds it. A reference partnership, not a waitlist and not a discount code.",
  },
  {
    question: "How many partners are you taking, and what are the terms?",
    answer:
      "Five, first come. 40% off your initial purchase (any bundle or module set); partner pricing holds on renewal or subscription surfaces for 12 months from purchase, then reverts to list. We keep the cohort small on purpose so each partner gets real engineering attention. Apply by email and we'll tell you how many slots remain.",
  },
  {
    question: "What do I have to commit to?",
    answer:
      "Two things. First, a case study with your logo — owed only if you continue at standard terms after your first year; if Caisson doesn't earn that, you owe nothing. It's published only after you approve the exact wording. Second, a candid feedback conversation, roughly monthly or async as agreed. You build on Caisson the way any buyer would; the partnership is the reference and the feedback, not extra integration work.",
  },
  {
    question: "Is my case study published without my approval?",
    answer:
      "No. Nothing about your company is published until you approve the exact wording. Every claim is dated and accurate — that's the copy standard for the whole site, and it applies here too.",
  },
  {
    question: "How do I apply?",
    answer:
      "Email support@caisson.sh with what you're building, the stack you're on, and the bundle or modules you'd use. We review every application and follow up directly.",
  },
] as const;

export default function PartnersPage() {
  const ldBreadcrumb = breadcrumb([
    { name: "Caisson", path: "/" },
    { name: "Design partners", path: "/partners" },
  ]);
  const ldFaq = faqPage([...FAQ]);

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
        eyebrow="Design partners"
        title="Build on Caisson. Be one of the first five references."
        lede="Five design partners, 40% off the initial purchase, in exchange for a citable case study — owed only if Caisson earns your continued business — and a direct feedback loop with the engineer who builds it. A reference partnership — not a waitlist."
      />

      {/* ===== What you get ===== */}
      <Section
        band="tint"
        eyebrow="What you get"
        title="The partner side of the deal."
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
          {WHAT_YOU_GET.map((item, i) => (
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

      {/* ===== What we ask ===== */}
      <Section eyebrow="What we ask" title="The reference side of the deal.">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "var(--cs-space-4)",
            marginTop: "var(--cs-space-8)",
          }}
        >
          {WHAT_WE_ASK.map((item, i) => (
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

      {/* ===== How to apply ===== */}
      <Section band="tint" eyebrow="How to apply" title="Apply by email.">
        <p className="cs-lede">
          Email <PartnersApplyLink>support@caisson.sh</PartnersApplyLink> with
          what you&rsquo;re building, the stack you&rsquo;re on, and the bundle
          or modules you&rsquo;d use. We review every application and follow up
          directly.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          Not ready to commit to a reference? Prove the fit first &mdash;
          scaffold the base and run it on your own stack, no conversation
          required.
        </p>
        <div
          style={{
            marginTop: "var(--cs-space-6)",
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          <PartnersApplyButton>Apply by email</PartnersApplyButton>
          <Button href="/docs/getting-started" variant="ghost">
            Try it on your stack
          </Button>
        </div>
      </Section>

      {/* ===== FAQ ===== */}
      <Section eyebrow="Design-partner FAQ" title="Common questions.">
        <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
      </Section>
    </>
  );
}
