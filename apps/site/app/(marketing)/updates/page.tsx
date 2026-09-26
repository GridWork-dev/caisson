import { Button, Section, Card, StatusChip, Reveal, Icon } from "@/components";
import { buildMetadata } from "@/lib/metadata";
import { serializeJsonLd, techArticle, breadcrumb } from "@/lib/jsonld";
import { CHANGELOG_ENTRIES, FEED_RSS_URL } from "@/lib/changelog";

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
      {/* ===== Header ===== */}
      <Section
        flush
        as="h1"
        eyebrow="Release history"
        title="Updates"
        lede="Every Caisson release, dated, versioned, and tagged by what changed, plus a way to follow along."
      >
        {/* The RSS feed is this page's follow path. */}
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
            "Notable module and module-family changes as they ship",
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
