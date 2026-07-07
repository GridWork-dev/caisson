import { describe, expect, test } from "bun:test";
import { InMemoryStore } from "./store.ts";
import type { Finding } from "./finding.ts";

const finding: Finding = {
  source: "github",
  kind: "traction",
  severity: "info",
  title: "repo gained stars",
  body: "detail",
  dedupKey: "github:repo:100",
  payload: {},
};

describe("InMemoryStore.upsertFinding", () => {
  test("first observation is new", async () => {
    const store = new InMemoryStore();
    const result = await store.upsertFinding(finding, "run-1");
    expect(result.isNew).toBe(true);
  });

  test("a re-observation with the same dedup key reinforces, not duplicates", async () => {
    const store = new InMemoryStore();
    await store.upsertFinding(finding, "run-1");
    const second = await store.upsertFinding(
      { ...finding, body: "updated detail" },
      "run-2",
    );
    expect(second.isNew).toBe(false);
  });

  test("a different dedup key is a distinct finding", async () => {
    const store = new InMemoryStore();
    await store.upsertFinding(finding, "run-1");
    const other = await store.upsertFinding(
      { ...finding, dedupKey: "github:repo:200" },
      "run-1",
    );
    expect(other.isNew).toBe(true);
  });
});

describe("InMemoryStore watch_state", () => {
  test("round-trips values and only returns requested keys", async () => {
    const store = new InMemoryStore();
    await store.setWatchState({ a: "1", b: "2" });
    expect(await store.getWatchState(["a", "b", "c"])).toEqual({
      a: "1",
      b: "2",
    });
  });

  test("a later set overwrites the prior value", async () => {
    const store = new InMemoryStore();
    await store.setWatchState({ a: "1" });
    await store.setWatchState({ a: "2" });
    expect(await store.getWatchState(["a"])).toEqual({ a: "2" });
  });
});

describe("InMemoryStore incident + rate windows", () => {
  test("openIncidentKeys returns only keys for the given source within the window", async () => {
    let t = 1000;
    const store = new InMemoryStore(() => t);
    await store.upsertFinding(finding, "run-1");
    t = 2000;
    await store.upsertFinding(
      { ...finding, source: "compliance", dedupKey: "compliance:x" },
      "run-1",
    );

    expect(await store.openIncidentKeys("github", 0)).toEqual([
      "github:repo:100",
    ]);
    expect(await store.openIncidentKeys("github", 1500)).toEqual([]);
  });

  test("countNewFindings counts only first_seen within the window", async () => {
    let t = 1000;
    const store = new InMemoryStore(() => t);
    await store.upsertFinding(finding, "run-1");
    t = 5000;
    await store.upsertFinding(
      { ...finding, dedupKey: "github:repo:200" },
      "run-1",
    );

    expect(await store.countNewFindings("github", 0)).toBe(2);
    expect(await store.countNewFindings("github", 4000)).toBe(1);
  });
});
