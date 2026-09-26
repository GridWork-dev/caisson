// Loud-staleness guard for the framework/next generator template's @caisson/* pins (W1 sandbox
// finding L-C4): the version-pr consume bumps workspace packages, then refreshes the generator
// template pins.
// Without that refresh a hardcoded pin silently drifts until a generated project's `bun install`
// fails on an unsatisfiable range. Reading real workspace versions makes an omitted or broken
// refresh fail THIS test in the same change that bumps the package.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const TEMPLATE_PKG = join(
  import.meta.dir,
  "../templates/framework/next/package.json",
);

describe("framework/next template @caisson pins track the workspace versions", () => {
  test("every @caisson/* dependency pins caret-exact to the real package version", async () => {
    const parsed = JSON.parse(await Bun.file(TEMPLATE_PKG).text()) as {
      dependencies?: Record<string, string>;
    };
    const caissonDeps = Object.entries(parsed.dependencies ?? {}).filter(
      ([name]) => name.startsWith("@caisson/"),
    );
    expect(caissonDeps.length).toBeGreaterThan(0);

    const expected: Record<string, string> = {};
    const actual: Record<string, string> = {};
    for (const [name, range] of caissonDeps) {
      const slug = name.slice("@caisson/".length);
      const real = JSON.parse(
        await Bun.file(
          join(import.meta.dir, `../../${slug}/package.json`),
        ).text(),
      ) as { version: string };
      expected[name] = `^${real.version}`;
      actual[name] = range;
    }
    // One object comparison so a failure lists EVERY stale pin, not just the first.
    expect(actual).toEqual(expected);
  });
});
