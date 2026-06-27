import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Static export → pre-render the Orama index to a static JSON; search runs in the browser.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
