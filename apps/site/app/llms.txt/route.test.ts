import { test, expect, describe } from "bun:test";

import { GET } from "./route";
import { BASE_PACKAGES } from "@/lib/base-substrate";

// llms.txt is the surface an answer engine quotes verbatim, so a claim here propagates further
// than the same claim in marketing copy. These pin the two things that must stay true: the
// licensing split matches the package SOT, and nothing here promises a checkout that a visitor
// outside the Caisson team cannot actually reach (/cart is behind Cloudflare Access).

const body = await (await GET()).text();

describe("llms.txt", () => {
  test("has exactly one H1", () => {
    expect(body.match(/^# /gm)?.length).toBe(1);
    expect(body.startsWith("# Caisson")).toBeTrue();
  });

  test("states the open-core split with the count from the package SOT", () => {
    expect(body).toContain(`${BASE_PACKAGES.length}-package Base substrate`);
    expect(body).toContain("Apache-2.0");
    expect(body).toContain("commercial");
    for (const pkg of BASE_PACKAGES) expect(body).toContain(`@caisson/${pkg}`);
  });

  // The parent-organization claim is deliberately ABSENT. Caisson Software LLC and GridWork
  // Digital LLC are separate Georgia LLCs with common ownership at the individual level only,
  // so a subsidiary-shaped claim on a machine-readable surface would be false. Any truthful
  // association predicate arrives as its own reviewed change, not by drifting back in here.
  test("makes no parent-organization claim", () => {
    expect(body).not.toContain("gridworkdigital.com");
    expect(body).not.toContain("GridWork Digital");
  });

  test("links the docs and the licensing pages", () => {
    for (const path of [
      "(/docs)",
      "(/docs/getting-started)",
      "(/legal/license)",
      "(/docs/licensing)",
    ]) {
      expect(body).toContain(path);
    }
  });

  test("promises no purchase path the site cannot honour today", () => {
    // Checkout is team-gated, so any phrasing that reads as "you can buy this right now" is a
    // claim the site cannot back. The honest statement must be present instead.
    for (const overclaim of [
      "check out in a single purchase",
      "buy now",
      "start your free trial",
      "sign up free",
    ]) {
      expect(body.toLowerCase()).not.toContain(overclaim);
    }
    expect(body).toContain("no public self-serve purchase path today");
  });
});
