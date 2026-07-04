// One dynamic spoke file — generateStaticParams pre-renders every MODULE_PAGES record at build
// (ADR-0237 F2, same chassis as the glossary spokes). Adding a module page is adding a record to
// lib/module-pages.ts, never a new route file. Sits OUTSIDE the marketplace (hub) route group on
// purpose: a depth page gets the plain marketing shell, not the hub hero + tab row.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Hero, MobileBuyBar, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { PageSections } from "@/components/page-sections";
import { TrackView } from "@/components/track-view";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import {
  breadcrumb,
  faqPage,
  moduleSoftwareApplication,
  serializeJsonLd,
} from "@/lib/jsonld";
import { moduleMark } from "@/lib/marks";
import { buildMetadata } from "@/lib/metadata";
import { MODULE_PAGES, type ModulePageRecord } from "@/lib/module-pages";
import type { PageSection } from "@/lib/page-sections";
import {
  formatUsd,
  MODULE_PRICES,
  priceById,
  type ModulePrice,
} from "@/lib/pricing";
import styles from "./depth.module.css";

type Params = { params: Promise<{ slug: string }> };

function findRecord(slug: string): ModulePageRecord | undefined {
  return MODULE_PAGES.find((r) => r.slug === slug);
}

function findPrice(slug: string): ModulePrice | undefined {
  return MODULE_PRICES.find((m) => m.id === slug);
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

function bodySections(record: ModulePageRecord): readonly PageSection[] {
  return [
    {
      kind: "section",
      eyebrow: "Definition",
      title: "What it is",
      lede: record.definition,
    },
    {
      kind: "featureGrid",
      cols: 2,
      eyebrow: "Included",
      title: "What ships in the module",
      items: record.included.map((i) => ({ title: i.title, body: i.body })),
    },
    {
      kind: "codeArtifact",
      label: `${record.artifact.label} — ${record.artifact.file}`,
      code: record.artifact.code,
    },
    { kind: "media", icon: moduleMark(record.slug) },
    {
      kind: "faq",
      eyebrow: "FAQ",
      title: "Real questions",
      items: record.faq,
      defaultOpenFirst: true,
    },
  ];
}

/** The sticky buy rail (ADR-0237 F2): type chip, committed price, add-to-cart, the
 *  entitlement-honest edition cross-sell, and curated glossary reading. */
function BuyRail({
  record,
  price,
}: {
  record: ModulePageRecord;
  price: ModulePrice;
}) {
  const catalogItem = moduleCatalogItem(price.id);
  const edition = priceById(price.edition);
  const related = record.relatedGlossary
    .map((slug) => GLOSSARY_TERMS.find((t) => t.slug === slug))
    .filter((t) => t !== undefined);

  return (
    <aside className={styles.rail} aria-label={`Buy ${price.label}`}>
      <Card accent>
        <div className={styles.railCard}>
          <div style={{ display: "flex", gap: "var(--cs-space-2)" }}>
            <StatusChip label="Module" />
            <StatusChip label="One-time" tone="success" dot />
          </div>
          <div>
            <div className={styles.railPrice}>{formatUsd(price.amount)}</div>
            <p className="cs-footnote">
              One-time, perpetual license. Own the source.
            </p>
          </div>
          {catalogItem && (
            <AddToCartButton item={toCartItem(catalogItem)} variant="primary" />
          )}
          <p className="cs-footnote">{record.sells.note}</p>
          {price.standaloneOnly ? (
            <p className="cs-footnote">
              Standalone module — no edition includes it.
            </p>
          ) : (
            edition &&
            edition.amount !== null && (
              <p className="cs-footnote">
                Or composed into the{" "}
                <Link href={`/${price.edition}`}>{edition.label} edition</Link>{" "}
                — {formatUsd(edition.amount)}.
              </p>
            )
          )}
          {related.length > 0 && (
            <div>
              <div
                className="cs-status"
                style={{ marginBottom: "var(--cs-space-2)" }}
              >
                Related reading
              </div>
              <ul className={styles.railList}>
                {related.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/glossary/${t.slug}`}>{t.term}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}

/** The condensed sticky mobile counterpart to `BuyRail` (ADR-0242): same price + label + Add-to-cart
 *  action, reused as-is — not reinvented — so the two surfaces can never drift out of agreement. The
 *  full card above still renders at its usual position for the edition cross-sell and related
 *  reading; this bar is the persistent reminder that stays visible at every scroll position. */
function MobileBuyBarSection({ price }: { price: ModulePrice }) {
  const catalogItem = moduleCatalogItem(price.id);
  if (!catalogItem) return null;
  return (
    <MobileBuyBar
      label={price.label}
      price={formatUsd(price.amount)}
      action={
        <AddToCartButton item={toCartItem(catalogItem)} variant="primary" />
      }
    />
  );
}

export default async function ModuleDepthPage(props: Params) {
  const { slug } = await props.params;
  const record = findRecord(slug);
  const price = findPrice(slug);
  if (!record || !price) notFound();

  const edition = priceById(price.edition);
  const breadcrumbLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
    { name: "Modules", path: "/marketplace/modules" },
    { name: price.label, path: `/marketplace/modules/${price.id}` },
  ]);
  const appLd = moduleSoftwareApplication(price, {
    description: record.metaDescription,
  });
  const faqLd = faqPage(record.faq);

  return (
    <>
      <TrackView item={`module:${price.id}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      <Hero
        eyebrow={
          price.standaloneOnly
            ? "Module · Standalone"
            : `Module · ${edition?.label ?? price.edition}`
        }
        title={price.label}
        lede={record.heroOneLiner}
        ctas={
          <nav aria-label="Breadcrumb" className="cs-footnote">
            <Link href="/marketplace">Marketplace</Link>
            {" / "}
            <Link href="/marketplace/modules">Modules</Link>
            {" / "}
            <span aria-current="page">{price.label}</span>
          </nav>
        }
      />

      <div className="cs-container" style={{ padding: "0 var(--cs-space-6)" }}>
        <div className={styles.grid}>
          <div>
            <PageSections sections={bodySections(record)} />
          </div>
          <BuyRail record={record} price={price} />
        </div>
      </div>

      <div className={styles.mobileBarWrap}>
        <MobileBuyBarSection price={price} />
      </div>
    </>
  );
}
