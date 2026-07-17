import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

// Reads the ONE shared, operator-prebuilt demo-app preview artifact (ADR-0352 preview contract) that
// T4 generates into apps/site/public/demo-preview/ at release time — a real install/build/test/evidence
// transcript of the shared demo app, captured through the normal CI pipeline (never per visitor). This
// is the T2↔T4 seam: T4 writes preview.json matching this schema; if it hasn't landed (or the file is
// absent/malformed) the reader returns null and the page renders a graceful empty state.

const StepSchema = z
  .object({
    label: z.string().max(120),
    command: z.string().max(500),
    output: z.string().max(20_000),
    ok: z.boolean(),
  })
  .strict();

const PreviewSchema = z
  .object({
    generatedAt: z.string().max(40),
    appName: z.string().max(120),
    bundle: z.string().max(120),
    steps: z.array(StepSchema).max(20),
    fileManifest: z
      .array(
        z
          .object({ path: z.string().max(300), bytes: z.number().int() })
          .strict(),
      )
      .max(2000),
  })
  .strict();

export type DemoPreview = z.infer<typeof PreviewSchema>;

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
