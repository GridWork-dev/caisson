// EU AI Act Article 50 explainer (CAISSON-79, Kickoff-J site/copy pass 2026-07-10).
// The deadline is a legal fact and is presented as one — no manufactured urgency (ADR-0080).
// Copy is written to read correctly BOTH before and after 2026-08-02 (post-deadline salvage).
// Honest framing: Caisson supplies the evidence discipline (tamper-evident disclosure records,
// versioned config, dated evidence bundles) — the disclosure UI and the legal determination
// stay with the provider/deployer. Never claim compliance.
//
// The obligations table hand-builds a `cs-matrix` — own the stylesheet dependency explicitly
// (the kit's co-located css ships inside the SkuMatrix module, which this page never imports;
// same lesson as the compare template's "unstyled, zero-gap" audit finding).
import "@caisson/ui/components/sku-matrix.css";

import {
  Button,
  Card,
  Faq,
  Hero,
  Reveal,
  Section,
  StatusChip,
} from "@/components";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  techArticle,
} from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "EU AI Act Article 50: the August 2, 2026 transparency obligations",
  description:
    "EU AI Act Article 50 becomes enforceable August 2, 2026: users must be told they are interacting with AI, and generated content must carry machine-readable marking. What a product team ships, who is covered, and the tamper-evident record that proves you did it.",
  path: "/frameworks/eu-ai-act/article-50",
  type: "article",
});

// Obligations table — factual paraphrase of Regulation (EU) 2024/1689, Chapter IV, Article 50.
const OBLIGATIONS = [
  {
    clause: "Art. 50(1)",
    who: "Providers",
    what: "AI systems intended to interact directly with people must be designed so those people are informed they are interacting with AI — unless that is obvious to a reasonably well-informed person from the context.",
  },
  {
    clause: "Art. 50(2)",
    who: "Providers",
    what: "AI systems generating synthetic audio, image, video, or text must mark their outputs in a machine-readable format, detectable as artificially generated or manipulated.",
  },
  {
    clause: "Art. 50(3)",
    who: "Deployers",
    what: "Deployers of emotion-recognition or biometric-categorisation systems must inform the people exposed to them.",
  },
  {
    clause: "Art. 50(4)",
    who: "Deployers",
    what: "Deployers publishing AI-generated or manipulated content that resembles real people, places, or events (deepfakes) must disclose the artificial origin; AI-generated text published to inform the public on matters of public interest must be disclosed unless it underwent human editorial review.",
  },
] as const;

const FAQ = [
  {
    question: "Does Article 50 apply to my SaaS chatbot or AI agent?",
    answer:
      "If your product's AI interacts directly with people — a chatbot, a support agent, an AI feature that converses — Article 50(1) applies regardless of whether the system is high-risk: the person must be informed they are interacting with AI, unless that is already obvious from context to a reasonably well-informed person. If your product generates synthetic content, Article 50(2)'s machine-readable marking also applies.",
  },
  {
    question: "Was the August 2, 2026 date delayed?",
    answer:
      "No. Independent reporting through 2026-07-07 confirmed the Article 50 application date was not extended by the Digital Omnibus amendment. From August 2, 2026 the transparency obligations are enforceable law across the EU.",
  },
  {
    question: "What are the penalties for non-compliance?",
    answer:
      "Non-compliance with the AI Act's transparency obligations carries administrative fines of up to €15 million or 3% of total worldwide annual turnover, whichever is higher (Article 99(4)). National market-surveillance authorities enforce; the fine ceiling is set by the regulation itself.",
  },
  {
    question: "Does Caisson make my product Article 50 compliant?",
    answer:
      "No — and no codebase can. The disclosure surface is your product's UI, and whether it satisfies Article 50 is a legal determination. What Caisson ships is the evidence discipline behind the obligation: disclosure events recorded to a tamper-evident, hash-chained audit trail, configuration versioned in your repo, and a dated evidence bundle — so when someone asks whether disclosure fired for a given interaction, the answer is a verifiable record, not a recollection.",
  },
] as const;

const articleLd = techArticle({
  headline: "EU AI Act Article 50: the August 2, 2026 transparency obligations",
  description:
    "What EU AI Act Article 50 requires of chatbots, agents, and generated content from August 2, 2026 — and the tamper-evident record-keeping that proves the obligation was met.",
  url: `${SITE_URL}/frameworks/eu-ai-act/article-50`,
});
const breadcrumbLd = breadcrumb([
  { name: "Home", path: "/" },
  { name: "EU AI Act", path: "/frameworks/eu-ai-act" },
  { name: "Article 50", path: "/frameworks/eu-ai-act/article-50" },
]);
const faqLd = faqPage([...FAQ]);

export default function Article50Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      {/* ===== Hero (answer-first) ===== */}
      <Hero
        eyebrow="EU AI Act · Article 50"
        title="Article 50 becomes enforceable August 2, 2026."
        lede={
          <>
            From that date, AI systems that interact with people must disclose
            it, and generated content must carry machine-readable marking —
            regardless of risk class. Here is what Article 50 requires, who it
            covers, and the record that proves you met it.
          </>
        }
        ctas={
          <>
            <Button href="/frameworks/eu-ai-act" variant="primary">
              The EU AI Act evidence map
            </Button>
            <Button href="/compliance" variant="ghost">
              Explore the Compliance bundle
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="muted"
            label="Regulation (EU) 2024/1689 · facts verified 2026-07-10"
            dot
          />
        }
      />

      {/* ===== The short answer ===== */}
      <Section
        eyebrow="The short answer"
        title="Transparency, for every AI system that talks to people."
        lede="Article 50 is the EU AI Act's transparency chapter. Unlike the high-risk obligations (Annex III systems), it applies to ordinary products: a SaaS chatbot, an AI support agent, a content generator. The obligations are disclosure-shaped — tell people they are talking to AI, mark what AI generated — and they apply from August 2, 2026, a date confirmed unmoved by the Digital Omnibus amendment (reporting through 2026-07-07)."
        band="tint"
      />

      {/* ===== Obligations table ===== */}
      <Reveal>
        <Section
          eyebrow="What it requires"
          title="Four obligations, two roles."
          lede="A factual paraphrase — the regulation's text governs. Provider = who builds/places the system on the market; deployer = who uses it under their authority."
        >
          <div className="cs-matrix__frame">
            <div className="cs-matrix__wrap">
              <table className="cs-matrix">
                <thead>
                  <tr>
                    <th scope="col">Clause</th>
                    <th scope="col">Who</th>
                    <th scope="col">Obligation</th>
                  </tr>
                </thead>
                <tbody>
                  {OBLIGATIONS.map((o) => (
                    <tr key={o.clause}>
                      <th scope="row" style={{ whiteSpace: "nowrap" }}>
                        {o.clause}
                      </th>
                      <td style={{ whiteSpace: "nowrap" }}>{o.who}</td>
                      <td>{o.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-4)" }}>
            Penalties: administrative fines up to €15M or 3% of worldwide annual
            turnover, whichever is higher (Art. 99(4)).
          </p>
        </Section>
      </Reveal>

      {/* ===== What a product team ships ===== */}
      <Reveal>
        <Section
          eyebrow="What a product team ships"
          title="Three surfaces, one record."
          band="surface"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
              gap: "var(--cs-space-4)",
            }}
          >
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                1. The disclosure surface
              </p>
              <p className="cs-muted">
                An unambiguous &ldquo;you are interacting with AI&rdquo;
                affordance in the conversational UI. This is your product
                surface — design it once, version it in the repo.
              </p>
            </Card>
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                2. Machine-readable marking
              </p>
              <p className="cs-muted">
                Generated audio, image, video, and text outputs carry detectable
                artificial-origin marking (Art. 50(2)) — metadata or
                watermarking appropriate to the medium, applied at the
                generation boundary.
              </p>
            </Card>
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                3. The record that it happened
              </p>
              <p className="cs-muted">
                When a regulator or customer asks whether disclosure fired for a
                given interaction, a screenshot is a recollection. Caisson
                records disclosure events to a hash-chained, tamper-evident
                audit trail anchored write-once outside your database, and
                packages them into a dated evidence bundle — a verifiable
                answer, not an assertion.
              </p>
            </Card>
          </div>
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-6)", maxWidth: "72ch" }}
          >
            The honesty boundary, as everywhere on this site: Caisson generates
            the technical evidence; whether your surfaces satisfy Article 50 is
            a legal determination that stays with you and your counsel.
          </p>
        </Section>
      </Reveal>

      {/* ===== Timeline (facts, reads correctly after the date too) ===== */}
      <Reveal>
        <Section eyebrow="The dates" title="How the AI Act phases in.">
          <ul className="cs-lede" style={{ paddingLeft: "var(--cs-space-5)" }}>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 1, 2024</strong> — Regulation (EU) 2024/1689 enters
              into force.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>February 2, 2025</strong> — prohibited-practice bans
              apply.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 2, 2025</strong> — general-purpose AI model
              obligations apply.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 2, 2026</strong> — the general application date:
              Article 50 transparency obligations and the bulk of the high-risk
              regime become enforceable. Confirmed not extended by the Digital
              Omnibus amendment (independent reporting through 2026-07-07).
            </li>
          </ul>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section eyebrow="Article 50 FAQ" title="Common questions.">
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== CTA ===== */}
      <Section eyebrow="Get started" band="tint">
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          The audit chain, evidence bundles, and versioned configuration that
          give Article 50 disclosure a verifiable record ship in the Compliance
          bundle — wired and testable from day one.
        </p>
        <div className="cs-cta-row">
          <Button href="/compliance" variant="primary">
            Explore the Compliance bundle
          </Button>
          <Button href="/glossary/eu-ai-act-article-50" variant="ghost">
            Article 50 in the glossary
          </Button>
        </div>
      </Section>
    </>
  );
}
