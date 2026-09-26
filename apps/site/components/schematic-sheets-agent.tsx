import {
  Boundary,
  ByteStrip,
  Flow,
  HAIRLINE,
  Sheet,
  SNode,
  TitleBlock,
} from "./schematics";
import styles from "./schematics.module.css";

// Agent-runtime blueprint sheets (ADR-0377, executing ADR-0378 lock 1 migrate-all). Same hairline
// blueprint-linework register as FieldCryptoSheet / AuditWormSheet in ./schematics.tsx: every
// name is verbatim from the package it depicts, drawn subsets are declared on-sheet where a
// package exposes more than is drawn, and each sheet carries exactly ONE semantic accent element
// (the Boundary, the gate the sheet is about). These three replace the legacy
// marketplace-diagrams.tsx mechanism diagrams for the same packages (AgentLifecycleFsm,
// RunnerEnvScrub, TrajectoryRunRecord).

// ===== module:agent-kernel — the seven-act lifecycle FSM plus the one governance shape =====
// Names from src/lifecycle.ts + src/governance.ts + src/hooks.ts: ACTS is the seven-act canonical
// order; TRANSITIONS is the legal forward adjacency, with verify -> [sweep, plan] the real
// goal-backward branch (a failed VERIFY reopens PLAN, never a silent skip) and sweep -> [eval,
// ship] the real untagged-phase branch. transition(from, to) throws a ValidationError
// ("Illegal lifecycle transition: ...") on any edge canTransition() rejects. Governance has
// exactly ONE shape, HookResult<C> (allow | deny(reason) | mutate(ctx)), shared by BOTH a
// TransitionGuard (evaluateGuards folds an array of guards, a deny short-circuits fail-closed,
// a mutate threads context, a thrown guard is itself treated as a fail-closed deny) and
// HookDispatcher.dispatch (a handler that throws is isolated and fail-open, it never vetoes; a
// handler that returns deny short-circuits fail-closed, the first veto wins).
export function AgentKernelSheet() {
  const acts = [
    "spec",
    "plan",
    "execute",
    "verify",
    "sweep",
    "eval",
    "ship",
  ] as const;
  const w = 42;
  const step = 44;
  const y = 10;
  const h = 24;
  return (
    <Sheet
      title="agent-kernel: only legal transitions advance the seven-act lifecycle FSM, an illegal edge throws instead of skipping silently, and the same allow, deny, or mutate governance shape gates both transition guards and lifecycle hooks"
      bar="packages/agent-kernel · lifecycle FSM, governance gate · 1 of 2 branch edges drawn"
    >
      {acts.map((act, i) => {
        const x = 8 + i * step;
        return <SNode key={act} x={x} y={y} w={w} h={h} head={act} />;
      })}
      {acts.slice(0, -1).map((act, i) => {
        const x1 = 8 + i * step + w;
        const x2 = 8 + (i + 1) * step;
        return <Flow key={act} x1={x1} y1={y + h / 2} x2={x2} y2={y + h / 2} />;
      })}
      {/* isTerminal(ship) — the FSM's only act with no successor */}
      <circle
        cx={8 + 6 * step + w}
        cy={y + h / 2}
        r={3}
        className={styles.port}
        {...HAIRLINE}
      />
      <text x={332} y={8} className={styles.portLabel} textAnchor="end">
        isTerminal(ship)
      </text>
      {/* the real branch edge: a failed verify reopens plan (goal-backward verification) */}
      <line
        x1={8 + 3 * step + w / 2}
        y1={y + h}
        x2={8 + 3 * step + w / 2}
        y2={44}
        className={styles.flow}
        {...HAIRLINE}
      />
      <line
        x1={8 + 3 * step + w / 2}
        y1={44}
        x2={8 + step + w / 2}
        y2={44}
        className={styles.flow}
        {...HAIRLINE}
      />
      <Flow x1={8 + step + w / 2} y1={44} x2={8 + step + w / 2} y2={y + h} />
      <text x={88} y={54} className={styles.note}>
        verify fails → plan reopens
      </text>
      <text x={8} y={66} className={styles.note}>
        canTransition() gates every edge
      </text>
      <text x={8} y={78} className={styles.noteDanger}>
        illegal edge ⇒ throws, never a silent skip
      </text>
      {/* the ONE accent element: the one governance shape shared by guards and hooks */}
      <Boundary
        x={8}
        y={88}
        w={324}
        h={78}
        label="HookResult: allow, deny(reason), or mutate(ctx), shared by TransitionGuard and HookDispatcher"
      />
      <SNode x={20} y={106} w={88} h={24} head="guard 1" sub="allow" />
      <Flow x1={108} y1={118} x2={120} y2={118} />
      <SNode x={120} y={106} w={100} h={24} head="guard 2" sub="deny(reason)" />
      {/* evaluateGuards() (over TransitionGuard[]) and HookDispatcher.dispatch() (over
          HookHandler[]) are unrelated folds sharing only the HookResult<C> type — a neutral
          divider, not a Flow arrow, marks the break so dispatch() never reads as downstream
          of the guard fold */}
      <line
        x1={226}
        y1={102}
        x2={226}
        y2={134}
        className={styles.dim}
        {...HAIRLINE}
      />
      <SNode
        x={232}
        y={106}
        w={90}
        h={24}
        head="dispatch()"
        sub="handler throws"
      />
      <text x={20} y={140} className={styles.note}>
        guards ↔ dispatch: independent, share only HookResult
      </text>
      <text x={20} y={150} className={styles.note}>
        first deny short-circuits (fail-closed)
      </text>
      <text x={322} y={150} className={styles.note} textAnchor="end">
        throw ⇒ fail-open, never vetoes
      </text>
      <text x={20} y={162} className={styles.note}>
        mutate(ctx) threads context downstream
      </text>
      <TitleBlock x={190} y={168} w={140} text="AGENT-KERNEL · 1/1" />
    </Sheet>
  );
}

// ===== module:agent-runner — the scrubbed-env sandbox spawn =====
// Names from src/agent-runner.ts: buildEngineEnv() builds the child's env FROM SCRATCH, never
// spreading parentEnv — only PASSTHROUGH_KEYS (the fixed non-secret allowlist) plus the target
// provider's own authEnv/baseUrlEnv cross. CLAUDE_CLI_PROFILE names ANTHROPIC_AUTH_TOKEN as the
// authEnv and ships --strict-mcp-config in its argv (no MCP servers reachable from the sandbox).
// spawn() resolves the worktree, mints a runId, and detaches the child with stdio piped straight
// to a `${runId}.jsonl` transcript file (no babysitter process). summarize()'s EDIT_TOOLS set
// (Edit, Write, MultiEdit, NotebookEdit) is what the transcript is later scanned against for the
// touched-file list. The trust boundary is the module's own comment: the child produces a diff in
// its worktree plus a transcript, the caller owns every git/PR/deploy side-effect.
export function AgentRunnerSheet() {
  return (
    <Sheet
      title="agent-runner: buildEngineEnv rebuilds the child process environment from a fixed non-secret allowlist plus only the target provider's own key, never by spreading the parent env, before spawn() detaches the agent CLI into its isolated worktree"
      bar="packages/agent-runner · env scrub, spawn, transcript · 8 of 15 env keys drawn"
    >
      <SNode
        x={8}
        y={12}
        w={92}
        h={22}
        head="parent env"
        sub="holds real secrets"
      />
      <Flow x1={100} y1={23} x2={114} y2={23} />
      {/* the ONE accent element: the env-scrub gate every spawn crosses */}
      <Boundary
        x={114}
        y={8}
        w={210}
        h={62}
        label="buildEngineEnv() · built from scratch"
      />
      <SNode
        x={124}
        y={24}
        w={190}
        h={18}
        head="PASSTHROUGH_KEYS"
        sub="PATH LANG LC_ALL LC_CTYPE TERM TZ TMPDIR"
      />
      <SNode
        x={124}
        y={44}
        w={190}
        h={18}
        head="ANTHROPIC_AUTH_TOKEN"
        sub="the ONE provider key admitted"
      />
      <Flow x1={219} y1={62} x2={219} y2={78} />
      <SNode
        x={139}
        y={78}
        w={160}
        h={22}
        head="spawn()"
        sub="detached, isolated worktree"
      />
      <text x={8} y={84} className={styles.note}>
        binary: claude
      </text>
      <text x={8} y={94} className={styles.note}>
        --strict-mcp-config
      </text>
      <Flow x1={219} y1={100} x2={219} y2={116} />
      <SNode
        x={134}
        y={116}
        w={170}
        h={26}
        head="<runId>.jsonl"
        sub="Edit/Write/MultiEdit/NotebookEdit"
      />
      <text x={8} y={156} className={styles.note}>
        caller owns every git/PR/deploy side-effect
      </text>
      <TitleBlock x={190} y={168} w={140} text="AGENT-RUNNER · 1/1" />
    </Sheet>
  );
}

// ===== module:agent-trajectory — the append-only log + the digest-only payload discipline =====
// Names from src/store.ts + src/schema.ts + src/replay.ts + src/run-state.pg.ts: append(event)
// compares the incoming seq to `expected = log.length` — a match pushes, a byte-identical repeat
// at an already-recorded seq is an idempotent no-op, anything else (a different event at that seq,
// or a seq ahead of expected) throws ConflictError, append-only means no gaps and no rewrites.
// DigestRef ({ digest: sha256 hex, byteLength, encRef? }) is the ONE shape a sensitive body
// (prompt, tool args, tool result, checkpoint state) may take in any payload, never inlined.
// project(events) folds the same log to the same RunProjection every time, sorted by seq first, so
// out-of-order delivery still resolves to one canonical result. RunStateStore's park/approve/deny
// are CAS transitions keyed on (runId, toolCallId), idempotent on a repeat of the same decision;
// the PG impl seals a parked run's opaque resumable state through @caisson-sh/field-crypto's
// encryptField() before it reaches the row.
export function AgentTrajectorySheet() {
  return (
    <Sheet
      title="agent-trajectory: append(event) admits only the next gapless seq for a run, rejects any rewrite or gap, replays through project() to the same projection every time, and every sensitive body crosses only as a sha256 DigestRef"
      bar="packages/agent-trajectory · append-only log, digest refs, CAS park/approve"
    >
      {/* the ONE accent element: the append-only gate every event crosses */}
      <Boundary
        x={8}
        y={10}
        w={324}
        h={60}
        label="append(event): compare seq to expected = log.length"
      />
      <SNode
        x={20}
        y={34}
        w={94}
        h={26}
        head="seq = expected"
        sub="push (append)"
      />
      <SNode
        x={122}
        y={34}
        w={92}
        h={26}
        head="seq < expected"
        sub="same, no-op"
      />
      <SNode x={222} y={34} w={96} h={26} head="mismatch" sub="ConflictError" />
      <text x={8} y={84} className={styles.note}>
        bodies never inlined: DigestRef only
      </text>
      <ByteStrip
        x={8}
        y={90}
        h={20}
        cells={[
          { label: "digest", w: 112, measure: "sha256 hex, 64c" },
          { label: "byteLength", w: 92, measure: "int" },
          { label: "encRef?", w: 84, measure: "opaque, optional" },
        ]}
      />
      <text x={8} y={140} className={styles.note}>
        project(events) replays to the same projection
      </text>
      <text x={8} y={152} className={styles.note}>
        park→approve/deny: CAS, idempotent on repeat
      </text>
      <text x={8} y={164} className={styles.note}>
        parkedState sealed via encryptField() first
      </text>
      <TitleBlock x={190} y={168} w={140} text="AGENT-TRAJECTORY · 1/1" />
    </Sheet>
  );
}
