import { describe, expect, test } from "bun:test";

import { readManifest } from "./manifest.ts";
import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./service-inputs.ts").catch(() => undefined);

test("serviceInputs returns only reviewed manifest build paths", () => {
  expect(subject?.serviceInputs).toBeFunction();
  if (!subject) return;

  expect(subject.serviceInputs(manifestFixture, "caisson-site")).toEqual({
    dockerfile: "apps/site/Dockerfile",
    buildContext: ".",
  });
  expect(() => subject.serviceInputs(manifestFixture, "other-site")).toThrow(
    "unknown service other-site",
  );
});

describe("migration build inputs", () => {
  test("resolves the reviewed singleton job Dockerfile", async () => {
    expect(subject?.serviceInputs).toBeFunction();
    if (!subject) return;

    expect(
      subject.serviceInputs(await readManifest(), "caisson-migrate"),
    ).toEqual({
      dockerfile: "deploy/Dockerfile.migrate",
      buildContext: ".",
    });
  });
});
