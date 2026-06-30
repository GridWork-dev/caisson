import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Pre-render the Orama index to a static JSON at build time; search runs in the browser. Still
// valid under `output: 'standalone'` (ADR-0114) — `force-static` is a per-route directive, not
// tied to the app's overall output mode.
export const dynamic = "force-static";

export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
