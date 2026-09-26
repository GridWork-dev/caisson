// One dynamic spoke file — generateStaticParams pre-renders every MODULE_PAGES record at build
// (ADR-0237 F2, same chassis as the glossary spokes). Adding a module page is adding a record to
// lib/module-pages.ts, never a new route file. Sits OUTSIDE the marketplace (hub) route group on
// purpose: a depth page gets the plain marketing shell, not the hub hero + tab row.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Hero, Section, StatusChip } from "@/components";
import { EntryLinks } from "@/components/entry-links";
import { MediaCarousel } from "@/components/media-carousel";
import { PageSections } from "@/components/page-sections";
import { TrackView } from "@/components/track-view";
import { mediaSlides } from "@/lib/media-manifest";
import { bundleLabel, bundlePagePath } from "@/components/marketplace";
import { entryDocsHrefs } from "@/lib/entry-docs";
import { breadcrumb, faqPage, moduleSoftwareApplication } from "@/lib/jsonld";
import { JsonLdScript } from "@/lib/jsonld-script";
import { entryByViewId } from "@/lib/marketplace-surface";
import { buildMetadata } from "@/lib/metadata";
import { MODULE_PAGES, type ModulePageRecord } from "@/lib/module-pages";
import type { PageSection } from "@/lib/page-sections";
import { MODULES, type CatalogModule } from "@/lib/catalog";
import styles from "./depth.module.css";

type Params = { params: Promise<{ slug: string }> };

function findRecord(slug: string): ModulePageRecord | undefined {
  return MODULE_PAGES.find((r) => r.slug === slug);
}

function findModule(slug: string): CatalogModule | undefined {
  return MODULES.find((m) => m.id === slug);
}

/** The root layout's title template appends " · Caisson" — strip a record's own brand suffix. */
function pageTitle(metaTitle: string): string {
  return metaTitle.replace(/\s*[|·—-]\s*Caisson\s*$/u, "");
}

export function generateStaticParams() {
  return MODULE_PAGES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params;
  const record = findRecord(slug);
  if (!record) notFound();
  return buildMetadata({
    title: pageTitle(record.metaTitle),
    description: record.metaDescription,
    path: `/marketplace/modules/${record.slug}`,
  });
}

/**
 * The stackCompat badge row (ADR-0263), authored from the 2026-07-06
 * compatibility snapshot — every module page shares one "what this actually plugs into"
 * row, since Postgres/RLS, billing, email, and jobs are base-level facts true for all of them.
 * Counts trued up at Kickoff-F integration (2026-07-06): 11 AI lanes after the groq/mistral/
 * together additions; 6 emitter targets after ADR-0264 (Claude Code, AGENTS.md universal base,
 * Cursor, Devin incl. the Windsurf legacy mirror, Copilot, Cline).
 */
const STACK_COMPAT_ITEMS = [
  { label: "Postgres + RLS" },
  { label: "11 AI lanes" },
  { label: "6 agent-harness targets" },
  { label: "vendor-neutral OTel" },
  { label: "4 billing providers" },
  { label: "5 email drivers" },
  { label: "pg-boss + Trigger.dev jobs" },
] as const;

function bodySections(record: ModulePageRecord): readonly PageSection[] {
  return [
    {
      kind: "section",
      title: "What it is",
      lede: record.definition,
    },
    {
      kind: "featureGrid",
      cols: 2,
      title: "What ships in the module",
      items: record.included.map((i) => ({ title: i.title, body: i.body })),
    },
    {
      kind: "codeArtifact",
      label: `${record.artifact.label}: ${record.artifact.file}`,
      code: record.artifact.code,
      lang: record.artifact.lang,
      notes: record.artifact.annotations,
    },
    {
      // The media carousel (ADR-0285 §3) — the same authored-diagram / component / code-artifact
      // slides the card viewer shows, rendered here inline via a `custom` node (MediaCarousel is a
      // client island). `omitCodeArtifact` (ADR-0290 WR-03): the codeArtifact section above already
      // renders `record.artifact` as a framed CodeBlock, so the carousel would otherwise repeat it.
      kind: "custom",
      node: (
        <Section id="demo" eyebrow="Media" title="See it work">
          <MediaCarousel
            slides={mediaSlides("module", record.slug, {
              omitCodeArtifact: true,
            })}
            label={`${record.metaTitle} media`}
          />
        </Section>
      ),
    },
    {
      kind: "stackCompat",
      eyebrow: "Compatibility",
      title: "What it plugs into",
      items: STACK_COMPAT_ITEMS,
    },
    {
      kind: "faq",
      eyebrow: "FAQ",
      title: "Real questions",
      items: record.faq,
      defaultOpenFirst: true,
    },
  ];
}

/** The sticky rail (ADR-0237 F2): type chip, the module's docs + live demo, and its families. */
function ModuleRail({ mod }: { mod: CatalogModule }) {
  const entry = entryByViewId(`module:${mod.id}`);
  return (
    <aside className={styles.rail} aria-label={`${mod.label} links`}>
      <Card accent>
        <div className={styles.railCard}>
          <div style={{ display: "flex", gap: "var(--cs-space-2)" }}>
            <StatusChip label="Module" />
          </div>
          <EntryLinks
            label={mod.label}
            docsHref={entryDocsHrefs()[`module:${mod.id}`]}
            // This page frames the demo itself, so the rail jumps to it instead of self-linking.
            demoHref={entry?.demoHref ? "#demo" : null}
          />
          <p className="cs-footnote">
            {mod.bundles.length === 0 ? (
              "Standalone: composes onto the base on its own."
            ) : (
              <>
                Part of{" "}
                {mod.bundles.map((b, i) => (
                  <span key={b}>
                    {i > 0 ? ", " : ""}
                    <Link className="cs-link" href={bundlePagePath(b)}>
                      {bundleLabel(b)}
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        </div>
      </Card>
    </aside>
  );
}

export default async function ModuleDepthPage(props: Params) {
  const { slug } = await props.params;
  const record = findRecord(slug);
  const mod = findModule(slug);
  if (!record || !mod) notFound();

  const breadcrumbLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Modules", path: "/marketplace?type=modules" },
    { name: mod.label, path: `/marketplace/modules/${mod.id}` },
  ]);
  const appLd = moduleSoftwareApplication(mod, {
    description: record.metaDescription,
  });
  const faqLd = faqPage(record.faq);

  return (
    <>
      <TrackView item={`module:${mod.id}`} />
      <JsonLdScript data={breadcrumbLd} />
      <JsonLdScript data={appLd} />
      <JsonLdScript data={faqLd} />

      <Hero
        eyebrow={
          mod.bundles.length === 0
            ? "Module · Standalone"
            : `Module · ${bundleLabel(mod.bundles[0]!)}`
        }
        title={mod.label}
        lede={record.heroOneLiner}
        ctas={
          <nav aria-label="Breadcrumb" className="cs-footnote">
            <Link className="cs-link" href="/marketplace">
              Marketplace
            </Link>
            {" / "}
            <Link className="cs-link" href="/marketplace?type=modules">
              Modules
            </Link>
            {" / "}
            <span aria-current="page">{mod.label}</span>
          </nav>
        }
      />

      <div className="cs-container" style={{ padding: "0 var(--cs-space-6)" }}>
        <div className={styles.grid}>
          <div>
            <PageSections sections={bodySections(record)} />
          </div>
          <ModuleRail mod={mod} />
        </div>
      </div>
    </>
  );
}
