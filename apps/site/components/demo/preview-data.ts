import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PreviewSchema, type DemoPreview } from "./preview-schema";

// Reads the ONE shared, operator-prebuilt demo-app preview artifact (ADR-0352 preview contract) that
// T4 generates into apps/site/public/demo-preview/ at release time — a real install/build/test/evidence
// transcript of the shared demo app, captured through the normal CI pipeline (never per visitor). This
// is the T2↔T4 seam: T4 writes preview.json matching PreviewSchema (./preview-schema.ts, the shared
// contract module tools/demo-preview/artifacts.test.ts also asserts the committed file against); if it
// hasn't landed (or the file is absent/malformed) the reader returns null and the page renders a
// graceful empty state.

export type { DemoPreview };

/**
 * Load the prebuilt preview, or null if it isn't present/valid.
 *
 * ponytail: fs read relative to process.cwd() (apps/site in dev/build/standalone) — the artifact is a
 * committed static asset under public/, so a request-time fs read is fine and needs no fetch/origin.
 */
export async function loadDemoPreview(): Promise<DemoPreview | null> {
  try {
    const file = path.join(
      process.cwd(),
      "public",
      "demo-preview",
      "preview.json",
    );
    const raw = await readFile(file, "utf8");
    return PreviewSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
