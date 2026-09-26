// Dated commentary records for the /writing hub + spokes. A record is the content source for one
// PageSpec; the shared route renders every record through <PageSections>, matching the glossary
// and module-page registry pattern. `verifiedOn` + `sources` are machine-readable first: the
// report-only regulatory-claim watch imports this registry directly.
import {
  ARTICLE_50_PRIMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "./article-50-sources";
import type { PageMeta } from "./metadata";
import type { PageSection, PageSpec } from "./page-sections";
import type { RegulatorySource } from "./regulatory-source";

export type WritingSource = RegulatorySource;

export interface WritingPiece {
  slug: string;
  title: string;
  /** One-sentence standfirst. */
  dek: string;
  meta: PageMeta;
  publishedOn: string;
  verifiedOn: string;
  sources: readonly WritingSource[];
  sections: readonly PageSection[];
  /** Absolute internal paths to distinct, related Caisson pages. */
  related: readonly string[];
}

export function writingLastModified(
  piece: Pick<WritingPiece, "publishedOn" | "verifiedOn">,
): Date {
  const freshnessDate =
    piece.verifiedOn > piece.publishedOn ? piece.verifiedOn : piece.publishedOn;
  return new Date(`${freshnessDate}T00:00:00.000Z`);
}

export const WRITING_PIECES: readonly WritingPiece[] = [
  {
    slug: "eu-ai-act-article-50-august-december-2026",
    title:
      "Article 50 starts August 2. The adopted transition points to December 2.",
    dek: "The Commission’s final July 2026 guidance keeps Article 50’s general application date. The adopted Digital Omnibus text narrows the later deadline to Article 50(2) for qualifying pre-August generative systems, but still awaits Official Journal publication and entry into force.",
    meta: {
      title: "EU AI Act Article 50: the August and December 2026 dates",
      description:
        "What the final July 2026 Article 50 guidance and adopted Digital Omnibus text establish about the August 2 date, the pending narrow December 2 transition, and pre-existing content.",
      path: "/writing/eu-ai-act-article-50-august-december-2026",
      type: "article",
    },
    publishedOn: "2026-07-26",
    verifiedOn: ARTICLE_50_VERIFIED_ON,
    sources: ARTICLE_50_PRIMARY_SOURCES,
    sections: [
      {
        kind: "section",
        eyebrow: "Dated analysis · July 26, 2026",
        title: "What the final guidance and adopted Omnibus text establish.",
        lede: "Article 50 still generally applies from August 2, 2026. The adopted Digital Omnibus text awaits Official Journal publication and entry into force. Once effective, its new Article 111(4) gives providers of generative AI systems placed on the market before August 2 until December 2, 2026 to conform with Article 50(2)’s machine-readable marking and detection duty.",
        band: "tint",
      },
      {
        kind: "section",
        eyebrow: "The boundary",
        title:
          "The transition belongs to Article 50(2), not Article 50 as a whole.",
        lede: "The final guidance starts from the general rule: all in-scope systems must comply on August 2, regardless of when they were placed on the market or put into service. Separately, the adopted Digital Omnibus text gives qualifying generative systems placed on the market before August 2 a transition for Article 50(2)’s marking and detection duty once the amendment enters into force. The other Article 50 duties were not postponed.",
      },
      {
        kind: "featureGrid",
        cols: 3,
        eyebrow: "One system, two clocks",
        title: "A mixed product can cross both dates.",
        items: [
          {
            title: "Direct interaction · August 2",
            body: "For a system that is partly interactive and partly generative, the Article 50(1) interaction-disclosure duty still applies from August 2, 2026.",
          },
          {
            title: "Qualifying generation · December 2",
            body: "Under the adopted text, only Article 50(2)’s marking and detection duty receives the transition, and only for a generative AI system placed on the market before August 2.",
          },
          {
            title: "Everything else · August 2",
            body: "The transition does not postpone the other Article 50 duties or create a general December application date.",
          },
        ],
      },
      {
        kind: "section",
        eyebrow: "Pre-existing content",
        title: "The content cutoff is a separate rule.",
        lede: "Article 50(2) outputs and Article 50(4) deepfakes generated or manipulated before August 2, 2026 do not require retroactive marking or labelling. Public-interest text receives that treatment only when it was both generated or manipulated and published before August 2; earlier-generated text published on or after that date must be labelled.",
        band: "surface",
      },
      {
        kind: "section",
        eyebrow: "Source status",
        title: "Final guidance and an adopted amendment awaiting publication.",
        lede: "The Commission published and adopted the final guidelines on July 20, 2026. They are non-binding; only the Court of Justice of the European Union can ultimately give an authoritative interpretation of the AI Act. The Council gave the Digital Omnibus final approval on June 29, but the act awaits Official Journal publication and entry into force. This dated source reading is not legal advice.",
      },
      {
        kind: "cta",
        eyebrow: "Evergreen reference",
        title: "Need the durable Article 50 rule map?",
        lede: "The framework page covers who Article 50 applies to, the four statutory duties, express exceptions, implementation considerations, and the evidence boundary. This dated piece stays focused on what the July guidance settled.",
        primary: {
          label: "Read what Article 50 requires",
          href: "/frameworks/eu-ai-act/article-50",
        },
      },
    ],
    related: ["/frameworks/eu-ai-act/article-50", "/frameworks/eu-ai-act"],
  },
];

/**
 * Drafted, deliberately NOT published. Nothing reads this array — not the hub, not the spoke
 * route's `generateStaticParams`, not `findWritingPiece`, not the sitemap, not the claim watch —
 * so a draft cannot leak onto the live site by anyone forgetting a filter. Publishing is moving
 * one record into `WRITING_PIECES` above, which is a reviewable one-line diff.
 *
 * The Article 50 draft states legal conclusions about a regulation that is live and still being
 * amended, so the operator owns the publish decision (ADR-0395 decision 1). `publishedOn` carries
 * the intended date from ADR-0391 and is reset at publish if that date moves.
 */
export const WRITING_DRAFTS: readonly WritingPiece[] = [
  {
    slug: "auditing-our-own-article-50-claims",
    title: "We audited our own Article 50 copy. Eleven claims were wrong.",
    dek: "A clause-by-clause review of three live Caisson surfaces against Regulation (EU) 2024/1689 and the Commission’s final guidance found 45 claim units: 14 accurate, 20 incomplete, 11 wrong. The failure patterns behind them are not specific to us.",
    meta: {
      title:
        "EU AI Act Article 50: auditing our own claims against the primary sources",
      description:
        "A clause-by-clause audit of Caisson’s live EU AI Act Article 50 copy against the regulation and the final Commission guidance — 45 claim units, 11 wrong, and the failure patterns behind them.",
      path: "/writing/auditing-our-own-article-50-claims",
      type: "article",
    },
    publishedOn: "2026-08-01",
    verifiedOn: ARTICLE_50_VERIFIED_ON,
    sources: ARTICLE_50_PRIMARY_SOURCES,
    sections: [
      {
        kind: "section",
        eyebrow: "The audit",
        title: "Forty-five claim units, three live surfaces, eleven wrong.",
        lede: "On July 26, 2026 we read every regulatory claim on three live Caisson surfaces — the Article 50 explainer, the EU AI Act framework page, and the Article 50 glossary entry — against Regulation (EU) 2024/1689, the Commission’s final transparency guidelines published July 20, 2026, and the Commission’s quick-facts page. Forty-five distinct claim units: 14 accurate, 20 incomplete, 11 wrong. The corrections shipped on July 26 and 27, 2026 and are live on the pages linked at the end of this piece. This is a dated reading of primary sources, not legal advice: the guidelines are non-binding, and only the Court of Justice of the European Union can ultimately give an authoritative interpretation of the Act.",
        band: "tint",
      },
      {
        kind: "featureGrid",
        cols: 3,
        eyebrow: "Three patterns",
        title: "Ten of the eleven fell into one of three shapes.",
        items: [
          {
            title: "A categorical answer · 2 units",
            body: "A timing question with two separate clocks, answered with one flat yes or no.",
          },
          {
            title: "A record read as a proof · 6 units",
            body: "A tamper-evident log described as establishing that a legal duty was satisfied.",
          },
          {
            title: "An implementation read as a rule · 2 units",
            body: "One compliant architecture written as the architecture the regulation requires.",
          },
        ],
      },
      {
        kind: "section",
        eyebrow: "Pattern one",
        title: "A yes-or-no answer to a question with two clocks.",
        lede: "Two units answered “was the August 2, 2026 date delayed?” categorically. Ours said no. The Commission’s final guidance starts from that same rule — all in-scope systems must comply on August 2 regardless of when they were placed on the market or put into service — and then identifies one targeted transition. Under the adopted Digital Omnibus text’s new Article 111(4), providers of generative AI systems placed on the market before August 2 have until December 2, 2026 to conform with Article 50(2)’s machine-readable marking and detection duty. The Council gave that text final approval on June 29, 2026; it still awaits Official Journal publication and enters into force on the third day after publication, so the transition it creates is not yet law. A flat “nothing moved” hides the transition. A flat “it moved to December” hides that Article 50(1), 50(3), and 50(4) were never postponed, and that the instrument creating the transition is not in force. The accurate sentence carries all three parts, and it is longer than a FAQ answer wants to be.",
      },
      {
        kind: "section",
        eyebrow: "Pattern two",
        title:
          "A tamper-evident record is evidence of an event, not proof of a duty.",
        lede: "Six of the eleven said, in one wording or another, that a tamper-evident or write-once record proves the Article 50 obligation was met. It does not, and this is the correction that narrows our own product claim. Article 50(5) requires the information to be clear and distinguishable, supplied no later than the first interaction or exposure, and conformant with applicable accessibility requirements. Article 50(2) separately requires covered synthetic outputs to be machine-readably marked and detectable through solutions that are effective, interoperable, robust, and reliable as far as technically feasible. A hash-chained log establishes that a disclosure event was recorded and has not been altered since. It says nothing about whether that disclosure was clear, whether it arrived before the first interaction, whether it was accessible, or whether the marking is detectable by anyone else’s tooling. Those are the duties. The record is support for a review of them, and no clause of Article 50 requires a record at all.",
        band: "surface",
      },
      {
        kind: "section",
        eyebrow: "Pattern three",
        title: "We wrote an implementation choice as a legal requirement.",
        lede: "Two units said Article 50(2) marking happens at the generation boundary, via metadata or watermarking. The regulation requires the outputs to be machine-readably marked and detectable; the final guidance is explicit that a provider may use one or more compliant techniques and may implement marking post hoc, at the underlying model, or in the inference process. Naming one architecture as the requirement is worse than being vague. It tells a reader whose compliant design differs from ours that they are exposed, and it quietly promotes our own product shape into the standard. Where the source permits a range, the copy has to carry the range.",
      },
      {
        kind: "section",
        eyebrow: "The eleventh",
        title: "Half of a conjunctive condition is a different rule.",
        lede: "One unit described the Article 50(4) treatment of AI-generated text published to inform the public on matters of public interest as available where the content underwent human review or editorial control. The provision requires that and a natural or legal person holding editorial responsibility for the publication. Dropping the second half turns a two-part test into a one-part test and widens the reading for anyone who relies on it. It is the smallest error in the set and the easiest to repeat: conjunctions in statutory text are load-bearing, and a summary that keeps only the memorable half is not a summary.",
      },
      {
        kind: "section",
        eyebrow: "What changed",
        title:
          "The claims now carry their locators, and the locators are watched.",
        lede: "Copy fixes decay, so three structural changes shipped with them. Every Article 50 claim on the site reads its citations from one shared source contract instead of a per-page list, so a locator cannot drift between the framework page, the glossary, and a dated piece. Each source carries a machine-checkable form of itself: an expected text fragment, a SHA-256 digest of the 51-page guidance PDF, or — where the publisher serves an interstitial to automated clients — an explicit reachability-only note that records the limitation rather than claiming a stronger check. A report-only watch re-runs those checks and reports drift for human review; it never edits copy. And every dated page states when its sources were last read, which is the only honest freshness signal for a regulation still under amendment.",
      },
      {
        kind: "cta",
        eyebrow: "The rule map",
        title: "What Article 50 requires, corrected.",
        lede: "The evergreen reference covers the four duties, the two roles, the express exceptions, the penalty range, and the boundary between supporting evidence and legal determination.",
        primary: {
          label: "Read the Article 50 reference",
          href: "/frameworks/eu-ai-act/article-50",
        },
      },
    ],
    related: [
      "/frameworks/eu-ai-act/article-50",
      "/writing/eu-ai-act-article-50-august-december-2026",
      "/frameworks/eu-ai-act",
    ],
  },
];

export function findWritingPiece(slug: string): WritingPiece | undefined {
  return WRITING_PIECES.find((piece) => piece.slug === slug);
}

function breadcrumbNav(piece: WritingPiece) {
  return (
    <nav aria-label="Breadcrumb" className="cs-footnote">
      <a href="/writing" className="cs-link">
        Writing
      </a>
      {" / "}
      <span aria-current="page">{piece.title}</span>
    </nav>
  );
}

function publicationStamp(piece: WritingPiece) {
  return (
    <span className="cs-footnote">
      {`Published ${piece.publishedOn} · sources verified ${piece.verifiedOn}`}
    </span>
  );
}

function sourceList(piece: WritingPiece) {
  return (
    <ul
      className="cs-lede"
      style={{
        paddingLeft: "var(--cs-space-5)",
        display: "grid",
        gap: "var(--cs-space-2)",
      }}
    >
      {piece.sources.map((source) => (
        <li key={`${source.url}#${source.locator}`}>
          <a href={source.url} className="cs-link" rel="noreferrer">
            {source.label}
          </a>
          {` — ${source.locator}`}
        </li>
      ))}
    </ul>
  );
}

function relatedLinks(piece: WritingPiece): PageSection | undefined {
  if (piece.related.length === 0) return undefined;
  return {
    kind: "section",
    title: "Related reading",
    children: (
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--cs-space-3)",
        }}
      >
        {piece.related.map((path) => (
          <li key={path}>
            <a href={path} className="cs-link">
              {path}
            </a>
          </li>
        ))}
      </ul>
    ),
  };
}

/** WritingPiece -> standard page chrome + the record's ordered sections + source disclosure. */
export function writingPageSpec(piece: WritingPiece): PageSpec {
  const sections: PageSection[] = [
    {
      kind: "hero",
      eyebrow: "Writing",
      title: piece.title,
      lede: piece.dek,
      ctas: breadcrumbNav(piece),
      credentials: publicationStamp(piece),
    },
    ...piece.sections,
    {
      kind: "section",
      eyebrow: "Verification",
      title: "Primary sources",
      children: sourceList(piece),
      band: "surface",
    },
  ];

  const related = relatedLinks(piece);
  if (related) sections.push(related);

  return { meta: piece.meta, sections };
}
