import { isAbsolute, normalize, sep } from "node:path";

import { z } from "zod";

const replaySchema = z
  .object({
    cleanSession: z.boolean(),
    attempts: z.number().int().positive(),
    reproduced: z.boolean(),
  })
  .strict();

const findingSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1).optional(),
    category: z.enum([
      "design",
      "behavior",
      "accessibility",
      "performance",
      "content",
      "security-boundary",
    ]),
    severity: z.enum(["P0", "P1", "P2", "P3"]),
    confidence: z.enum(["low", "medium", "high"]),
    ring: z.enum(["public", "buyer", "admin"]),
    journey: z.string().trim().min(1),
    url: z.string().url(),
    viewport: z.string().regex(/^\d+x\d+$/),
    theme: z.enum(["light", "dark", "system"]),
    authState: z.enum(["public", "probe", "operator", "blocked"]),
    steps: z.array(z.string().trim().min(1)).min(1),
    observed: z.string().trim().min(1),
    expected: z.string().trim().min(1),
    evidence: z.array(z.string().trim().min(1)).min(1),
    ruleSource: z.string().trim().min(1),
    replay: replaySchema,
  })
  .strict();

const runSchema = z
  .object({
    advisory: z.literal(true).optional(),
    runId: z.string().trim().min(1),
    rootDir: z.string().trim().min(1),
    classes: z
      .record(z.enum(["new", "unchanged", "regressed", "closed"]))
      .optional(),
    findings: z.array(findingSchema),
  })
  .strict();

function safeEvidencePath(path: string): boolean {
  if (isAbsolute(path) || path.includes("\0")) return false;
  const normalized = normalize(path);
  return normalized !== ".." && !normalized.startsWith(`..${sep}`);
}

export function validateRun(input: unknown) {
  const run = runSchema.parse(input);
  for (const finding of run.findings) {
    for (const path of finding.evidence) {
      if (!safeEvidencePath(path))
        throw new Error(`unsafe evidence path: ${path}`);
    }
    if (
      (finding.severity === "P0" || finding.severity === "P1") &&
      (!finding.replay.cleanSession || finding.replay.attempts < 1)
    ) {
      throw new Error(`${finding.id} requires clean-session replay`);
    }
    if (finding.category === "design" && finding.ruleSource.trim() === "") {
      throw new Error(`${finding.id} requires a cited design rule`);
    }
  }
  return run;
}
