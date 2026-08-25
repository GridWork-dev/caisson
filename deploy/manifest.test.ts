import { describe, expect, test } from "bun:test";

import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./manifest.ts").catch(() => undefined);

describe("deployment manifest boundary", () => {
  test("accepts the IAM-only demos service with no public hostname", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject) return;

    const parsed = subject.parseManifest(manifestFixture);
    expect(parsed.services["caisson-demos"]?.hostnames).toEqual([]);
  });

  test("rejects unknown fields and repository path escapes", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject) return;

    expect(() =>
      subject.parseManifest({ ...manifestFixture, unexpected: true }),
    ).toThrow();
    expect(() =>
      subject.parseManifest({
        ...manifestFixture,
        services: {
          ...manifestFixture.services,
          "caisson-site": {
            ...manifestFixture.services["caisson-site"],
            dockerfile: "../Dockerfile",
          },
        },
      }),
    ).toThrow("inside the repository");
  });

  test("rejects unsafe service keys and multiline workflow outputs", () => {
    expect(subject?.parseManifest).toBeFunction();
    expect(subject?.output).toBeFunction();
    if (!subject) return;

    expect(() =>
      subject.parseManifest({
        ...manifestFixture,
        services: {
          "../caisson-site": manifestFixture.services["caisson-site"],
        },
      }),
    ).toThrow();
    expect(() => subject.output("matrix", "[]\nforged=true")).toThrow(
      "output matrix must be one line",
    );
    expect(() => subject.output("matrix", "[]\rforged=true")).toThrow(
      "output matrix must be one line",
    );
  });
});

// The origin-gate fields the fleet projector emits (gridwork-infra render-app-manifests.ts).
// They are NAMES, never values — the fleet manifest is a names-only surface. Optional by
// necessity: the projector spreads each key only when the service's manifest row declares it,
// and caisson-demos deliberately declares none (IAM-only behind the site proxy, no public
// hostname, outside the origin gate). Required fields here would reject the demos projection.
describe("origin-gate env var name fields", () => {
  test("accepts a service carrying all three origin_secret names", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject?.parseManifest) return;
    const withGate = structuredClone(manifestFixture);
    Object.assign(withGate.services["caisson-site"] ?? {}, {
      origin_secret_mode: "ORIGIN_SECRET_MODE",
      origin_secret_current: "ORIGIN_SECRET",
      origin_secret_next: "ORIGIN_SECRET_NEXT",
    });
    const parsed = subject.parseManifest(withGate);
    expect(parsed.services["caisson-site"]?.origin_secret_mode).toBe(
      "ORIGIN_SECRET_MODE",
    );
    expect(parsed.services["caisson-site"]?.origin_secret_next).toBe(
      "ORIGIN_SECRET_NEXT",
    );
  });

  test("accepts a service that declares only the current/next pair, no mode", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject?.parseManifest) return;
    const partial = structuredClone(manifestFixture);
    Object.assign(partial.services["caisson-site"] ?? {}, {
      origin_secret_current: "ORIGIN_SECRET",
      origin_secret_next: "ORIGIN_SECRET_NEXT",
    });
    const parsed = subject.parseManifest(partial);
    expect(parsed.services["caisson-site"]?.origin_secret_mode).toBeUndefined();
  });

  test("still accepts a service declaring none of them (the demos shape)", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject?.parseManifest) return;
    const parsed = subject.parseManifest(manifestFixture);
    expect(
      parsed.services["caisson-site"]?.origin_secret_current,
    ).toBeUndefined();
  });

  // A NAME, not a value. Anything that isn't an uppercase env-var identifier is rejected, so a
  // secret payload or a shell-injection string can never ride in through this field.
  test("rejects anything that is not an uppercase env var name", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject?.parseManifest) return;
    for (const bad of [
      "lowercase_name",
      "HAS SPACE",
      "SEMI;COLON",
      "$(id)",
      "1LEADING_DIGIT",
      "",
      "WITH-HYPHEN",
    ]) {
      const attempt = structuredClone(manifestFixture);
      Object.assign(attempt.services["caisson-site"] ?? {}, {
        origin_secret_current: bad,
      });
      expect(() => subject.parseManifest(attempt)).toThrow();
    }
  });

  // Regression guard for a live projector gap found 2026-08-25: gridwork-infra's current main
  // emits NO `jobs` key for caisson, and `jobs` is required here. Keeping it required is
  // deliberate — it fails LOUDLY rather than let a re-render silently drop the migration job.
  test("rejects a manifest with no jobs key at all", () => {
    expect(subject?.parseManifest).toBeFunction();
    if (!subject?.parseManifest) return;
    const noJobs: Partial<typeof manifestFixture> =
      structuredClone(manifestFixture);
    delete noJobs.jobs;
    expect(() => subject.parseManifest(noJobs)).toThrow();
  });
});
