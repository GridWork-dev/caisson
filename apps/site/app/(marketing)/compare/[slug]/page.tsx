// One dynamic spoke renders every COMPARISONS record (AEO program stage 2) — generateStaticParams
// pre-renders each at build. Adding a "Caisson vs X" page is adding a record to lib/comparisons.ts,
// never a new route file (same spoke pattern as the glossary + module depth pages). This is a
// PURPOSE-BUILT comparison template, not the ADR-0232 generic section-union renderer.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Button,
  Card,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
} from "@/components";
import { TrackView } from "@/components/track-view";
import {
  ACCESSED,
  COMPARISONS,
  findComparison,
  type Comparison,
  type ComparisonRow,
} from "@/lib/comparisons";
import { breadcrumb, faqPage, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import {
  bundlePrice,
  formatUsd,
  MODULE_PRICES,
  RENEWAL_RATE_PERCENT,
} from "@/lib/pricing";

// Caisson's own facts come from the pricing display SOT (lib/pricing.ts), never hardcoded here — so
// a number can never drift between a comparison page and the marketplace.
const COMPLIANCE_PRICE = bundlePrice("compliance");
const EVERYTHING_PRICE = bundlePrice("everything");
const MODULE_FLOOR = formatUsd(Math.min(...MODULE_PRICES.map((m) => m.amount)));

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params;
  const c = findComparison(slug);
  if (!c) notFound();
  return buildMetadata({
    title: c.metaTitle,
    description: c.metaDescription,
    path: `/compare/${c.slug}`,
  });
}

/** One matrix cell: a check for `true`, an em-dash for `false`, or the string verbatim. */
function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <td className="cs-matrix__yes" aria-label="included">
        <Icon name="check" />
      </td>
    ) : (
      <td aria-label="not included">—</td>
    );
  }
  return <td>{value}</td>;
}

/** Purpose-built two-column comparison table. Reuses the shared `cs-matrix` styling (co-located in
 *  the kit) with a correct corner header — the SkuMatrix primitive hardcodes a "Module" corner for
 *  the editions×modules grid, which would mislabel a vs-page. */
function ComparisonTable({
  competitor,
  rows,
}: {
  competitor: string;
  rows: readonly ComparisonRow[];
}) {
  return (
    <div className="cs-matrix__frame">
      <div className="cs-matrix__wrap">
        <table className="cs-matrix">
          <thead>
            <tr>
              <th scope="col">Detail</th>
              <th scope="col">Caisson</th>
              <th scope="col">{competitor}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <Cell value={r.caisson} />
                <Cell value={r.competitor} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ComparePage(props: Params) {
  const { slug } = await props.params;
  const c: Comparison | undefined = findComparison(slug);
  if (!c) notFound();

  const bcLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Comparisons", path: "/compare" },
    { name: `Caisson vs ${c.competitor}`, path: `/compare/${c.slug}` },
  ]);
  // FAQPage mirrors the FAQs rendered visibly below (jsonld.ts faqPage contract).
  const faqLd = faqPage(c.faq);

  return (
    <>
      <TrackView item={`compare:${c.slug}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(bcLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Comparison"
        title={`Caisson vs ${c.competitor}`}
        lede={c.heroLede}
        ctas={
          <>
            <Button href="/compliance" variant="primary">
              Explore the Compliance bundle
            </Button>
            <Button href="/compare" variant="ghost">
              Compare all kits
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="muted"
            label={`${c.competitor} facts verified ${ACCESSED}`}
            dot
          />
        }
      />

      {/* ===== Answer capsule (top 30%, answer-first) ===== */}
      <Section
        eyebrow="The short answer"
        title="Which should you use?"
        lede={c.answer}
        band="tint"
      />

      {/* ===== What the competitor is (dated, scraped) ===== */}
      <Reveal>
        <Section
          eyebrow={`About ${c.competitor}`}
          title={`What ${c.competitor} is`}
          lede={
            <>
              {c.category}. Facts below were read from{" "}
              <a href={c.competitorUrl} rel="noreferrer">
                {c.competitorUrl.replace(/^https?:\/\//, "")}
              </a>{" "}
              on {ACCESSED}.
            </>
          }
        >
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-2)",
              flexWrap: "wrap",
              marginBottom: "var(--cs-space-6)",
            }}
          >
            <StatusChip tone="accent" label={c.competitorPrice} />
            <StatusChip tone="muted" label={c.competitorLicense} />
          </div>
          <ul className="cs-lede" style={{ paddingLeft: "var(--cs-space-5)" }}>
            {c.competitorFacts.map((f) => (
              <li key={f} style={{ marginBottom: "var(--cs-space-2)" }}>
                {f}
              </li>
            ))}
          </ul>
        </Section>
      </Reveal>

      {/* ===== The honest matrix ===== */}
      <Reveal>
        <Section
          eyebrow="Side by side"
          title="An honest comparison"
          lede={`Where ${c.competitor} has a capability, it is marked. Caisson is the compliance and tenant-isolation substrate; the kit wins the rows it wins.`}
        >
          <ComparisonTable competitor={c.competitor} rows={c.rows} />
        </Section>
      </Reveal>

      {/* ===== What the competitor is genuinely better at (credibility law) ===== */}
      <Reveal>
        <Section
          eyebrow="Credit where due"
          title={`What ${c.competitor} is genuinely better at`}
          lede="A comparison that only flatters one side isn't worth reading. Here is what this kit does well."
          band="surface"
        >
          <FeatureGrid cols={2}>
            {c.competitorStrengths.map((s) => (
              <Card key={s.title}>
                <span className="cs-card-title">{s.title}</span>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {s.body}
                </p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Where Caisson draws the line ===== */}
      <Reveal>
        <Section
          eyebrow="The line"
          title="Where Caisson draws the line"
          lede="The compliance and tenant-isolation substrate a launch kit leaves to you."
        >
          <FeatureGrid cols={2}>
            {c.caissonLine.map((s) => (
              <Card key={s.title}>
                <span className="cs-card-title">{s.title}</span>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {s.body}
                </p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Which should you pick ===== */}
      <Reveal>
        <Section
          eyebrow="How to choose"
          title="Which should you pick?"
          band="surface"
        >
          <FeatureGrid cols={3}>
            <Card>
              <span className="cs-card-title">{`Pick ${c.competitor}`}</span>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                {c.whenPickCompetitor}
              </p>
            </Card>
            <Card>
              <span className="cs-card-title">Pick Caisson</span>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                {c.whenPickCaisson}
              </p>
            </Card>
            <Card>
              <span className="cs-card-title">Use both</span>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                {c.whenBoth}
              </p>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Caisson licensing (real terms + prices from the SOT) ===== */}
      <Reveal>
        <Section
          eyebrow="How Caisson ships"
          title="One-time, own the source."
          lede={
            <>
              Caisson is a one-time perpetual license — the price never recurs,
              and it includes 12 months of updates from your purchase date,
              renewable per entitlement afterward at {RENEWAL_RATE_PERCENT}% of
              list per year. The Base substrate is Apache-2.0; the compliance
              modules are commercial.
            </>
          }
          band="tint"
        >
          <FeatureGrid cols={3}>
            <Card>
              <p className="cs-card-title">Compliance bundle</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                {COMPLIANCE_PRICE}, one-time. Fail-closed RLS, WORM, the audit
                chain, evidence packs, and the framework and signing carves —
                the whole substrate this comparison is about.
              </p>
            </Card>
            <Card>
              <p className="cs-card-title">À la carte</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Take a single module from {MODULE_FLOOR} — audit-worm,
                field-crypto, or compliance-core on their own, onto your
                existing Postgres app.
              </p>
            </Card>
            <Card>
              <p className="cs-card-title">Everything bundle</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                {EVERYTHING_PRICE} covers every bundle and every à-la-carte
                module, plus the open base, in one purchase.
              </p>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== FAQ (visible; mirrors the FAQPage JSON-LD) ===== */}
      <Reveal>
        <Section eyebrow="Questions" title="Common questions." band="surface">
          <Faq items={c.faq} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">Ship the compliant backend.</h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Explore the Compliance bundle, browse every module in the marketplace,
          or read another comparison.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          <Button href="/compliance" variant="primary">
            Explore the Compliance bundle
          </Button>
          <Button href="/marketplace" variant="ghost">
            Browse the marketplace
          </Button>
          <Button href="/compare" variant="ghost">
            Compare all kits
          </Button>
        </div>
      </Section>
    </>
  );
}
