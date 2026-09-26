import { test, expect, describe } from "bun:test";

import { GET } from "./route";
import { BASE_PACKAGES } from "@/lib/base-substrate";
import { WRITING_PIECES } from "@/lib/writing";

// llms.txt is the surface an answer engine quotes verbatim, so a claim here propagates further
// than the same claim in marketing copy. These pin the two things that must stay true: the
// licensing line matches the package SOT, and nothing here points at a purchase path or a route
// the static site no longer serves.

const body = await (await GET()).text();

describe("llms.txt", () => {
  test("has exactly one H1", () => {
    expect(body.match(/^# /gm)?.length).toBe(1);
    expect(body.startsWith("# Caisson")).toBeTrue();
  });

  test("states the base licensing with the count from the package SOT", () => {
    expect(body).toContain(`${BASE_PACKAGES.length}-package Base substrate`);
    expect(body).toContain("Apache-2.0");
    for (const pkg of BASE_PACKAGES)
      expect(body).toContain(`@caisson-sh/${pkg}`);
  });

  // The parent-organization claim is deliberately ABSENT. Caisson Software LLC and GridWork
  // Digital LLC are separate Georgia LLCs with common ownership at the individual level only,
  // so a subsidiary-shaped claim on a machine-readable surface would be false. Any truthful
  // association predicate arrives as its own reviewed change, not by drifting back in here.
  test("makes no parent-organization claim", () => {
    expect(body).not.toContain("gridworkdigital.com");
    expect(body).not.toContain("GridWork Digital");
  });

  test("links the docs and the marketplace", () => {
    for (const path of [
      "(/docs)",
      "(/docs/getting-started)",
      "(/marketplace)",
    ]) {
      expect(body).toContain(path);
    }
  });

  // The summary line is the string an answer engine reads to CLASSIFY the product. Caisson sells
  // into two categories and was being classified into only one, so both have to survive here —
  // a copy edit that quietly drops the governance half is the regression this catches.
  test("the summary line names both categories the product sells into", () => {
    const summary = body.split("\n").find((l) => l.startsWith("> "));
    expect(summary).toBeDefined();
    for (const phrase of [
      "AI agent governance",
      "AI-generated code",
      "Compliance-grade infrastructure",
    ]) {
      expect({ phrase, inSummary: summary?.includes(phrase) }).toEqual({
        phrase,
        inSummary: true,
      });
    }
  });

  test("every writing page is listed under its own heading", () => {
    // Set equality against the data, not a count: a count passes while one entry silently drops
    // out.
    expect(body).toContain("## Writing");
    for (const p of WRITING_PIECES) {
      expect({
        slug: p.slug,
        linked: body.includes(`(/writing/${p.slug})`),
      }).toEqual({
        slug: p.slug,
        linked: true,
      });
    }
    // Non-vacuous: the loop above passes trivially if the catalog is empty.
    expect(WRITING_PIECES.length).toBeGreaterThan(0);
  });

  test("the AI agent governance section leads with the framing and resolves real modules", () => {
    expect(body).toContain("## AI agent governance");
    // Scoped to the SECTION, not the whole body. `## Modules` lists every module, so a whole-body
    // `includes` is true for these slugs no matter what this section contains — measured: dropping
    // tool-exec from the section left a body-wide assertion fully green.
    const section = body.split("## AI agent governance")[1]?.split("\n## ")[0];
    expect(section).toBeDefined();
    for (const slug of [
      "agent-kernel",
      "agent-runner",
      "tool-exec",
      "agent-trajectory",
      "guardrails",
      "prompt-registry",
      "ai-meter",
    ]) {
      expect({
        slug,
        inSection: section?.includes(`(/marketplace/modules/${slug})`),
      }).toEqual({ slug, inSection: true });
    }
  });

  test("points at no purchase path and no retired route", () => {
    for (const retired of [
      "buy now",
      "(/cart",
      "(/dashboard",
      "(/compare",
      "(/glossary",
      "(/legal/license",
      "(/marketplace/plans",
    ]) {
      expect({
        retired,
        present: body.toLowerCase().includes(retired),
      }).toEqual({
        retired,
        present: false,
      });
    }
    expect(body.match(/\$\d[\d,]*/g)).toBeNull();
  });
});
