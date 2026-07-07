// Per-watcher CLI entrypoint (ADR-0286 §5): `bun run src/cli.ts run <watcher>` drives exactly one
// leg to completion and exits — no scheduler, no long-lived process. This is the seam Claude Code
// Routines / hosted cloud agents use to run a single watcher on their own cadence instead of the
// daemon's internal scheduler.
import { fetchWithTimeout } from "@caisson/kernel";
import { loadConfig } from "./config.ts";
import { runWatcher } from "./scheduler.ts";
import { PostgresStore } from "./store.ts";
import { findWatcher, watcherNames } from "./watchers/index.ts";

// Uses process.stdout.write, not console.log — the repo's no-console rule targets the console
// global specifically; stdout.write is the sanctioned print path everywhere, CLI or not.
function usage(): string {
  return `usage: bun run src/cli.ts run <${watcherNames().join("|")}>\n`;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [cmd, name] = argv;
  if (cmd !== "run" || name === undefined) {
    process.stdout.write(usage());
    return 1;
  }
  const watcher = findWatcher(name);
  if (watcher === undefined) {
    process.stdout.write(`unknown watcher "${name}"\n${usage()}`);
    return 1;
  }

  const config = loadConfig();
  const store = new PostgresStore(config.databaseUrl);
  // Same posture as server.ts: the runtime DSN role is meant to be DML-only
  // (migrations/provision-role.sql) — migrate() issues DDL the CLI must not assume it can run.
  if (config.migrateOnBoot) {
    await store.migrate();
  }
  try {
    const summary = await runWatcher(watcher, config, store, fetchWithTimeout);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary.status === "ok" ? 0 : 1;
  } finally {
    await store.close();
  }
}

if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
