import type { MDXComponents } from "mdx/types";

import { getMDXComponents } from "@/components/mdx";

// Next.js MDX convention entrypoint — delegates to the fumadocs component merge.
export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return getMDXComponents(components);
}
