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
import "@caisson-sh/ui/components/sku-matrix.css";

import {
  Button,
  Card,
  Faq,
  Hero,
  Reveal,
  Section,
  StatusChip,
} from "@/components";
import {
  ARTICLE_50_PRIMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "@/lib/article-50-sources";
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
    "EU AI Act Article 50 generally applies from August 2, 2026. Understand the four provider and deployer duties, their exceptions, the narrow December transition, and the evidence boundary.",
  path: "/frameworks/eu-ai-act/article-50",
  type: "article",
});

// Obligations table — factual paraphrase of Regulation (EU) 2024/1689, Chapter IV, Article 50.
const OBLIGATIONS = [
  {
    clause: "Art. 50(1)",
    who: "Providers",
    what: "Systems intended to interact directly with people must be designed so those people are informed they are interacting with AI, unless that is obvious to a reasonably well-informed, observant, and circumspect person in context. A qualified law-enforcement exception also applies.",
  },
  {
    clause: "Art. 50(2)",
    who: "Providers",
    what: "Providers of AI systems, including general-purpose AI systems, that generate covered synthetic audio, image, video, or text must make the outputs machine-readably marked and detectable through effective, interoperable, robust, and reliable solutions as far as technically feasible. Editing, non-substantial-alteration, and qualified law-enforcement exceptions apply.",
  },
  {
    clause: "Art. 50(3)",
    who: "Deployers",
    what: "Deployers of emotion-recognition or biometric-categorisation systems must inform exposed people and process personal data under applicable Union law. A qualified law-enforcement exception applies.",
  },
  {
    clause: "Art. 50(4)",
    who: "Deployers",
    what: "Deployers must disclose covered deepfakes. Covered public-interest text must be disclosed unless it underwent human review or editorial control and a natural or legal person holds editorial responsibility. Artistic-content and qualified law-enforcement regimes also apply.",
  },
] as const;

const FAQ = [
  {
    question: "Does Article 50 apply to my SaaS chatbot or AI agent?",
    answer:
      "If your product is intended to interact directly with people, Article 50(1) applies regardless of high-risk status: the person must be informed they are interacting with AI unless that is obvious in context to a reasonably well-informed, observant, and circumspect person. Article 50(2)'s marking and detection duty applies separately to covered synthetic content, subject to its express exceptions and the targeted transition for qualifying pre-August generative systems.",
  },
  {
    question: "Was the August 2, 2026 date delayed?",
    answer:
      "Not broadly. Article 50 generally applies from August 2, 2026. The adopted Digital Omnibus text awaits Official Journal publication and entry into force. Once effective, its new Article 111(4) gives providers of generative AI systems placed on the market before that date until December 2, 2026 to conform with Article 50(2)'s marking and detection duty. The other Article 50 duties were not postponed.",
  },
  {
    question: "What are the penalties for non-compliance?",
    answer:
      "Article 50 non-compliance can attract administrative fines up to EUR 15 million or, for an undertaking, up to 3% of total worldwide annual turnover for the preceding financial year, whichever is higher. For SMEs, including start-ups, the applicable cap is the percentage or fixed amount, whichever is lower. Enforcement sits with national market-surveillance authorities, the AI Office for systems under its supervision, and the European Data Protection Supervisor for EU institutions.",
  },
  {
    question: "Does Caisson make my product Article 50 compliant?",
    answer:
      "No. The disclosure surface is your product's UI, and whether it satisfies Article 50 is a legal determination. Caisson can preserve evidence that a disclosure event was recorded through a tamper-evident audit trail, versioned configuration, and a dated evidence bundle. That supporting record does not by itself establish that the disclosure, timing, accessibility, marking, or detection requirements were satisfied.",
  },
  {
    question: "Do pre-existing outputs need retroactive labels?",
    answer:
      "Article 50(2) outputs and Article 50(4) deepfakes generated or manipulated before August 2, 2026 do not require retroactive marking or labelling. For public-interest text, the same rule applies only when the text was both generated or manipulated and published before that date; earlier-generated text published on or after August 2 must be labelled.",
  },
] as const;

const articleLd = techArticle({
  headline: "EU AI Act Article 50: the August 2, 2026 transparency obligations",
  description:
    "What EU AI Act Article 50 requires from August 2, 2026, the narrow Article 50(2) transition to December 2, and how evidence records support rather than establish compliance.",
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
        title="Article 50 applies from August 2, 2026."
        lede={
          <>
            Providers and deployers carry four distinct transparency duties,
            subject to express exceptions. The adopted Digital Omnibus text
            awaits Official Journal publication and entry into force. Once
            effective, its targeted transition runs to December 2, 2026 only for
            Article 50(2)&rsquo;s marking and detection duty on qualifying
            generative systems placed on the market before August 2. Here is the
            durable rule map and the boundary between compliance and supporting
            evidence.
          </>
        }
        ctas={
          <>
            <Button href="/frameworks/eu-ai-act" variant="primary">
              The EU AI Act evidence map
            </Button>
            <Button href="/compliance" variant="ghost">
              Explore the Compliance module family
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="muted"
            label={`Final Commission guidance published 2026-07-20 · primary sources reviewed ${ARTICLE_50_VERIFIED_ON}`}
            dot
          />
        }
      />

      {/* ===== The short answer ===== */}
      <Section
        eyebrow="The short answer"
        title="Four duties that are not limited to high-risk systems."
        lede="Article 50 reaches some ordinary products as well as high-risk systems. Article 50(1) covers systems intended to interact directly with people; Article 50(2) separately covers providers of systems generating specified synthetic content; Articles 50(3)–(4) assign deployer duties. Article 50 generally applies from August 2, 2026. The adopted Digital Omnibus text awaits Official Journal publication and entry into force. Once effective, it adds a targeted transition to December 2, 2026 for Article 50(2)’s marking and detection duty on qualifying systems placed on the market before August 2."
        band="tint"
      />

      {/* ===== Obligations table ===== */}
      <Reveal>
        <Section
          eyebrow="What it requires"
          title="Four obligations, two roles."
          lede="A factual paraphrase; the regulation’s text governs. Provider = the actor that develops or has the system developed and places it on the market or puts it into service under its own name or trademark. Deployer = the actor using it under its authority, excluding personal non-professional use."
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
            Article 50 information must be clear and distinguishable, supplied
            no later than the first interaction or exposure, and conform to
            applicable accessibility requirements (Art. 50(5)). Penalties can
            reach EUR 15 million or 3% of worldwide annual turnover, whichever
            is higher for an undertaking (Art. 99(4)); the SME cap uses the
            lower applicable amount (Art. 99(6)).
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
          <div className="cs-grid cs-grid--3">
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                1. The disclosure surface
              </p>
              <p className="cs-muted">
                Where Article 50(1) applies, provide clear and distinguishable
                information no later than the first interaction, unless the AI
                nature of the interaction is already obvious in context. The
                regulation does not prescribe one UI affordance.
              </p>
            </Card>
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                2. Machine-readable marking
              </p>
              <p className="cs-muted">
                Covered outputs must be machine-readably marked and detectable
                through an effective, interoperable, robust, and reliable
                technical solution. The final guidance permits compliant marking
                post hoc, at the model, or during inference.
              </p>
            </Card>
            <Card>
              <p style={{ fontWeight: 500, marginBottom: "var(--cs-space-2)" }}>
                3. The record that it happened
              </p>
              <p className="cs-muted">
                A dated, tamper-evident record can preserve evidence that a
                disclosure event was recorded. It is supporting evidence, not a
                substitute for the disclosure, timing, accessibility, marking,
                and detection requirements.
              </p>
            </Card>
          </div>
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-6)", maxWidth: "72ch" }}
          >
            The honesty boundary, as everywhere on this site: Caisson generates
            technical evidence; whether your surfaces satisfy Article 50 is a
            separate legal determination that stays with you and your counsel.
          </p>
        </Section>
      </Reveal>

      {/* ===== Timeline (facts, reads correctly after the date too) ===== */}
      <Reveal>
        <Section eyebrow="The dates" title="How the AI Act phases in.">
          <ul className="cs-lede" style={{ paddingLeft: "var(--cs-space-5)" }}>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 1, 2024</strong>: Regulation (EU) 2024/1689 enters
              into force.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>February 2, 2025</strong>: prohibited-practice bans apply.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 2, 2025</strong>: general-purpose AI model
              obligations apply, except Article 101.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>August 2, 2026</strong>: the general application date.
              Article 50 generally applies. The other Article 50 duties were not
              postponed.
            </li>
            <li style={{ marginBottom: "var(--cs-space-2)" }}>
              <strong>December 2, 2026</strong>: under the adopted Digital
              Omnibus text, once it enters into force, providers of generative
              AI systems placed on the market before August 2 must conform with
              Article 50(2)&rsquo;s marking and detection duty.
            </li>
          </ul>
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-4)", maxWidth: "72ch" }}
          >
            Article 50(2) outputs and Article 50(4) deepfakes generated or
            manipulated before August 2, 2026 do not require retroactive marking
            or labelling. Public-interest text follows that rule only when it
            was both generated or manipulated and published before the cutoff.
          </p>
        </Section>
      </Reveal>

      {/* ===== Dated analysis cross-link ===== */}
      <Reveal>
        <Section
          eyebrow="Dated analysis · July 26, 2026"
          title="What the July 2026 final guidance settled."
          lede="The writing piece isolates the August-versus-December question, the mixed-system example, and the separate rule for pre-existing content. This page remains the evergreen reference for the duties, roles, exceptions, and implementation boundary."
          band="tint"
        >
          <Button
            href="/writing/eu-ai-act-article-50-august-december-2026"
            variant="ghost"
          >
            Read the dated guidance analysis
          </Button>
        </Section>
      </Reveal>

      {/* ===== Primary sources ===== */}
      <Reveal>
        <Section
          eyebrow="Verification"
          title="Primary sources."
          lede={`Reviewed ${ARTICLE_50_VERIFIED_ON}. The final Commission guidelines are non-binding; only the Court of Justice of the European Union can ultimately give an authoritative interpretation of the AI Act. The adopted Digital Omnibus text awaits Official Journal publication and entry into force.`}
        >
          <ul
            className="cs-lede"
            style={{
              paddingLeft: "var(--cs-space-5)",
              display: "grid",
              gap: "var(--cs-space-2)",
            }}
          >
            {ARTICLE_50_PRIMARY_SOURCES.map((source) => (
              <li key={source.url}>
                <a className="cs-link" href={source.url} rel="noreferrer">
                  {source.label}
                </a>{" "}
                — {source.locator}
              </li>
            ))}
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
          preserve evidence of Article 50 disclosure events ship in the
          Compliance module family, wired and testable from day one. That
          evidence supports review; it does not determine legal satisfaction.
        </p>
        <div className="cs-cta-row">
          <Button href="/compliance" variant="primary">
            Explore the Compliance module family
          </Button>
          <Button href="/frameworks/eu-ai-act" variant="ghost">
            The EU AI Act overview
          </Button>
        </div>
      </Section>
    </>
  );
}
