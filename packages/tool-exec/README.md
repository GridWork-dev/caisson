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
