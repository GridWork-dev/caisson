// The /writing hub — every dated commentary spoke is listed from WRITING_PIECES, so adding or
// replacing a record updates the crawl path without a second hand-maintained list.
import Link from "next/link";

import { Card, Hero, Reveal, Section } from "@/components";
import { breadcrumb } from "@/lib/jsonld";
import { JsonLdScript } from "@/lib/jsonld-script";
import { buildMetadata } from "@/lib/metadata";
import { WRITING_PIECES } from "@/lib/writing";

const DESCRIPTION =
  "Dated, source-linked Caisson commentary on changes in the compliance and regulated-software landscape.";

export const metadata = buildMetadata({
  title: "Writing",
  description: DESCRIPTION,
  path: "/writing",
});

export default function WritingHubPage() {
  const breadcrumbLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Writing", path: "/writing" },
  ]);

  return (
    <>
      <JsonLdScript data={breadcrumbLd} />

      <Hero eyebrow="Writing" title="Dated commentary." lede={DESCRIPTION} />

      <Section
        eyebrow="Source-linked"
        title="Read the record for its stated date"
        lede="Each piece carries the date its primary sources were checked and the exact source locators used."
      >
        <Reveal stagger={60} className="cs-grid cs-grid--2 cs-feature-grid">
          {WRITING_PIECES.map((piece) => (
            <Link
              key={piece.slug}
              href={`/writing/${piece.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Card interactive>
                <span className="cs-card-title">{piece.title}</span>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {piece.dek}
                </p>
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  Published {piece.publishedOn} · sources verified{" "}
                  {piece.verifiedOn}
                </p>
              </Card>
            </Link>
          ))}
        </Reveal>
      </Section>
    </>
  );
}
