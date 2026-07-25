"use client";

// The tool-exec module's poke (ADR-0378 lock 2, kimi CANDIDATES §B build baseline) — a live,
// deterministic run of the package's default-deny allowlist gate against a caller-typed argv.
// Every function driving this component is the pure mirror in `tool-exec-logic.ts` (see that
// file's header for why the real package isn't imported directly into a client bundle). Nothing
// here fetches, persists, measures the visitor, or spawns a process.
import { useId, useMemo, useState } from "react";
import { Button, Radio, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  SAMPLE_ALLOWED,
  SAMPLE_ALLOWLIST,
  SAMPLE_DENIED,
  proposeToolCall,
} from "./tool-exec-logic";
import type { CommandSpec } from "./tool-exec-logic";
import styles from "./tool-exec-poke.module.css";

const COMMAND_NOTE: Record<string, string> = {
  echo: "registered, argsSchema z.array(z.string()), any argv of strings passes",
  "git-status":
    'registered, argsSchema accepts only exactly ["status", "--short"]',
  rm: "not registered, denied before any schema runs",
};

function parseArgv(text: string): string[] {
  return text.split(/\s+/).filter((a) => a.length > 0);
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
  const verdict = useMemo(
    () => proposeToolCall(SAMPLE_ALLOWLIST, name, args),
    [name, args],
  );

  return (
    <PokeShell
      label="@caisson/tool-exec"
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
                {verdict.error.code === "validation_error" ? (
                  <>
                    <dt>issues</dt>
                    <dd>
                      {verdict.error.details.issues
                        .map((i) => `${i.path || "(argv)"}: ${i.message}`)
                        .join("; ")}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>details.command</dt>
                    <dd>{verdict.error.details.command}</dd>
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
