import { describe, expect, test } from "bun:test";
import { parseSource } from "./chunk.ts";
import { DocChunkSchema, type DocsSource } from "./types.ts";

const SRC: DocsSource = {
  source: "apps/site/content/docs/base/billing.mdx",
  kind: "docs",
  license: "Apache-2.0",
  fallbackTitle: "billing",
  pkg: "@caisson/billing",
  raw: [
    "---",
    "title: Billing",
    "description: Stripe webhooks behind a port.",
    "---",
    "",
    'import { Callout } from "fumadocs-ui/components/callout";',
    "",
    "Lead paragraph describing the package.",
    "",
    "## The contract",
    "",
    "Webhooks are verified against the raw request body with a timing-safe HMAC compare.",
    "",
    "## Another section",
    "",
    "More body text here.",
    "",
  ].join("\n"),
};

describe("parseSource", () => {
  test("captures frontmatter title + description", () => {
    const { page } = parseSource(SRC);
    expect(page.title).toBe("Billing");
    expect(page.description).toBe("Stripe webhooks behind a port.");
    expect(page.pkg).toBe("@caisson/billing");
  });

  test("splits into lead + heading sections, heading preserved in chunk text", () => {
    const { chunks } = parseSource(SRC);
    expect(chunks.length).toBe(3);
    expect(chunks[0]?.section).toBe("");
    expect(chunks[0]?.text).toBe("Lead paragraph describing the package.");
    expect(chunks[1]?.section).toBe("The contract");
    expect(chunks[1]?.text).toContain("## The contract");
    expect(chunks[2]?.section).toBe("Another section");
  });

  test("strips MDX import/JSX noise", () => {
    const { chunks } = parseSource(SRC);
    for (const c of chunks) {
      expect(c.text).not.toContain("import {");
      expect(c.text).not.toContain("<Callout");
    }
  });

  test("every chunk validates against the strict schema", () => {
    const { chunks } = parseSource(SRC);
    for (const c of chunks) expect(() => DocChunkSchema.parse(c)).not.toThrow();
  });

  test("is deterministic — same input yields identical chunks + ids", () => {
    const a = parseSource(SRC);
    const b = parseSource(SRC);
    expect(b.chunks).toEqual(a.chunks);
    expect(b.page).toEqual(a.page);
  });

  test("falls back to fallbackTitle + first sentence when no frontmatter", () => {
    const { page } = parseSource({
      source: "packages/kernel/README.md",
      kind: "readme",
      license: "Apache-2.0",
      fallbackTitle: "@caisson/kernel",
      raw: "# Kernel\n\nTyped config and the error model. More detail follows.\n",
    });
    expect(page.title).toBe("@caisson/kernel"); // no frontmatter ⇒ fallbackTitle (the package name)
    expect(page.description).toBe("Typed config and the error model.");
  });
});
