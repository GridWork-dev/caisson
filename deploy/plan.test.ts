import { describe, expect, test } from "bun:test";

import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./plan.ts").catch(() => undefined);
const digest = `sha256:${"a".repeat(64)}`;
const migrationDigest = `sha256:${"b".repeat(64)}`;
const registry = "us-east4-docker.pkg.dev/example-project/apps";
const migrationManifest = {
  ...manifestFixture,
  jobs: {
    "caisson-migrate": {
      dockerfile: "deploy/Dockerfile.migrate",
      build_context: ".",
      watched_paths: ["deploy/migrate.ts"],
      runtime: "cloud-run-job" as const,
    },
  },
};

describe("deployment plan allowlist", () => {
  test("constructs immutable image references for reviewed services", () => {
    expect(subject?.createPlan).toBeFunction();
    if (!subject) return;

    expect(
      subject.createPlan(
        manifestFixture,
        { "caisson-site": digest },
        "production",
        registry,
      ),
    ).toEqual({
      services: [
        {
          service: "caisson-site",
          image: `${registry}/caisson-site@${digest}`,
        },
      ],
      migrationJob: "",
      migrationImage: "",
    });
  });

  test("routes the reviewed migration digest to the singleton job", () => {
    expect(subject?.createPlan).toBeFunction();
    if (!subject) return;

    expect(
      subject.createPlan(
        migrationManifest,
        {
          "caisson-site": digest,
          "caisson-migrate": migrationDigest,
        },
        "production",
        registry,
      ),
    ).toEqual({
      services: [
        {
          service: "caisson-site",
          image: `${registry}/caisson-site@${digest}`,
        },
      ],
      migrationJob: "caisson-migrate",
      migrationImage: `${registry}/caisson-migrate@${migrationDigest}`,
    });
  });

  test("rejects unknown service keys", () => {
    expect(subject?.createPlan).toBeFunction();
    if (!subject) return;

    expect(() =>
      subject.createPlan(
        manifestFixture,
        { "other-site": digest },
        "staging",
        registry,
      ),
    ).toThrow("unknown service other-site");
    expect(() =>
      subject.createPlan(
        manifestFixture,
        { constructor: digest },
        "staging",
        registry,
      ),
    ).toThrow("unknown service constructor");
  });

  test("rejects malformed, uppercase, and empty digest maps", () => {
    expect(subject?.createPlan).toBeFunction();
    if (!subject) return;

    expect(() =>
      subject.createPlan(
        manifestFixture,
        { "caisson-site": "sha256:not-a-digest" },
        "staging",
        registry,
      ),
    ).toThrow("invalid digest for caisson-site");
    expect(() =>
      subject.createPlan(
        manifestFixture,
        { "caisson-site": `sha256:${"A".repeat(64)}` },
        "staging",
        registry,
      ),
    ).toThrow("invalid digest for caisson-site");
    expect(() =>
      subject.createPlan(manifestFixture, {}, "staging", registry),
    ).toThrow("DIGESTS must contain at least one service");
  });

  test("rejects malformed JSON, environments, and registries", () => {
    expect(subject?.parseDigests).toBeFunction();
    if (!subject) return;

    expect(() => subject.parseDigests("not json")).toThrow(
      "DIGESTS must be valid JSON",
    );
    expect(() => subject.parseDigests("[]")).toThrow(
      "DIGESTS must be a JSON object",
    );
    expect(() =>
      subject.createPlan(
        manifestFixture,
        { "caisson-site": digest },
        "preview",
        registry,
      ),
    ).toThrow("ENVIRONMENT must be staging or production");
    expect(() =>
      subject.createPlan(
        manifestFixture,
        { "caisson-site": digest },
        "production",
        "docker.io/example",
      ),
    ).toThrow("GCP_REGISTRY must name an Artifact Registry repository");
  });
});
