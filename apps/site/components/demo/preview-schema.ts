import { z } from "zod";

// The T2↔T4 preview-artifact contract, extracted from preview-data.ts so BOTH sides can hold it:
// the server-only reader (preview-data.ts) parses against it at request time, and
// tools/demo-preview/artifacts.test.ts asserts the COMMITTED preview.json satisfies it — the seam
// guard that keeps the writer (tools/demo-preview/generate.ts) and this reader from drifting apart.
// No "server-only" import here on purpose: the test runs under plain `bun test`.

export const StepSchema = z
  .object({
    label: z.string().max(120),
    command: z.string().max(500),
    output: z.string().max(20_000),
    ok: z.boolean(),
  })
  .strict();

export const PreviewSchema = z
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
