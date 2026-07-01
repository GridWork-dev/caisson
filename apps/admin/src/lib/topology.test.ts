import { describe, expect, test } from "bun:test";

import { buildGraph } from "./architecture-annotations";
import { discoverTopology } from "./topology";

// These assertions encode the CURRENT repo truth: the four present railway.toml services, the registry
// worker, and the two infra constants. They double as the check that repo-root resolution + the manifest
// line-scan actually work — a broken root would find zero nodes and fail loudly.
describe("topology discovery", () => {
  const byId = new Map(discoverTopology().map((n) => [n.id, n]));

  test("discovers present railway services with their healthchecks", () => {
    expect(byId.get("site")).toEqual({
      id: "site",
      label: "site",
      kind: "app",
      healthcheck: "/healthz",
    });
    expect(byId.get("admin")).toEqual({
      id: "admin",
      label: "admin",
      kind: "app",
      healthcheck: "/healthz",
    });
    expect(byId.get("docs")).toEqual({
      id: "docs",
      label: "docs",
      kind: "service",
      healthcheck: "/health",
    });
    expect(byId.get("support-bot")).toEqual({
      id: "support-bot",
      label: "support-bot",
      kind: "service",
      healthcheck: "/health",
    });
  });

  test("discovers the registry worker (wrangler name, no healthcheck)", () => {
    expect(byId.get("registry-worker")).toEqual({
      id: "registry-worker",
      label: "caisson-registry",
      kind: "worker",
    });
  });

  test("adds SigNoz + Postgres infra constants", () => {
    expect(byId.get("postgres")?.kind).toBe("datastore");
    expect(byId.get("signoz")?.kind).toBe("observability");
  });

  test("is resilient to an absent manifest (services/license has none yet)", () => {
    // No services/license/railway.toml -> absent node, never a throw. If a stream ever adds that
    // manifest, this expectation flips (and the license edges below start rendering).
    expect(byId.has("license")).toBe(false);
  });
});

describe("buildGraph merge", () => {
  const g = buildGraph();
  const ids = new Set(g.nodes.map((n) => n.id));

  test("every edge connects two present nodes", () => {
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  test("drops the license edges + orphan Paddle node while license is absent", () => {
    expect(ids.has("license")).toBe(false);
    expect(ids.has("paddle")).toBe(false); // pruned: its only edge referenced the absent license
    expect(g.edges.some((e) => e.source === "license")).toBe(false);
  });

  test("keeps live telemetry edges into SigNoz", () => {
    expect(g.edges.some((e) => e.target === "signoz")).toBe(true);
  });

  test("boundaries list only present, non-empty members", () => {
    expect(g.boundaries.length).toBeGreaterThan(0);
    for (const b of g.boundaries) {
      expect(b.members.length).toBeGreaterThan(0);
      for (const m of b.members) expect(ids.has(m)).toBe(true);
    }
  });
});
