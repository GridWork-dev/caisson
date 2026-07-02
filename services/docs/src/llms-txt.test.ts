import { describe, expect, test } from "bun:test";
import type { Corpus } from "./corpus.ts";
import { renderLlmsFull, renderLlmsTxt } from "./llms-txt.ts";

const CORPUS: Corpus = {
  pages: [
    {
      source: "apps/site/content/docs/index.mdx",
      title: "Caisson documentation",
      description: "The manual.",
      kind: "docs",
      license: "Apache-2.0",
    },
    {
      source: "apps/site/content/docs/base/billing.mdx",
      title: "Billing",
      description: "Stripe webhooks behind a port",
      kind: "docs",
      license: "Apache-2.0",
      pkg: "@caisson/billing",
    },
    {
      source: "packages/kernel/README.md",
      title: "@caisson/kernel",
      description: "Typed config and the error model.",
      kind: "readme",
      license: "Apache-2.0",
      pkg: "@caisson/kernel",
    },
  ],
  chunks: [
    {
      id: "billing-1",
      source: "apps/site/content/docs/base/billing.mdx",
      title: "Billing",
      section: "The contract",
      kind: "docs",
      license: "Apache-2.0",
      pkg: "@caisson/billing",
      text: "## The contract\n\nWebhooks are verified with a timing-safe HMAC compare.",
    },
  ],
};

describe("renderLlmsTxt", () => {
  const out = renderLlmsTxt(CORPUS, { origin: "https://caisson.sh" });

  test("starts with the H1 and a blockquote summary from the index page", () => {
    expect(out.startsWith("# Caisson\n")).toBe(true);
    expect(out).toContain("> The manual.");
  });

  test("groups pages into H2 sections", () => {
    expect(out).toContain("## Base substrate");
    expect(out).toContain("## Package references");
  });

  test("emits link lines in the exact `- [Title](URL): Description.` format", () => {
    expect(out).toContain(
      "- [Billing](https://caisson.sh/docs/base/billing): Stripe webhooks behind a port.",
    );
    expect(out).toContain(
      "- [@caisson/kernel](https://github.com/caisson-sh/caisson/blob/main/packages/kernel/README.md): Typed config and the error model.",
    );
  });

  test("maps the index page to the docs root URL", () => {
    expect(out).toContain("](https://caisson.sh/docs):");
  });

  test("is deterministic", () => {
    expect(renderLlmsTxt(CORPUS, { origin: "https://caisson.sh" })).toBe(out);
  });
});

describe("renderLlmsFull", () => {
  test("concatenates page bodies with source markers, deterministically", () => {
    const full = renderLlmsFull(CORPUS);
    expect(full).toContain("# Billing");
    expect(full).toContain(
      "<!-- source: apps/site/content/docs/base/billing.mdx -->",
    );
    expect(full).toContain("timing-safe HMAC");
    expect(renderLlmsFull(CORPUS)).toBe(full);
  });
});
