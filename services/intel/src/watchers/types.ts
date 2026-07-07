// The watcher contract. Every leg is a `Watcher`: a name, a cadence (read from config), and a
// `run` that does its own tier-1 detection (reading/writing its watch_state via the store) and
// returns the findings it detected. Persisting those findings, the optional LLM enrichment, and
// the run ledger are the scheduler's job — a watcher only detects.
import type { Config } from "../config.ts";
import type { Finding } from "../finding.ts";
import type { Fetcher } from "../http.ts";
import type { Logger } from "../logger.ts";
import type { Store } from "../store.ts";

export interface WatcherCtx {
  config: Config;
  store: Store;
  /** Injectable so tests never touch the network; defaults to `fetchWithTimeout` in production. */
  fetchImpl: Fetcher;
  /** Injectable clock (epoch ms). */
  now: () => number;
  logger: Logger;
}

export interface Watcher {
  name: string;
  cadenceMs(config: Config): number;
  run(ctx: WatcherCtx): Promise<Finding[]>;
}
