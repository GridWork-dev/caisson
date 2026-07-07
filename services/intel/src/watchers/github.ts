// GitHub traction watcher: stars / forks / open-issue deltas for the org's public repos via the
// public REST API (token-optional — a token only raises the rate limit). Baseline-then-change per
// repo; a finding fires when a repo gains stars or forks since the last check.
import { z } from "zod";
import { dedupKey } from "../finding.ts";
import { fetchJson } from "../http.ts";
import type { Fetcher } from "../http.ts";
import type { Config } from "../config.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

export interface RepoStat {
  name: string;
  stars: number;
  forks: number;
  openIssues: number;
}

// Field-picking (non-strict): the GitHub repo object has ~100 fields; we read four.
const ReposResponse = z.array(
  z.object({
    name: z.string(),
    stargazers_count: z.number(),
    forks_count: z.number(),
    open_issues_count: z.number(),
  }),
);

export function parseRepos(raw: unknown): RepoStat[] {
  const parsed = ReposResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.map((r) => ({
    name: r.name,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
  }));
}

export function repoStateKeys(repos: readonly RepoStat[]): string[] {
  return repos.flatMap((r) => [
    `github:${r.name}:stars`,
    `github:${r.name}:forks`,
    `github:${r.name}:issues`,
  ]);
}

export function detectTractionChanges(
  repos: readonly RepoStat[],
  prev: Record<string, string>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const findings: Finding[] = [];
  const nextState: Record<string, string> = {};
  for (const repo of repos) {
    const sKey = `github:${repo.name}:stars`;
    const fKey = `github:${repo.name}:forks`;
    const iKey = `github:${repo.name}:issues`;
    const prevStars = prev[sKey];
    const hadBaseline = prevStars !== undefined;
    const starDelta = hadBaseline ? repo.stars - Number(prevStars) : 0;
    const forkDelta = hadBaseline ? repo.forks - Number(prev[fKey] ?? "0") : 0;
    const issueDelta = hadBaseline
      ? repo.openIssues - Number(prev[iKey] ?? "0")
      : 0;
    if (hadBaseline && (starDelta > 0 || forkDelta > 0)) {
      findings.push({
        source: "github",
        kind: "traction",
        severity: "info",
        title: `${repo.name}: +${String(starDelta)} stars, +${String(forkDelta)} forks`,
        body: `${repo.name} gained ${String(starDelta)} stars and ${String(forkDelta)} forks (open issues ${issueDelta >= 0 ? "+" : ""}${String(issueDelta)}) since the last check.`,
        dedupKey: dedupKey(
          "github",
          repo.name,
          `${String(repo.stars)}-${String(repo.forks)}`,
        ),
        payload: {
          repo: repo.name,
          stars: repo.stars,
          forks: repo.forks,
          openIssues: repo.openIssues,
          starDelta,
          forkDelta,
          issueDelta,
        },
      });
    }
    nextState[sKey] = String(repo.stars);
    nextState[fKey] = String(repo.forks);
    nextState[iKey] = String(repo.openIssues);
  }
  return { findings, nextState };
}

async function fetchRepos(
  config: Config,
  fetchImpl: Fetcher,
): Promise<RepoStat[]> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "caisson-intel",
    "x-github-api-version": "2022-11-28",
  };
  if (config.githubToken !== undefined)
    headers.authorization = `Bearer ${config.githubToken}`;
  const raw = await fetchJson<unknown>(
    fetchImpl,
    `https://api.github.com/orgs/${config.githubOrg}/repos?per_page=100&type=public`,
    { headers },
  );
  return parseRepos(raw);
}

export const githubWatcher: Watcher = {
  name: "github",
  cadenceMs: (config) => config.cadenceGithubMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    let repos: RepoStat[];
    try {
      repos = await fetchRepos(ctx.config, ctx.fetchImpl);
    } catch (err) {
      ctx.logger.warn("github repos fetch failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
    if (repos.length === 0) return [];
    const prev = await ctx.store.getWatchState(repoStateKeys(repos));
    const { findings, nextState } = detectTractionChanges(repos, prev);
    await ctx.store.setWatchState(nextState);
    return findings;
  },
};
