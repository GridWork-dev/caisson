import { describe, expect, test } from "bun:test";

import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./validate-rollback.ts").catch(() => undefined);
const nonprodProject = "example-nonprod-12345";
const prodProject = "example-prod-12345";
const region = "us-east4";
const revision = "caisson-site-00042-abc";

describe("validateRollback", () => {
  test("accepts an allowlisted service only after the exact revision is described", () => {
    expect(subject?.validateRollback).toBeFunction();
    if (!subject) return;

    const calls: string[][] = [];
    expect(
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "production",
        nonprodProject,
        prodProject,
        region,
        (arguments_) => {
          calls.push(arguments_);
          return revision;
        },
      ),
    ).toEqual({ project: prodProject });
    expect(calls[0]).toEqual([
      "run",
      "revisions",
      "describe",
      revision,
      "--project",
      prodProject,
      "--region",
      region,
      "--format=value(metadata.name)",
    ]);
  });

  test("rejects unowned services and malformed or nonexistent revisions", () => {
    expect(subject?.validateRollback).toBeFunction();
    if (!subject) return;

    const never = () => {
      throw new Error("gcloud must not run");
    };
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "other-site",
        revision,
        "production",
        nonprodProject,
        prodProject,
        region,
        never,
      ),
    ).toThrow("unknown service other-site");
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        "other-site-00042-abc",
        "production",
        nonprodProject,
        prodProject,
        region,
        never,
      ),
    ).toThrow("REVISION must belong to caisson-site");
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "staging",
        nonprodProject,
        prodProject,
        region,
        (arguments_) => {
          expect(arguments_).toContain(nonprodProject);
          return "different-revision";
        },
      ),
    ).toThrow(`revision ${revision} does not exist`);
  });

  test("rejects invalid environment, project, and region inputs", () => {
    expect(subject?.validateRollback).toBeFunction();
    if (!subject) return;

    const exists = () => revision;
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "preview",
        nonprodProject,
        prodProject,
        region,
        exists,
      ),
    ).toThrow("ENVIRONMENT must be staging or production");
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "production",
        "bad",
        prodProject,
        region,
        exists,
      ),
    ).toThrow("GCP_NONPROD_PROJECT is invalid");
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "production",
        nonprodProject,
        "bad",
        region,
        exists,
      ),
    ).toThrow("GCP_PROD_PROJECT is invalid");
    expect(() =>
      subject.validateRollback(
        manifestFixture,
        "caisson-site",
        revision,
        "production",
        nonprodProject,
        prodProject,
        "bad",
        exists,
      ),
    ).toThrow("GCP_REGION is invalid");
  });
});
