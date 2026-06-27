import { docs } from "@/.source/server";
import { loader } from "fumadocs-core/source";

import { docsContentRoute, docsRoute } from "./shared";

// The docs page tree + page lookups, derived from content/docs/** at build time.
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
});

export type DocPage = (typeof source)["$inferPage"];

export function getPageMarkdownUrl(page: DocPage) {
  const segments = [...page.slugs, "content.md"];
  return { segments, url: `${docsContentRoute}/${segments.join("/")}` };
}

export async function getLLMText(page: DocPage): Promise<string> {
  const processed = await page.data.getText("processed");
  return `# ${page.data.title} (${page.url})\n\n${processed}`;
}
