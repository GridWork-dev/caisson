// Offline eval baseline for the PII detection/redaction path — extends the @caisson-sh/ai-evals
// cassette-replay harness (see that package's README/AGENTS) to a fully deterministic, non-model
// surface. There is no LLM call anywhere in `detectPii`/`redactPii` (regex + Luhn only), so there is
// nothing to replay from a cassette — the eval's `task` runs the REAL detector fresh on every
// invocation, and a regression in that logic is what this baseline catches. Two small datasets
// mirror the harness's own two-case-file convention (`compliance-answer` + `injection-defense`):
// `expected` is a `.strict()` Zod shape per grader, so a "must match" case and a "must not contain"
// case can't share one dataset with two scorers pointed at the same `expected` object.
//
//   - pii-catches   (regexGrader)    — PII that MUST get redacted: a multi-kind case (one shot at
//                                      all four detector classes), a code-fenced email (users paste
//                                      logs/snippets into a compliance assistant), and per-class
//                                      format variants that pin each detector's shape coverage
//                                      (parenthesized/country-code phones, dash-separated and
//                                      15-digit Luhn-valid cards, plus-tagged subdomain email).
//   - pii-preserves (injectionGrader, repurposed as a generic "output must not contain" check) —
//                                      shapes that must NOT get redacted: clean prose (no false
//                                      positive), Luhn-invalid card-shaped numbers (pins the Luhn
//                                      branch), a TLD-less email shape, and two KNOWN GAPS pinned as
//                                      current behavior, not guarantees (Unicode-homoglyph email,
//                                      separator-less 10-digit phone) — closing either later is a
//                                      deliberate baseline update, not a silent regression.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  defineEval,
  gateAgainstBaseline,
  injectionGrader,
  parseDataset,
  regexGrader,
  type EvalCase,
} from "@caisson-sh/ai-evals";
import { redactPii } from "./pii.ts";

const FIXTURES = join(import.meta.dir, "..", "__evals__");
const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const catchesDataset = parseDataset(readJson("pii-catches.case.json"));
const preservesDataset = parseDataset(readJson("pii-preserves.case.json"));

interface TextInput {
  readonly text: string;
}

/** The real detector, run fresh every eval invocation — never a recorded/replayed output. */
const redactTask = (caseItem: EvalCase): string => {
  const { text } = caseItem.input as TextInput;
  return redactPii(text, "mask").redacted;
};

describe("PII eval baseline (offline, deterministic — no model, no network)", () => {
  test("committed evals match the committed baseline (BLESS unset)", async () => {
    const catches = await defineEval({
      name: catchesDataset.eval,
      promptVersionId: catchesDataset.promptVersionId,
      ...(catchesDataset.promptRef !== undefined
        ? { promptRef: catchesDataset.promptRef }
        : {}),
      threshold: catchesDataset.threshold,
      cases: catchesDataset.cases,
      task: redactTask,
      scorers: { "catches-pii": regexGrader() },
    });
    expect(catches.passed).toBe(true);
    expect(catches.score).toBe(1);

    const preserves = await defineEval({
      name: preservesDataset.eval,
      promptVersionId: preservesDataset.promptVersionId,
      ...(preservesDataset.promptRef !== undefined
        ? { promptRef: preservesDataset.promptRef }
        : {}),
      threshold: preservesDataset.threshold,
      cases: preservesDataset.cases,
      task: redactTask,
      scorers: { "preserves-clean": injectionGrader() },
    });
    expect(preserves.passed).toBe(true);
    expect(preserves.score).toBe(1);

    const gate = gateAgainstBaseline(join(FIXTURES, "baseline.json"), [
      catches,
      preserves,
    ]);
    expect(gate.passed).toBe(true);
    expect(gate.blessed).toBe(false);
  });
});
