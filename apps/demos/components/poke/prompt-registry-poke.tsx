"use client";

// Flagship "Alias mover" poke for @caisson-sh/prompt-registry (ADR-0378 lock 2), driving the REAL
// package. Four immutable version rows on a fixed sample prompt, append-only, never mutated or
// removed. `prod` is the ONE mutable pointer: promote it forward, roll it back, or try pointing it
// at a version that was never minted and watch the write get rejected before it happens.
//
// What is real here, not ported:
//   - every button builds a `name@selector` ref and hands it to the package's own `parsePromptRef`
//     (@caisson-sh/prompt-registry/browser) — the same parser `resolvePrompt` uses server-side, so the
//     three addressing kinds below are the package's, not a restatement of them;
//   - the "current tip" badge is derived by the kernel's own `currentVersions` over the lineage,
//     never stored;
//   - a denied move fails closed with the kernel's real `NotFoundError`, the same class the
//     database-bound `setAlias` throws from its resolve-before-write step.
//
// What stays poke-local: the sample lineage, the move log, and the verdict copy. Those are sample
// data and presentation, not package logic. The database half (registerPrompt / getVersion /
// setAlias, each bound to a tenancy-rls TenantExecutor) is server-only by construction and is not
// on the `./browser` entry at all. Nothing leaves the page.
import { useState } from "react";
import { NotFoundError, currentVersions } from "@caisson-sh/kernel";
import type { VersionRecord } from "@caisson-sh/kernel";
import { parsePromptRef } from "@caisson-sh/prompt-registry/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./prompt-registry-poke.module.css";

const TITLE =
  "Promote the alias pointer, then try moving it somewhere that never shipped.";

/** One immutable, minted prompt version row (sample data shaped like the real `prompt_version`). */
export interface PromptVersionRow extends VersionRecord {
  readonly version: number;
  /** A short human label for what changed at this version (sample content, not a real prompt body). */
  readonly summary: string;
}

/** The sample prompt name every version + the alias below belong to. */
export const SAMPLE_NAME = "soc2-summary";

/** The one alias this sample carries. `name@prod` is the mutable pointer; the rows never move. */
export const SAMPLE_ALIAS = "prod";

/** The fixed append-only lineage: v1 -> v2 -> v3 -> v4, oldest first. Never mutated or removed. */
export const SAMPLE_VERSIONS: readonly PromptVersionRow[] = [
  {
    id: "pv_1",
    supersedesId: null,
    version: 1,
    summary: "Initial system prompt, neutral tone",
  },
  {
    id: "pv_2",
    supersedesId: "pv_1",
    version: 2,
    summary: "Added citation requirement",
  },
  {
    id: "pv_3",
    supersedesId: "pv_2",
    version: 3,
    summary: "Tightened injection-guard wording",
  },
  {
    id: "pv_4",
    supersedesId: "pv_3",
    version: 4,
    summary: "Added SOC2 CC6.1 context clause",
  },
];

/** The `prod` alias starts mid-lineage so both promoting forward and rolling back are reachable. */
export const INITIAL_ALIAS_VERSION_ID = "pv_2";

/** The deny-path control: this version was never minted, so pointing prod here always fails closed. */
export const NEVER_MINTED_VERSION = 9;

function rowById(id: string): PromptVersionRow {
  const row = SAMPLE_VERSIONS.find((v) => v.id === id);
  if (row === undefined) {
    throw new Error(`prompt-registry poke: unknown version id ${id}`);
  }
  return row;
}

/**
 * The lineage tip: the version nothing supersedes. Derived by the kernel's own `currentVersions`
 * over the sample rows — the same call `registerPrompt` and `getCurrentVersion` make against the
 * real table, so "current" is never a stored flag here either.
 */
export function currentTipVersion(): number {
  const tip = currentVersions(SAMPLE_VERSIONS)[0];
  return tip === undefined ? 0 : rowById(tip.id).version;
}

/** Build the `name@selector` ref a move addresses. Every move goes through a real ref string. */
export function promptRefFor(selector: number | string): string {
  return `${SAMPLE_NAME}@${selector}`;
}

export interface RegistryState {
  /** The `prod` alias's current target (a version row id — the only mutable cell in this poke). */
  readonly aliasVersionId: string;
  /** Append-only: every move attempt appends here, newest first. Never rewritten or trimmed. */
  readonly moveLog: readonly MoveLogEntry[];
}

/** One append-only move-log line: every attempt is recorded, whether it moved the pointer or not. */
export interface MoveLogEntry {
  readonly seq: number;
  /** The exact reference the attempt addressed, as the package's parser received it. */
  readonly ref: string;
  readonly fromVersion: number;
  readonly targetVersion: number;
  readonly ok: boolean;
}

export function aliasVersion(state: RegistryState): number {
  return rowById(state.aliasVersionId).version;
}

export function initialState(): RegistryState {
  return { aliasVersionId: INITIAL_ALIAS_VERSION_ID, moveLog: [] };
}

/**
 * Resolve a `name@selector` ref against the fixed sample lineage. The PARSE is the package's real
 * `parsePromptRef` — all three addressing kinds are its, including which selectors read as a
 * version and which as an alias. Only the lookup itself is local: in the real registry it is a
 * tenant-scoped SELECT, and there is no database in a browser tab. Fail-closed either way, with the
 * kernel's real `NotFoundError` and the same 404 the server returns.
 */
export function resolveRef(
  state: RegistryState,
  ref: string,
): PromptVersionRow {
  const parsed = parsePromptRef(ref);
  if (parsed.name !== SAMPLE_NAME) {
    throw new NotFoundError("Prompt not found", { name: parsed.name });
  }
  switch (parsed.kind) {
    case "current": {
      // Same derivation the real `getCurrentVersion` makes: the tip is whatever nothing
      // supersedes, and an empty lineage is a fail-closed 404, not an empty result to check for.
      const tip = currentVersions(SAMPLE_VERSIONS)[0];
      if (tip === undefined) {
        throw new NotFoundError("Prompt not found", { name: parsed.name });
      }
      return rowById(tip.id);
    }
    case "version": {
      const row = SAMPLE_VERSIONS.find((v) => v.version === parsed.version);
      if (row === undefined) {
        throw new NotFoundError("Prompt version not found", {
          name: parsed.name,
          version: parsed.version,
        });
      }
      return row;
    }
    case "alias": {
      if (parsed.alias !== SAMPLE_ALIAS) {
        throw new NotFoundError("Prompt alias not found", {
          name: parsed.name,
          alias: parsed.alias,
        });
      }
      return rowById(state.aliasVersionId);
    }
  }
}

/**
 * Attempt to point `prod` at `targetVersion`. The target is resolved FIRST — the same
 * resolve-before-write ordering `setAlias` uses, so a dangling alias can never be written. The
 * move-log entry ALWAYS appends (an honest audit trail of every attempt, denied or not); the
 * pointer itself only moves on success, and no version row is ever touched either way.
 */
export function moveAlias(
  state: RegistryState,
  targetVersion: number,
): RegistryState {
  const ref = promptRefFor(targetVersion);
  let versionId: string | null = null;
  try {
    versionId = resolveRef(state, ref).id;
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }
  const entry: MoveLogEntry = {
    seq: state.moveLog.length,
    ref,
    fromVersion: aliasVersion(state),
    targetVersion,
    ok: versionId !== null,
  };
  return {
    aliasVersionId: versionId ?? state.aliasVersionId,
    moveLog: [entry, ...state.moveLog],
  };
}

/** The verdict line: computed from the last move attempt, never asserted copy. No em dashes (ADR-0375). */
export function verdictLine(state: RegistryState): {
  state: "ok" | "fail" | "neutral";
  text: string;
} {
  const last = state.moveLog[0];
  const cur = aliasVersion(state);
  if (last === undefined) {
    return {
      state: "neutral",
      text: `prod points at v${cur}. Every version row stays forever, only the pointer moves.`,
    };
  }
  if (!last.ok) {
    return {
      state: "fail",
      text: `Version ${last.targetVersion} was never minted. Dangling alias rejected, prod still points at v${cur}.`,
    };
  }
  return {
    state: "ok",
    text: `prod now points at v${cur}. No version row moved, ${SAMPLE_VERSIONS.length} rows still on file.`,
  };
}

/** The lineage tip is derived, not stored — computed once, it never changes. */
const TIP_VERSION = currentTipVersion();

/** Cap the visible log so the strip stays readable; the full history stays in state regardless. */
const LOG_VISIBLE = 6;

export default function PromptRegistryPoke() {
  const [state, setState] = useState<RegistryState>(() => initialState());

  const prod = aliasVersion(state);
  const line = verdictLine(state);

  function move(targetVersion: number) {
    setState((s) => moveAlias(s, targetVersion));
  }

  function onReset() {
    setState(initialState());
  }

  return (
    <PokeShell label="@caisson-sh/prompt-registry" title={TITLE}>
      <p className={styles.name}>
        <code>{promptRefFor(SAMPLE_ALIAS)}</code>
        <span className={styles.sampleTag}>sample</span>
      </p>

      <ol className={styles.versions}>
        {SAMPLE_VERSIONS.map((v) => {
          const isProd = v.version === prod;
          const isTip = v.version === TIP_VERSION;
          return (
            <li
              key={v.id}
              className={styles.row}
              data-tone={isProd ? "prod" : "plain"}
            >
              <span className={styles.version}>v{v.version}</span>
              <span className={styles.summary}>{v.summary}</span>
              <span className={styles.badges}>
                {isTip ? (
                  <span className={styles.badgeTip}>current tip</span>
                ) : null}
                {isProd ? <span className={styles.badgeProd}>prod</span> : null}
              </span>
              <button
                type="button"
                className={styles.point}
                onClick={() => move(v.version)}
                disabled={isProd}
              >
                Point prod here
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.deny}
          onClick={() => move(NEVER_MINTED_VERSION)}
        >
          Point prod at v{NEVER_MINTED_VERSION} (never minted)
        </button>
        <button type="button" className={styles.reset} onClick={onReset}>
          Reset
        </button>
      </div>

      {state.moveLog.length > 0 ? (
        <ol className={styles.log}>
          {state.moveLog.slice(0, LOG_VISIBLE).map((entry) => (
            <li
              key={entry.seq}
              className={styles.logRow}
              data-tone={entry.ok ? "ok" : "fail"}
            >
              <span className={styles.logSeq}>#{entry.seq}</span>
              <span className={styles.logMove}>
                prod v{entry.fromVersion} <span aria-hidden="true">&rarr;</span>{" "}
                {entry.ref}
              </span>
              <span className={styles.logState}>
                {entry.ok ? "moved" : "denied"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.logEmpty}>
          No moves yet. Every attempt below appends here, moved or denied.
        </p>
      )}

      <Verdict state={line.state}>{line.text}</Verdict>
    </PokeShell>
  );
}
