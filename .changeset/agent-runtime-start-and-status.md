---
"@caisson/ai-kit": minor
"@caisson/mcp-server": minor
"@caisson/cli": minor
---

You can now start a governed agent run and check its status without writing any code. The
`caisson run start "<prompt>"` command opens a bounded, metered run through your own gateway and
prints the result — including a pause for review if the model wants to use a tool that needs
approval. A matching pair of agent-facing tools, `run_start` and `run_status`, is available from
your buyer MCP server for an AI agent to call directly, gated behind the same licensed entitlement
as the rest of the runtime. Neither surface ever exposes the raw parked-run snapshot; status
reporting only ever shows the run's state and its trajectory.
