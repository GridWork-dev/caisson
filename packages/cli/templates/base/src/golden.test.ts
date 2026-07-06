import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// Golden-file regression: every committed `__golden__/*.json`
// baseline must parse and be a non-empty object. As you add your installed modules' fixtures,
// they are covered here automatically. Run `BLESS=1 bun test` to re-bless after a reviewed change.
const goldenDir = join(import.meta.dir, "__golden__");

describe("golden baselines", () => {
  const fixtures = readdirSync(goldenDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const name of fixtures) {
    test(`${name} is a valid baseline`, async () => {
      const data = (await Bun.file(join(goldenDir, name)).json()) as Record<
        string,
        unknown
      >;
      expect(data).toBeDefined();
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
  }
});
