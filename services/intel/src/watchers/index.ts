// The watcher registry — the one list the scheduler iterates and the CLI resolves a name against.
import { analyticsWatcher } from "./analytics.ts";
import { competitorWatcher } from "./competitor.ts";
import { complianceWatcher } from "./compliance.ts";
import { depDigestWatcher } from "./dep-digest.ts";
import { errorTriageWatcher } from "./error-triage.ts";
import { githubWatcher } from "./github.ts";
import { soc2Watcher } from "./soc2.ts";
import type { Watcher } from "./types.ts";

export const WATCHERS: readonly Watcher[] = [
  complianceWatcher,
  soc2Watcher,
  competitorWatcher,
  githubWatcher,
  analyticsWatcher,
  errorTriageWatcher,
  depDigestWatcher,
];

export function findWatcher(name: string): Watcher | undefined {
  return WATCHERS.find((w) => w.name === name);
}

export function watcherNames(): string[] {
  return WATCHERS.map((w) => w.name);
}
