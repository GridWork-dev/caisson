// Golden-first (ADR-0013). `golden.ts` references the `LocalStore` / `hybridSearch` API from
// `./store.ts`, so this file fails to resolve its import until the sqlite-vec + FTS5 + RRF retrieval
// logic lands — proving the fixture precedes the logic. Landing that logic makes it green with
// `BLESS` unset (the committed `src/__golden__/rrf-ranking.json` must match exactly).
import { describe, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { localStoreGolden } from "./golden.ts";

describe("local-store goldens (ADR-0013 golden-first)", () => {
  for (const goldenCase of localStoreGolden.cases) {
    test(`${goldenCase.name} output matches its committed golden`, async () => {
      const produced = await goldenCase.produce(goldenCase.input);
      matchGolden(import.meta.url, goldenCase.name, produced);
    });
  }
});
