"use client";

// The tool-exec module's poke (ADR-0378 lock 2) — a live, deterministic run of the REAL
// @caisson-sh/tool-exec default-deny gate against a caller-typed argv. The hand-ported mirror
// (tool-exec-logic.ts) is retired per ADR-0396: `createToolProposer` is the same implementation
// `createToolExec.propose()` runs, imported through the package's browser-safe `./browser` entry
// (the spawn seam and its node:child_process import stay behind `.`). Only the sample allowlist and
// the render-shaping below are poke-local. Nothing here fetches, persists, measures the visitor, or
// spawns a process — a browser has no process to spawn, and this gate is the phase-1 boundary
// `propose()` itself stops at.
import { useId, useMemo, useState } from "react";
import { z } from "zod";
import type { ZodType } from "zod";
import { Button, Radio, StatusChip } from "@caisson-sh/ui/components";
import { createToolProposer } from "@caisson-sh/tool-exec/browser";
import type {
  CommandSpec,
  ProposedToolCall,
} from "@caisson-sh/tool-exec/browser";
import { isCaissonError } from "@caisson-sh/kernel";
import type { CaissonError } from "@caisson-sh/kernel";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./tool-exec-poke.module.css";

// ---- Sample allowlist (poke-local illustration — the package itself ships none; an empty/absent
// allowlist refuses every call, fail-closed, per tool-exec's `ToolExecConfig.allowlist`) ---------

/** Loose schema — any argv of strings passes, same pattern as the package's own `echoSpec` fixture. */
const ECHO_ARGS: ZodType<string[]> = z.array(z.string());

/** Strict schema — exactly `["status", "--short"]`, demonstrating the schema actually gating. */
const GIT_STATUS_ARGS: ZodType<string[]> = z
  .array(z.string())
  .length(2)
  .refine((a) => a[0] === "status" && a[1] === "--short", {
    message: 'must be exactly ["status", "--short"]',
  });

export const SAMPLE_ALLOWLIST: readonly CommandSpec[] = [
  { name: "echo", command: "/bin/echo", argsSchema: ECHO_ARGS },
  { name: "git-status", command: "/usr/bin/git", argsSchema: GIT_STATUS_ARGS },
];

/** The allowed sample: a registered command with argv its schema accepts. */
export const SAMPLE_ALLOWED = { name: "echo", argv: "hello world" } as const;

/**
 * The denied sample: verbatim from the package's own test suite (tool-exec.test.ts, "an
 * unregistered command name is refused") — `run("rm", ["-rf", "/"])` throws `NotFoundError`.
 */
export const SAMPLE_DENIED = { name: "rm", argv: "-rf /" } as const;

/** The real gate, built once over the sample allowlist. */
const GATE = createToolProposer(SAMPLE_ALLOWLIST);

export type SampleVerdict =
  | { readonly outcome: "proposed"; readonly proposed: ProposedToolCall }
  | { readonly outcome: "denied"; readonly error: CaissonError };

/**
 * Poke-local presentation shaping ONLY: the gate throws (that is its contract), and a React render
 * wants a value. Every code/status/message/detail rendered below comes off the real kernel error.
 */
export function proposeSample(
  name: string,
  args: readonly string[],
): SampleVerdict {
  try {
    return { outcome: "proposed", proposed: GATE.propose(name, [...args]) };
  } catch (err) {
    if (isCaissonError(err)) return { outcome: "denied", error: err };
    throw err;
  }
}

const COMMAND_NOTE: Record<string, string> = {
  echo: "registered, argsSchema z.array(z.string()), any argv of strings passes",
  "git-status":
    'registered, argsSchema accepts only exactly ["status", "--short"]',
  rm: "not registered, denied before any schema runs",
};

function parseArgv(text: string): string[] {
  return text.split(/\s+/).filter((a) => a.length > 0);
}

/** One `parseStrict` issue, rendered without re-declaring the shape kernel already owns. */
function issueLine(issue: unknown): string {
  const rec = issue as Record<string, unknown>;
  const path = typeof rec["path"] === "string" ? rec["path"] : "";
  const message = typeof rec["message"] === "string" ? rec["message"] : "";
  return `${path || "(argv)"}: ${message}`;
}

/** Renders the argv as the real execFile call would see it: a command plus an array, never a string. */
function ArgvPreview({
  command,
  args,
}: {
  command: string;
  args: readonly string[];
}) {
  return (
    <p className={styles.argv}>
      execFile(<span className={styles.argvCommand}>&quot;{command}&quot;</span>
      {", ["}
      {args.map((a, i) => (
        <span key={i}>
          {i > 0 ? ", " : ""}
          <span className={styles.argvArg}>&quot;{a}&quot;</span>
        </span>
      ))}
      {"])"}
    </p>
  );
}

export default function ToolExecPoke() {
  const uid = useId();
  const [name, setName] = useState<string>(SAMPLE_ALLOWED.name);
  const [argvText, setArgvText] = useState<string>(SAMPLE_ALLOWED.argv);

  const commandNames = useMemo(
    () => [
      ...SAMPLE_ALLOWLIST.map((s: CommandSpec) => s.name),
      SAMPLE_DENIED.name,
    ],
    [],
  );

  const args = useMemo(() => parseArgv(argvText), [argvText]);
  const verdict = useMemo(() => proposeSample(name, args), [name, args]);
  const issues =
    verdict.outcome === "denied" &&
    Array.isArray(verdict.error.details?.["issues"])
      ? (verdict.error.details["issues"] as readonly unknown[])
      : undefined;

  return (
    <PokeShell
      label="@caisson-sh/tool-exec"
      title="Propose a command. The allowlist decides before anything can spawn."
    >
      <div className={styles.layout}>
        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>Command name</legend>
          <div className={styles.optionRow}>
            {commandNames.map((n) => (
              <Radio
                key={n}
                name={`${uid}-name`}
                label={n}
                checked={name === n}
                onChange={() => setName(n)}
                className={styles.option}
              />
            ))}
          </div>
          <p className={styles.note}>{COMMAND_NOTE[name] ?? ""}</p>
        </fieldset>

        <label className={styles.field} htmlFor={`${uid}-argv`}>
          Argv (space-separated, sample text, edit it)
        </label>
        <input
          id={`${uid}-argv`}
          className={styles.input}
          type="text"
          value={argvText}
          onChange={(e) => setArgvText(e.target.value)}
          spellCheck={false}
        />

        <div className={styles.buttonRow}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setName(SAMPLE_ALLOWED.name);
              setArgvText(SAMPLE_ALLOWED.argv);
            }}
          >
            Load allowed sample
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setName(SAMPLE_DENIED.name);
              setArgvText(SAMPLE_DENIED.argv);
            }}
          >
            Load denied sample
          </Button>
        </div>

        <div className={styles.outputPanel}>
          {verdict.outcome === "proposed" ? (
            <>
              <Verdict state="ok">
                propose() validated this argv. Nothing spawns here, the same
                phase-1 boundary the real gate stops at before execute().
              </Verdict>
              <ArgvPreview
                command={verdict.proposed.command}
                args={verdict.proposed.args}
              />
              <dl className={styles.register}>
                <dt>name</dt>
                <dd>{verdict.proposed.name}</dd>
                <dt>command</dt>
                <dd>{verdict.proposed.command}</dd>
                <dt>args</dt>
                <dd>[{verdict.proposed.args.join(", ")}]</dd>
              </dl>
            </>
          ) : (
            <>
              <Verdict state="fail">
                {verdict.error.code === "not_found"
                  ? `Denied before validation ever ran. "${name}" isn't in the allowlist (default-deny, ADR-0153).`
                  : "Denied. This argv failed the command's Zod-strict schema before anything could spawn."}
              </Verdict>
              <dl className={styles.register}>
                <dt>code</dt>
                <dd>{verdict.error.code}</dd>
                <dt>httpStatus</dt>
                <dd>{verdict.error.httpStatus}</dd>
                <dt>message</dt>
                <dd>{verdict.error.message}</dd>
                {issues !== undefined ? (
                  <>
                    <dt>issues</dt>
                    <dd>{issues.map(issueLine).join("; ")}</dd>
                  </>
                ) : (
                  <>
                    <dt>details.command</dt>
                    <dd>{String(verdict.error.details?.["command"] ?? "")}</dd>
                  </>
                )}
              </dl>
            </>
          )}
        </div>

        <div className={styles.chipsRow}>
          {SAMPLE_ALLOWLIST.map((s: CommandSpec) => (
            <StatusChip
              key={s.name}
              label={s.name}
              tone={
                verdict.outcome === "proposed" &&
                verdict.proposed.name === s.name
                  ? "accent"
                  : "muted"
              }
            />
          ))}
          <StatusChip
            label={SAMPLE_DENIED.name}
            tone={
              verdict.outcome === "denied" && verdict.error.code === "not_found"
                ? "accent"
                : "muted"
            }
          />
        </div>
        <p className={styles.note}>
          The allowlist is caller-supplied and shown here for illustration only,
          the package itself ships none: an empty or absent allowlist refuses
          every call, fail-closed.
        </p>
      </div>
    </PokeShell>
  );
}
