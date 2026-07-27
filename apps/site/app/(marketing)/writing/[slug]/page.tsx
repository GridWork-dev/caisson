// One dynamic spoke renders every WRITING_PIECES record through the shared PageSpec renderer.
// Adding a piece is adding one registry record, never a route file.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageSections } from "@/components/page-sections";
import { breadcrumb, techArticle } from "@/lib/jsonld";
import { JsonLdScript } from "@/lib/jsonld-script";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  findWritingPiece,
  WRITING_PIECES,
  writingPageSpec,
} from "@/lib/writing";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return WRITING_PIECES.map((piece) => ({ slug: piece.slug }));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params;
  const piece = findWritingPiece(slug);
  if (!piece) notFound();
  return buildMetadata({
    ...writingPageSpec(piece).meta,
    publishedOn: piece.publishedOn,
  });
}

export default async function WritingPiecePage(props: Params) {
  const { slug } = await props.params;
  const piece = findWritingPiece(slug);
  if (!piece) notFound();

  const spec = writingPageSpec(piece);
  const path = `/writing/${piece.slug}`;
  const articleLd = techArticle({
    headline: piece.title,
    description: piece.dek,
    url: `${SITE_URL}${path}`,
    datePublished: piece.publishedOn,
  });
  const breadcrumbLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Writing", path: "/writing" },
    { name: piece.title, path },
  ]);

  return (
    <>
      <JsonLdScript data={articleLd} />
      <JsonLdScript data={breadcrumbLd} />
      <PageSections sections={spec.sections} />
    </>
  );
}
