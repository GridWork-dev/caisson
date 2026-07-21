import {
  Button,
  Section,
  Card,
  CodeBlock,
  Faq,
  FeatureGrid,
  StatusChip,
  Reveal,
  Icon,
} from "@/components";
import { buildMetadata } from "@/lib/metadata";
import {
  serializeJsonLd,
  techArticle,
  breadcrumb,
  faqPage,
} from "@/lib/jsonld";
import { CHANGELOG_ENTRIES, FEED_RSS_URL } from "@/lib/changelog";
import { bundlePrice, planPrice } from "@/lib/pricing";

// Coverage-window explainer copy (verified against services/license + registry/worker source,
// outputs/research/compliance-updates-page-record-2026-07-19.json). Entitlement-honest: Compliance
// Updates renews REACH into the registry, never rewrites code the buyer already owns.
const COVERAGE_WINDOW_ITEMS = [
  {
    title: "Every paid cycle stamps a coverage horizon",
    body: "Each granting invoice writes a subscription-sourced grant that sets updates_expires_at to now plus one cadence on the buyer's compliance entitlement.",
  },
  {
    title: "computeUpdatesWindows folds the most-favorable bound",
    body: "The buyer's one-time bundle window and any active subscription coverage horizon are folded together, taking whichever bound reaches furthest.",
  },
  {
    title: "windowFilterEntry enforces it fail-closed, at the edge",
    body: "The registry Worker keeps only versions published at or before the resolved cutoff on every pull, so a module with zero in-window versions returns exactly like one never bought.",
  },
  {
    title: "Cancelling doesn't touch code you already pulled",
    body: "Cancelling only stops new coverage-horizon stamps going forward. Nothing revokes or breaks a version already sitting in your node_modules.",
  },
] as const;

const COVERAGE_WINDOW_FAQ = [
  {
    question: "Is Compliance Updates the same as the Compliance bundle?",
    answer: `No. The Compliance bundle (${bundlePrice("compliance")}, one-time) is the code; Compliance Updates (${planPrice("compliance-updates")}) is the subscription that keeps its control mappings and evidence packs current by extending the license's per-entitlement updates window.`,
  },
  {
    question: "Does an active subscription make my organization compliant?",
    answer:
      "No. No module or subscription makes an organization compliant; that determination is your organization's and its auditor's to make. Compliance Updates keeps the technical control mappings and evidence-pack generation current as frameworks revise. The administrative controls and the audit itself remain yours.",
  },
] as const;

export const metadata = buildMetadata({
  title: "Updates",
  description:
    "Caisson updates: every base-substrate, kernel, and module release, dated and versioned, plus how to follow along.",
  path: "/updates",
  type: "article",
});

export default function UpdatesPage() {
  const ldArticle = techArticle({
    headline: "Caisson updates",
    description:
      "The single-source record of every base-substrate, kernel, and module release, dated and versioned.",
    url: "https://caisson.sh/updates",
  });
  const ldBreadcrumb = breadcrumb([
    { name: "Caisson", path: "/" },
    { name: "Updates", path: "/updates" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldArticle) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(faqPage(COVERAGE_WINDOW_FAQ)),
        }}
      />

      {/* ===== Header ===== */}
      <Section
        flush
        as="h1"
        eyebrow="Release history"
        title="Updates"
        lede="Every Caisson release, dated, versioned, and tagged by what changed, plus a way to follow along."
      >
        {/* The footer already renders the identical "Product updates" capture on every page
            (site-wide, SiteFooter -> UpdatesFormLazy) - a second copy of the same form here
            duplicated it back-to-back on this page (visual-audit id f136990a6a7b2313). The RSS
            feed is this page's own, distinct follow path. */}
        <div style={{ marginTop: "var(--cs-space-5)" }}>
          <Button href={FEED_RSS_URL} external variant="primary">
            Subscribe via RSS
          </Button>
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            marginTop: "var(--cs-space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--cs-space-2)",
          }}
        >
          {[
            "Release notes for every base-substrate and kernel version",
            "Notable module and bundle changes as they ship",
          ].map((item) => (
            <li
              key={item}
              style={{
                display: "flex",
                gap: "var(--cs-space-2)",
                alignItems: "flex-start",
                color: "var(--cs-fg-muted)",
                fontSize: "var(--cs-text-sm)",
              }}
            >
              <Icon name="check" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* ===== Coverage window ===== */}
      <Reveal>
        <Section
          eyebrow="Coverage window"
          title="What keeps versions pulling"
          lede="Compliance Updates is the annual subscription that keeps a Compliance bundle license current with new package versions. Each paid cycle stamps a coverage horizon that the registry Worker enforces at the edge, so a version published after the window lapses is fail-closed invisible: it renews reach, never rewrites the code you already own."
        >
          <FeatureGrid cols={2}>
            {COVERAGE_WINDOW_ITEMS.map((item) => (
              <Card key={item.title}>
                <h3 className="cs-card-title">{item.title}</h3>
                <p className="cs-muted">{item.body}</p>
              </Card>
            ))}
          </FeatureGrid>

          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <CodeBlock
              frame
              label="registry/worker/handler.ts"
              code={`export function windowFilterEntry(
  entry: ModuleEntry,
  cutoff: string,
): ModuleEntry | null {
  const bound = Date.parse(cutoff);
  const versions = entry.versions.filter(
    (v) => Date.parse(v.publishedAt) <= bound,
  );
  let newest = versions[0];
  if (newest === undefined) return null;
  for (const v of versions) {
    if (Date.parse(v.publishedAt) > Date.parse(newest.publishedAt)) newest = v;
  }
  const latest = versions.some((v) => v.version === entry.latest)
    ? entry.latest
    : newest.version;
  return { ...entry, latest, versions };
}`}
            />
          </div>

          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <Faq items={COVERAGE_WINDOW_FAQ} />
          </div>

          <div style={{ marginTop: "var(--cs-space-5)" }}>
            <Button
              href="/marketplace/plans#compliance-updates"
              variant="ghost"
            >
              Compliance Updates: {planPrice("compliance-updates")}
            </Button>
          </div>
        </Section>
      </Reveal>

      {/* ===== Entries ===== */}
      <Section>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--cs-space-6)",
          }}
        >
          {CHANGELOG_ENTRIES.map((entry, i) => (
            <Reveal key={entry.slug} delay={i * 60} as="article">
              <Card>
                <div
                  id={entry.slug}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "min(12ch, 30%) 1fr",
                    gap: "var(--cs-space-5)",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Date column — monospaced tabular figures */}
                  <time
                    dateTime={entry.date}
                    className="cs-num"
                    style={{
                      fontFamily: "var(--cs-font-mono)",
                      fontSize: "var(--cs-text-sm)",
                      color: "var(--cs-fg-muted)",
                      paddingTop: "var(--cs-space-1)",
                    }}
                  >
                    {entry.date}
                  </time>

                  {/* Content column */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "var(--cs-space-3)",
                        marginBottom: "var(--cs-space-3)",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "var(--cs-text-lg)",
                          fontWeight: "var(--cs-weight-medium)",
                          margin: 0,
                          lineHeight: "var(--cs-leading-snug)",
                        }}
                      >
                        {entry.title}
                      </h2>
                      {entry.version && (
                        <StatusChip label={entry.version} tone="muted" />
                      )}
                    </div>

                    <p
                      className="cs-muted"
                      style={{ marginBottom: "var(--cs-space-4)" }}
                    >
                      {entry.body}
                    </p>

                    {entry.tags && entry.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "var(--cs-space-2)",
                        }}
                      >
                        {entry.tags.map((tag) => (
                          <StatusChip key={tag} label={tag} tone="muted" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
