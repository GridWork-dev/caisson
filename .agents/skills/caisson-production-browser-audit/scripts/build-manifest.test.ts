import { describe, expect, test } from "bun:test";

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildManifest,
  validateManifest,
  writeManifest,
} from "./build-manifest";

describe("browser audit manifest", () => {
  test("sorts the three rings and their surfaces deterministically", () => {
    const manifest = buildManifest("audit-2026-07-10");

    expect(manifest.runId).toBe("audit-2026-07-10");
    expect([
      ...new Set(manifest.surfaces.map((surface) => surface.ring)),
    ]).toEqual(["public", "buyer", "admin"]);
    expect(manifest.surfaces.map((surface) => surface.url)).toContain("/");
    expect(manifest.surfaces.map((surface) => surface.url)).toContain(
      "/dashboard",
    );
    expect(manifest.surfaces.map((surface) => surface.url)).toContain("/ops");
  });

  test("rejects duplicate routes", () => {
    const manifest = buildManifest("audit-2026-07-10");
    const duplicate = manifest.surfaces[0];
    expect(duplicate).toBeDefined();
    expect(() =>
      validateManifest({
        ...manifest,
        surfaces: [...manifest.surfaces, duplicate!],
      }),
    ).toThrow("duplicate surface");
  });

  test("rejects a route that is not assigned to a journey", () => {
    const manifest = buildManifest("audit-2026-07-10");
    expect(() =>
      validateManifest({ ...manifest, journeys: manifest.journeys.slice(1) }),
    ).toThrow("unassigned surface");
  });

  test("rejects a mutation without a compensator", () => {
    const manifest = buildManifest("audit-2026-07-10");
    expect(() =>
      validateManifest({
        ...manifest,
        journeys: manifest.journeys.map((journey, index) =>
          index === 0
            ? {
                ...journey,
                mutation: {
                  owner: "probe-account",
                  precondition: "known state",
                  expectedTransition: "changed state",
                  compensator: "",
                  cleanupAssertion: "restored state",
                  stopCondition: "stop on mismatch",
                },
              }
            : journey,
        ),
      }),
    ).toThrow();
  });

  test("writes the manifest only under the run evidence root", () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "caisson-browser-audit-"));
    const path = writeManifest("run-safe", process.cwd(), outputRoot);

    expect(path).toBe(join(outputRoot, "run-safe", "manifest.json"));
    expect(JSON.parse(readFileSync(path, "utf8")).runId).toBe("run-safe");
  });
});
