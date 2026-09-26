// `caisson describe --json` is deterministic and reads the same committed manifest the MCP tools
// serve. Asserts against loadBaseManifest() directly (the manifest IS the golden — a separate
// snapshot would just drift when the generator replaces the fixture).
import { describe, expect, test } from "bun:test";
import { loadBaseManifest } from "@caisson-sh/ds-manifest";
import { describeCommand } from "./describe.ts";

const manifest = loadBaseManifest();

describe("describeCommand", () => {
  test("describe --json prints the full manifest", () => {
    expect(JSON.parse(describeCommand(["--json"], { manifest }))).toEqual(
      manifest,
    );
  });

  test("describe <name> --json prints one component (case-insensitive)", () => {
    const out = JSON.parse(describeCommand(["button", "--json"], { manifest }));
    expect(out).toEqual(manifest.components.find((c) => c.name === "Button"));
  });

  test("output is deterministic across calls", () => {
    expect(describeCommand(["--json"], { manifest })).toBe(
      describeCommand(["--json"], { manifest }),
    );
  });

  test("missing --json fails closed", () => {
    expect(() => describeCommand(["button"], { manifest })).toThrow(/--json/);
  });

  test("an unknown component fails closed", () => {
    expect(() => describeCommand(["Nope", "--json"], { manifest })).toThrow(
      /unknown component/,
    );
  });

  test("an unknown flag fails closed", () => {
    expect(() => describeCommand(["--nope"], { manifest })).toThrow(
      /unknown argument/,
    );
  });
});
