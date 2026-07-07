import { describe, expect, test } from "bun:test";
import { detectTractionChanges, parseRepos } from "./github.ts";
import type { RepoStat } from "./github.ts";

describe("parseRepos", () => {
  test("picks the fields we need off a real-shaped GitHub repo list", () => {
    const raw = [
      {
        name: "caisson",
        stargazers_count: 10,
        forks_count: 2,
        open_issues_count: 3,
        extra: "ignored",
      },
    ];
    expect(parseRepos(raw)).toEqual([
      { name: "caisson", stars: 10, forks: 2, openIssues: 3 },
    ]);
  });

  test("returns [] on an unexpected shape rather than throwing", () => {
    expect(parseRepos({ not: "an array" })).toEqual([]);
  });
});

const repo: RepoStat = { name: "caisson", stars: 10, forks: 2, openIssues: 3 };

describe("detectTractionChanges", () => {
  test("first observation records a baseline, no finding", () => {
    const { findings, nextState } = detectTractionChanges([repo], {});
    expect(findings).toEqual([]);
    expect(nextState["github:caisson:stars"]).toBe("10");
  });

  test("a star or fork gain against stored state emits a traction finding", () => {
    const { findings } = detectTractionChanges([repo], {
      "github:caisson:stars": "5",
      "github:caisson:forks": "1",
      "github:caisson:issues": "3",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.payload).toMatchObject({ starDelta: 5, forkDelta: 1 });
  });

  test("no gain (even with a change in open issues alone) emits nothing", () => {
    const { findings } = detectTractionChanges([repo], {
      "github:caisson:stars": "10",
      "github:caisson:forks": "2",
      "github:caisson:issues": "1",
    });
    expect(findings).toEqual([]);
  });
});
