// RED until the schema + lifecycle logic land (golden-first, ADR-0013). `golden.ts` references the
// to-be-built `runLifecycle` / `parseArtifact` API, so this file fails to resolve its import until
// that logic lands — proving the fixtures precede the logic — then goes green with `BLESS` unset.
import { describe, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { agentKernelGolden } from "./golden.ts";

describe("agent-kernel goldens (ADR-0013 golden-first)", () => {
  for (const goldenCase of agentKernelGolden.cases) {
    test(`${goldenCase.name} output matches its committed golden`, async () => {
      const produced = await goldenCase.produce(goldenCase.input);
      matchGolden(import.meta.url, goldenCase.name, produced);
    });
  }
});
