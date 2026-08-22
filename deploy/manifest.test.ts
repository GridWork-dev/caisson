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
});
