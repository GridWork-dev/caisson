import { Button, Card, Faq, Icon, Reveal, Section } from "@/components";
import { breadcrumb, faqPage, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Design partners",
  description:
    "A limited first-cohort design-partner program: discounted access to Caisson in exchange for a citable case study and a direct feedback loop. Apply by email — a reference partnership, not a waitlist.",
  path: "/partners",
});

// A quiet application surface (ADR-0273), mirroring /affiliates. Deliberately NO numbers — cohort
// size and discount level stay operator-owned at flip time (write "limited", never "5 slots"). No
// countdown, no roadmap framing (ADR-0237). Apply by email, the /affiliates pattern.
const WHAT_YOU_GET = [
  {
    icon: "wallet" as const,
    label: "Discounted access",
    body: "A materially discounted license to the bundle or modules you'll build on — the specific terms agreed with you directly. You own the source the same way every buyer does.",
  },
  {
    icon: "users" as const,
    label: "A direct line to the engineer",
    body: "Caisson is built by a named engineer, not a ticket queue. As a design partner your integration questions and feature needs reach the person who writes the code.",
  },
  {
    icon: "git-branch" as const,
    label: "A real say in priorities",
    body: "Your integration is a live deployment the engineer works against directly — a real use case with real attention, not a hypothetical in a backlog.",
  },
] as const;

const WHAT_WE_ASK = [
  {
    icon: "file-check" as const,
    label: "A citable case study",
    body: "A short, reviewed write-up — with your logo — that a future buyer's security team can read. Nothing is published without your sign-off; claims are scraped and dated, never invented.",
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
      "A limited first cohort of reference customers who get discounted access to Caisson in exchange for a citable case study and a direct feedback loop. It's a reference partnership, not a waitlist and not a discount code — we agree the terms with each partner directly.",
  },
  {
    question: "How many partners are you taking?",
    answer:
      "A limited first cohort. We keep it small on purpose so each partner gets real engineering attention. Apply by email and we'll tell you where things stand.",
  },
  {
    question: "What do I have to commit to?",
    answer:
      "Two things: a short case study with your logo that we publish only after you sign off, and a regular feedback conversation. You build on Caisson the way any buyer would; the partnership is the reference and the feedback, not extra integration work.",
  },
  {
    question: "Is my case study published without my approval?",
    answer:
      "No. Nothing about your company is published until you approve the exact wording. Every claim is dated and accurate — that's the copy standard for the whole site, and it applies here too.",
  },
  {
    question: "How do I apply?",
    answer:
      "Email admin@caisson.sh with what you're building, the stack you're on, and the bundle or modules you'd use. We review every application and follow up directly.",
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
        title="Build on Caisson. Be one of the first references."
        lede="A limited first cohort of reference partners: discounted access to Caisson in exchange for a citable case study and a direct feedback loop with the engineer who builds it. A reference partnership — not a waitlist."
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
          Email{" "}
          <a
            href="mailto:admin@caisson.sh?subject=Caisson%20design-partner%20application"
            className="cs-link"
          >
            admin@caisson.sh
          </a>{" "}
          with what you&rsquo;re building, the stack you&rsquo;re on, and the
          bundle or modules you&rsquo;d use. We review every application and
          follow up directly.
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
          <Button
            href="mailto:admin@caisson.sh?subject=Caisson%20design-partner%20application"
            external
            variant="primary"
          >
            Apply by email
          </Button>
          <Button href="/stack-fit" variant="ghost">
            Check the stack fit
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
