// One dynamic spoke file — generateStaticParams pre-renders every GLOSSARY_TERMS entry at build
// (glossary SPEC §IA). Adding a term is adding a record to GLOSSARY_TERMS, never a new route file.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageSections } from "@/components/page-sections";
import {
  GLOSSARY_TERMS,
  glossaryPageSpec,
  type GlossaryTerm,
} from "@/lib/glossary";
import { breadcrumb, definedTerm, faqPage } from "@/lib/jsonld";
import { JsonLdScript } from "@/lib/jsonld-script";
import { buildMetadata, SITE_URL } from "@/lib/metadata";

type Params = { params: Promise<{ slug: string }> };

function findTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}

export function generateStaticParams() {
  return GLOSSARY_TERMS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params;
  const term = findTerm(slug);
  if (!term) notFound();
  return buildMetadata(glossaryPageSpec(term).meta);
}

export default async function GlossaryTermPage(props: Params) {
  const { slug } = await props.params;
  const term = findTerm(slug);
  if (!term) notFound();

  const spec = glossaryPageSpec(term);
  const breadcrumbLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Glossary", path: "/glossary" },
    { name: term.term, path: `/glossary/${term.slug}` },
  ]);
  const definedTermLd = definedTerm({
    name: term.term,
    description: term.definition,
    url: `${SITE_URL}/glossary/${term.slug}`,
    inDefinedTermSet: `${SITE_URL}/glossary`,
  });
  const faqLd = faqPage(term.faq);

  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      <JsonLdScript data={definedTermLd} />
      <JsonLdScript data={faqLd} />
      <PageSections sections={spec.sections} />
    </>
  );
}
