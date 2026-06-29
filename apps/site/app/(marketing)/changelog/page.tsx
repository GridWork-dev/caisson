import { Button, Section, Card, StatusChip, Reveal } from "@/components";
import { buildMetadata } from "@/lib/metadata";
import { serializeJsonLd, techArticle, breadcrumb } from "@/lib/jsonld";
import { CHANGELOG_ENTRIES, FEED_RSS_URL } from "@/lib/changelog";
import { UpdatesForm } from "@/components/waitlist-form";

export const metadata = buildMetadata({
  title: "Changelog",
  description:
    "Caisson changelog: new modules, control mappings, and SOC 2 / HIPAA framework coverage.",
  path: "/changelog",
  type: "article",
});

export default function ChangelogPage() {
  const ldArticle = techArticle({
    headline: "Caisson changelog",
    description: "New modules, control mappings, and framework coverage.",
    url: "https://caisson.sh/changelog",
  });
  const ldBreadcrumb = breadcrumb([
    { name: "Caisson", path: "/" },
    { name: "Changelog", path: "/changelog" },
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
        eyebrow="Compliance Updates"
        title="Changelog"
        lede="New modules, control mappings, and framework coverage. The single-source feed for what ships and what changes."
      >
        <div style={{ marginTop: "var(--cs-space-5)" }}>
          <Button
            href={FEED_RSS_URL}
            external
            variant="ghost"
            aria-label="Subscribe via RSS"
          >
            RSS feed
          </Button>
        </div>
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

      {/* ===== Subscribe nudge ===== */}
      <Section band="tint" eyebrow="Stay current">
        <p className="cs-muted" style={{ marginBottom: "var(--cs-space-5)" }}>
          Subscribe via{" "}
          <a href={FEED_RSS_URL} style={{ color: "var(--cs-link)" }}>
            RSS
          </a>{" "}
          to receive framework updates and control mapping changes as they ship.
        </p>
        <UpdatesForm source="changelog" />
      </Section>
    </>
  );
}
