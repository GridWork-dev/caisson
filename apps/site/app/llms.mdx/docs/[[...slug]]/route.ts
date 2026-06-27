import { notFound } from "next/navigation";

import { getLLMText, getPageMarkdownUrl, source } from "@/lib/source";

// Per-page raw markdown (the "copy markdown" / content.md endpoint). Static under export.
export const dynamic = "force-static";

type Params = { params: Promise<{ slug?: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  // Strip the appended "content.md" segment to recover the page slug.
  const page = source.getPage(slug?.slice(0, -1));
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return source
    .getPages()
    .map((page) => ({ slug: getPageMarkdownUrl(page).segments }));
}
