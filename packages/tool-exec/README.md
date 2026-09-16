# @caisson/tool-exec

Governed tool-call / sandboxed-exec primitive — the security floor Agentic-Dev's tool layer stands
on.

## What it gives you

- **Default-deny command allowlist.** `createToolExec({ allowlist })` — a call names a registered
  logical command; anything unregistered (or an empty allowlist) is refused with a `NotFoundError`
  before anything spawns.
- **`execFile` arg-arrays only.** Never `execSync`/`exec`/`shell: true`, never a concatenated
  command string. Each registered command declares a real executable + a Zod-`.strict()` schema its
  args must satisfy; args are validated with `parseStrict` and the VALIDATED result becomes the
  argv array passed to `execFile` — no user/agent value ever reaches a shell.
- **Structured argument provenance.** Every call returns `{ command, args, exitCode, stdout,
stderr, ok, reason?, at }` — a plain-data audit record (not WORM), with output bounded to 64KB.
- **Injected everything.** `cwd`, `timeoutMs`, the spawn seam (`execFn`), and the clock (`now`) are
  all config — no module-level secrets/constants for endpoints or executables.
- **Optional per-command `env`.** A `CommandSpec` may set `env: { … }` to narrow the spawned
  child's environment. Absent (the default), the child inherits the parent's full environment —
  unchanged from before this option existed. When supplied, the object is used verbatim (never
  merged with `process.env`), so include `PATH` explicitly if the command needs it. A default flip
  to always-narrow would be a separate major version.

## Entry points

- `.` — the full surface, node-capable (`createToolExec` and its `execFile` spawn seam).
- `./browser` — the browser-safe subset: `createToolProposer`, the default-deny lookup + Zod argv
  validation with no spawn attached, so the gate can decide inside a client bundle. It is the same
  implementation `createToolExec` runs. Every name on `./browser` is also on `.`.

## Use

```ts
import { z } from "zod";
import { createToolExec } from "@caisson/tool-exec";

const toolExec = createToolExec({
  allowlist: [
    {
      name: "git-status",
      command: "/usr/bin/git",
      argsSchema: z.array(z.string()).max(1).default(["status"]),
    },
  ],
  cwd: "/repo",
  timeoutMs: 30_000,
});

const result = await toolExec.run("git-status", ["status"], "agent-turn-14");
// result.ok / result.exitCode / result.stdout / result.args (the resolved argv array)
```

A name not on the allowlist, or args that fail the schema, throw before any process spawns.

## Tests

`bun test packages/tool-exec/src` — default-deny (unregistered name, empty allowlist),
schema-rejects-before-exec, a valid call's full provenance record, a non-zero exit captured (not
thrown), and one real `execFile` spawn against `node -e` proving the bounded-output path end to end.

## Two-phase approvals (ADR-0423)

`await tool.propose(name, input, reason)` returns a serializable `ToolApproval`:
random approval ID, canonical digest, policy version, command, validated argv and reason.
Keep the `ToolExec` instance and its record store on the trusted server. Only call
`execute(approval)` after your application authenticates and authorizes the approval
actor; the package does not implement that actor's authentication or approval UI.

Execution atomically consumes the private record, checks the public digest, revalidates
the saved original input with the current schema, and requires the resulting argv to
match what was approved. Command, explicit environment or `policyVersion` rotation
invalidates outstanding records. Environment is never accepted in the public envelope.
The ADR-0420 inherited-environment default remains unchanged when a spec omits `env`.

The default store snapshots input and holds at most 1,000 pending records in memory;
restart loses pending approvals. For persistence, inject `approvalStore` implementing
create-only `put` and atomic get-and-delete `consume`; never expose either to clients.
A digest is an integrity binding to this trusted record, not a signature over arbitrary
client data. Invalid or rotated execution attempts consume the record once its ID is
resolved; request a new proposal after rejection. `createToolProposer` remains a pure
browser-safe validation preview; its `ProposedToolCall` cannot be passed to `execute`.
