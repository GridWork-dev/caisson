import { describe, expect, test } from "bun:test";

import type { PageSection } from "./page-sections";

// Type-level tests for the PageSection union (renderer SPEC §2, glossary SPEC Task 1). These are
// compile-time assertions riding on `bunx tsc --noEmit` — a broken union or a loosened `never`
// arm shows up as a tsc failure here, not a silent runtime pass.
describe("PageSection union — type-level", () => {
  test("a mixed-kind array including custom compiles", () => {
    const sections: PageSection[] = [
      {
        kind: "hero",
        eyebrow: "Glossary",
        title: "WORM audit log",
        lede: "A write-once, read-many log an attacker cannot edit or delete.",
      },
      { kind: "section", eyebrow: "Definition", lede: "..." },
      {
        kind: "featureGrid",
        items: [
          { title: "Append-only", body: "Every row chains to the last." },
        ],
      },
      {
        kind: "controlMap",
        items: [
          {
            title: "Record-keeping",
            body: "Every inference hashes into an append-only chain.",
            code: "await verifyChain(db)",
          },
        ],
      },
      { kind: "codeArtifact", code: "await verifyChain(db)" },
      {
        kind: "comparison",
        columns: ["Base"],
        rows: [{ label: "Audit log", cells: [true] }],
      },
      {
        kind: "faq",
        items: [{ question: "What is a WORM log?", answer: "..." }],
      },
      {
        kind: "cta",
        title: "Ship it",
        primary: { label: "Get Compliance", href: "/marketplace" },
      },
      { kind: "custom", node: null },
    ];
    expect(sections).toHaveLength(9);
    expect(new Set(sections.map((s) => s.kind)).size).toBe(9);
  });

  test("an unmapped kind is rejected by the type system (the union stays closed)", () => {
    // @ts-expect-error - "bogus" is not a declared PageSection kind. The union being closed here
    // is exactly what makes the renderer's `never` default arm (Task 2) a real compile-time gate
    // rather than a comment.
    const bad: PageSection = { kind: "bogus" };
    expect(bad).toBeDefined();
  });

  test("omitting a kind from an exhaustive switch is a compile error — the never-arm mechanism <PageSections> relies on", () => {
    function coversAllKinds(kind: PageSection["kind"]): string {
      switch (kind) {
        case "hero":
        case "section":
        case "featureGrid":
        case "controlMap":
        case "codeArtifact":
        case "comparison":
        case "faq":
          return kind;
        // "cta" and "custom" deliberately left unhandled to prove the mechanism below.
        default: {
          // @ts-expect-error - `kind` narrows to "cta" | "custom" here, not `never`, because two
          // kinds are unhandled above — this is the exact compile error the real <PageSections>
          // switch's `never` default arm depends on to catch a missing render case.
          const exhaustive: never = kind;
          return exhaustive;
        }
      }
    }
    expect(typeof coversAllKinds).toBe("function");
  });
});
