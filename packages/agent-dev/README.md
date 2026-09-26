# @caisson/agent-dev

The Agentic-Dev edition — a governed agent/skill/rule schema, a lifecycle state machine, local
hybrid memory, a sandboxed tool-exec gate, and a multi-harness emitter, composed into one
import. Author agents/skills/rules once in a typed Caisson schema and get a governed
lifecycle, local memory, and per-harness config emit (`.claude/`, Codex `AGENTS.md`, Cursor rules).

## Install

```bash
bun add @caisson/agent-dev
```

Apache-2.0. No license key, no private registry.

## Use

```ts
import { createAgentDevEdition } from "@caisson/agent-dev";

const edition = createAgentDevEdition({
  store: myAuditLifecycleStore, // host-supplied AuditLifecycleStore
  memoryDim: 3, // local hybrid-memory vector width
  tenant: { root: "/var/lib/caisson/tenants", tenantId: "acme" },
});

// Render the curated artifact set into every supported harness shape.
const bundle = edition.render();

// Or write it straight to disk (fail-closed guarded write).
edition.emit("./out");

// The bundled sandboxed tool-exec gate (default-deny until you register commands).
await edition.toolExec.run("git", ["status"]);

edition.close();
```

## Docs

https://caisson.sh/docs
