// demo-run generator: the pure bounding helpers (fabricated oversize input) + one real end-to-end
// generateDemo call against the repo's registry index, asserting a genuine watermarked scaffold comes
// back within the contract's byte budget.
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "bun:test";
import { boundFiles, generateDemoRun, truncateUtf8 } from "./run.ts";

// The generator resolves the registry index via CAISSON_REGISTRY_INDEX_PATH (cwd-independent) — point
// it at the repo's canonical index BEFORE the first (cached) generateDemoRun call. run.test.ts is at
// apps/site/lib/demo-run/ → four levels up is the repo root.
beforeAll(() => {
  process.env.CAISSON_REGISTRY_INDEX_PATH = fileURLToPath(
    new URL("../../../../registry/index.json", import.meta.url),
  );
});

describe("bounding", () => {
  test("truncateUtf8 caps at the byte budget without splitting a multibyte char", () => {
    expect(truncateUtf8("hello", 100)).toBe("hello");
    expect(truncateUtf8("hello world", 5)).toBe("hello");
    // "€" is 3 bytes; a 2-byte budget must back off to empty rather than emit a broken char.
    expect(truncateUtf8("€", 2)).toBe("");
    expect(
      Buffer.byteLength(truncateUtf8("a€b€c", 4), "utf8"),
    ).toBeLessThanOrEqual(4);
  });

  test("boundFiles reports true sizes, truncates oversize files, caps the total", () => {
    const big = "x".repeat(500_000);
    const { tree, bounded } = boundFiles([
      { path: "small.ts", content: "ok" },
      { path: "big.ts", content: big },
    ]);
    expect(tree).toEqual([
      { path: "small.ts", bytes: 2 },
      { path: "big.ts", bytes: 500_000 },
    ]);
    expect(bounded["small.ts"]).toBe("ok");
    expect(bounded["big.ts"]!.length).toBeLessThan(big.length);
    expect(bounded["big.ts"]).toContain("truncated");
    // Total kept content (excluding truncation markers) never exceeds the 400KB budget.
    const kept = Object.values(bounded).reduce(
      (n, c) => n + Buffer.byteLength(c, "utf8"),
      0,
    );
    expect(kept).toBeLessThan(420_000); // 400KB budget + a couple of short markers
  });
});

describe("generateDemoRun (real registry)", () => {
  test("returns a real watermarked scaffold within the contract bounds", () => {
    const out = generateDemoRun("my-eval-app");

    // A real file tree with true byte sizes.
    expect(out.tree.length).toBeGreaterThan(5);
    expect(out.tree.every((f) => typeof f.bytes === "number")).toBe(true);

    // Commercial modules are watermarked stubs, never real source.
    const stub = Object.entries(out.files).find(([p]) =>
      p.startsWith("src/demo-stubs/"),
    );
    expect(stub).toBeDefined();
    expect(stub?.[1]).toContain("CAISSON DEMO STUB");
    expect(out.files["DEMO.md"]).toBeDefined();

    // Module summary reflects the full catalog with paid modules present (they become stubs).
    expect(out.moduleSummary.total).toBe(
      out.moduleSummary.oss + out.moduleSummary.paid,
    );
    expect(out.moduleSummary.paid).toBeGreaterThan(0);
    expect(typeof out.generatedInMs).toBe("number");

    // The whole content map stays within the 400KB transport budget.
    const total = Object.values(out.files).reduce(
      (n, c) => n + Buffer.byteLength(c, "utf8"),
      0,
    );
    expect(total).toBeLessThanOrEqual(400_000 + out.tree.length * 200);
  });
});
