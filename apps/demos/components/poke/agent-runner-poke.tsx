"use client";

// The agent-runner module's poke (ADR-0378 lock 2) -- a live, deterministic run of the REAL
// @caisson-sh/agent-runner env scrubber against a fixed sample parent env. The hand-ported mirror
// (agent-runner-logic.ts) is retired per ADR-0396: buildEngineEnv, CLAUDE_CLI_PROFILE and
// PASSTHROUGH_KEYS come from the package's browser-safe `./browser` entry, which is the same
// src/engine-env.ts module the runner itself imports (the detached spawn and the on-disk run
// registry stay behind `.`). Only the sample parent env and the added-key ordering below are
// poke-local. Nothing here fetches, persists, or measures the visitor.
import { useId, useMemo, useState } from "react";
import { Checkbox, DetailList, StatusChip } from "@caisson-sh/ui/components";
import type { DetailItem } from "@caisson-sh/ui/components";
import {
  CLAUDE_CLI_PROFILE,
  PASSTHROUGH_KEYS,
  buildEngineEnv,
} from "@caisson-sh/agent-runner/browser";
import type { ProviderConfig } from "@caisson-sh/agent-runner/browser";
import { isCaissonError } from "@caisson-sh/kernel";
import type { CaissonError } from "@caisson-sh/kernel";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./agent-runner-poke.module.css";

// A fixed sample parent env (packages/agent-runner/src/leak-guard.test.ts POLLUTED uses the same
// shape of canary). Values are made up for this demo and prefixed SAMPLE_ where they impersonate a
// credential -- PATH/LANG/etc. carry no secret, so they are left as ordinary-looking shell values.
export const SAMPLE_PARENT_ENV: Record<string, string> = {
  PATH: "/usr/bin:/bin",
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
  LC_CTYPE: "en_US.UTF-8",
  TERM: "xterm-256color",
  TZ: "America/New_York",
  TMPDIR: "/tmp",
  HOME: "/home/SAMPLE_operator",
  USER: "SAMPLE_operator",
  GITHUB_TOKEN: "SAMPLE_ghp_9f8e7d6c5b4a",
  OPENROUTER_API_KEY: "SAMPLE_sk-or-4d1c8b",
  DATABASE_URL: "postgresql://user:SAMPLE_pass@db/prod",
};

const PASSTHROUGH_SET = new Set<string>(PASSTHROUGH_KEYS);
const PASSTHROUGH_SAMPLE_KEYS = Object.keys(SAMPLE_PARENT_ENV).filter((k) =>
  PASSTHROUGH_SET.has(k),
);
const OTHER_SAMPLE_KEYS = Object.keys(SAMPLE_PARENT_ENV).filter(
  (k) => !PASSTHROUGH_SET.has(k),
);

// Fixed sample spawn parameters -- not secrets, but not real either. authKey is clearly labeled.
const SAMPLE_AUTH_KEY = "SAMPLE_sk-ant-oat01-00000000";
export const SAMPLE_BASE_URL = "https://api.anthropic.com";
// the exact attack the real leak-guard test uses
export const MALICIOUS_BASE_URL = "javascript:alert(1)";
const SAMPLE_HOME = "/var/agent-runner-runs/SAMPLE-run/home";
const SAMPLE_CONFIG_DIR = "/var/agent-runner-runs/SAMPLE-run/home/config";

/**
 * Poke-local presentation composition: the keys buildEngineEnv ADDS beyond a surviving passthrough
 * key, in the order it sets them, so the two output panels can be split. The package has no such
 * export -- this reads the same provider fields the scrub does, and the poke test pins it against
 * the real output so a drift in either direction fails.
 */
export function addedKeys(provider: ProviderConfig): string[] {
  const keys = ["HOME", provider.baseUrlEnv, provider.authEnv];
  if (provider.configDirEnv !== undefined) keys.push(provider.configDirEnv);
  if (provider.modelEnv !== undefined) keys.push(provider.modelEnv);
  keys.push(
    "DISABLE_AUTOUPDATER",
    "DISABLE_TELEMETRY",
    "DISABLE_ERROR_REPORTING",
  );
  return keys;
}

const ADDED_KEYS = new Set(addedKeys(CLAUDE_CLI_PROFILE));

export type ScrubResult =
  | { readonly ok: true; readonly env: Record<string, string> }
  | { readonly ok: false; readonly error: CaissonError };

/**
 * Poke-local presentation shaping ONLY: the scrub throws (that is its fail-closed contract), and a
 * React render wants a value. Every code/status/message/detail rendered below is the real kernel
 * ValidationError's.
 */
export function scrubSample(
  parentEnv: Readonly<Record<string, string>>,
  baseUrl: string,
): ScrubResult {
  try {
    return {
      ok: true,
      env: buildEngineEnv(parentEnv, {
        provider: CLAUDE_CLI_PROFILE,
        authKey: SAMPLE_AUTH_KEY,
        baseUrl,
        home: SAMPLE_HOME,
        configDir: SAMPLE_CONFIG_DIR,
      }),
    };
  } catch (err) {
    if (isCaissonError(err)) return { ok: false, error: err };
    throw err;
  }
}

export default function AgentRunnerPoke() {
  const uid = useId();
  const [present, setPresent] = useState<Set<string>>(
    () => new Set(Object.keys(SAMPLE_PARENT_ENV)),
  );
  const [tamperBaseUrl, setTamperBaseUrl] = useState(false);

  const toggle = (key: string) => {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parentEnv = useMemo(() => {
    const env: Record<string, string> = {};
    for (const key of present) env[key] = SAMPLE_PARENT_ENV[key]!;
    return env;
  }, [present]);

  const result = useMemo(
    () =>
      scrubSample(
        parentEnv,
        tamperBaseUrl ? MALICIOUS_BASE_URL : SAMPLE_BASE_URL,
      ),
    [parentEnv, tamperBaseUrl],
  );

  const toDetailItems = (entries: [string, string][]): DetailItem[] =>
    entries.map(([k, v]) => ({ term: k, description: v, mono: true }));

  const survivedItems: DetailItem[] = result.ok
    ? toDetailItems(
        Object.entries(result.env).filter(([k]) => !ADDED_KEYS.has(k)),
      )
    : [];
  const addedItems: DetailItem[] = result.ok
    ? toDetailItems(
        Object.entries(result.env).filter(([k]) => ADDED_KEYS.has(k)),
      )
    : [];
  const errorItems: DetailItem[] = result.ok
    ? []
    : [
        { term: "code", description: result.error.code, mono: true },
        {
          term: "httpStatus",
          description: String(result.error.httpStatus),
          mono: true,
        },
        ...(result.error.details
          ? [
              {
                term: "details.protocol",
                description: String(result.error.details["protocol"]),
                mono: true,
              },
            ]
          : []),
      ];

  const presentPassthroughCount = PASSTHROUGH_SAMPLE_KEYS.filter((k) =>
    present.has(k),
  ).length;

  return (
    <PokeShell
      label="@caisson-sh/agent-runner"
      title="Toggle a parent env key. Watch it survive the scrub, or never show up."
    >
      <div className={styles.layout}>
        <p className={styles.note}>
          buildEngineEnv() builds the child process env from scratch -- it never
          spreads the parent. Only PASSTHROUGH_KEYS members it finds by name
          survive; everything else in the sample parent env below is simply
          never read, whether it looks like a secret or not.
        </p>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Sample parent env -- PASSTHROUGH_KEYS members (toggle to remove)
          </legend>
          <div className={styles.optionRow}>
            {PASSTHROUGH_SAMPLE_KEYS.map((key) => (
              <Checkbox
                key={key}
                label={`${key}="${SAMPLE_PARENT_ENV[key]}"`}
                checked={present.has(key)}
                onChange={() => toggle(key)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Sample parent env -- everything else (scrubbed regardless)
          </legend>
          <div className={styles.optionRow}>
            {OTHER_SAMPLE_KEYS.map((key) => (
              <Checkbox
                key={key}
                label={`${key}="${SAMPLE_PARENT_ENV[key]}"`}
                checked={present.has(key)}
                onChange={() => toggle(key)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <div className={styles.option}>
          <Checkbox
            label="Tamper: point the CLI's baseUrl at javascript:alert(1) instead of https://api.anthropic.com"
            checked={tamperBaseUrl}
            onChange={(e) => setTamperBaseUrl(e.target.checked)}
          />
        </div>

        <div className={styles.outputPanel}>
          {result.ok ? (
            <>
              <Verdict state="ok">
                {presentPassthroughCount} of {PASSTHROUGH_SAMPLE_KEYS.length}{" "}
                present passthrough key
                {presentPassthroughCount === 1 ? "" : "s"} survived. The other{" "}
                {OTHER_SAMPLE_KEYS.length} sample keys never left the parent,
                present or not.
              </Verdict>
              <p className={styles.subLabel} id={`${uid}-survived`}>
                Survived from the parent (passthrough)
              </p>
              {survivedItems.length > 0 ? (
                <DetailList
                  items={survivedItems}
                  layout="columns"
                  aria-labelledby={`${uid}-survived`}
                />
              ) : (
                <p className={styles.note}>
                  None -- every passthrough key is toggled off.
                </p>
              )}
              <p className={styles.subLabel} id={`${uid}-added`}>
                Added by the runner (isolation, provider routing, hygiene)
              </p>
              <DetailList
                items={addedItems}
                layout="columns"
                aria-labelledby={`${uid}-added`}
              />
            </>
          ) : (
            <>
              <Verdict state="fail">
                Blocked before spawn: {result.error.message}
              </Verdict>
              <DetailList items={errorItems} layout="columns" />
            </>
          )}
        </div>

        <div className={styles.chipsRow}>
          {PASSTHROUGH_KEYS.map((key) => (
            <StatusChip
              key={key}
              label={key}
              tone={present.has(key) ? "accent" : "muted"}
            />
          ))}
        </div>
        <p className={styles.note}>
          PASSTHROUGH_KEYS, the full allowlist. Every one of these seven names
          is in the sample parent env above; the rest of PASSTHROUGH_KEYS would
          behave identically if present.
        </p>
      </div>
    </PokeShell>
  );
}
