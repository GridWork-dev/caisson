# @caisson/mcp-server — setup-coach fallback (coach-by-docs)

The MCP server ships an **agent-assisted setup coach**: four secrets-safe tools that walk an
`ai-kit` user from "no AI config" to a validated `forge.config`. When you have **no MCP agent**
wired (no Claude Code / no MCP client), this document is the manual fallback: the same flow, done
by hand.

## The hard rule (applies to the agent AND the human)

**Never put a secret in the config, in a tool argument, or in this repo.** The coach writes
env-var **NAMES** and a `.env.example` (`NAME=` with empty values) only. Real API keys live in a
gitignored `.env` — set by you, read by the runtime, never by the coach. A coach tool that is ever
handed a key value rejects it (`strictObject` → `ValidationError`); do the same by hand.

## The four tools (and the manual equivalent)

| Tool                 | Does                                                                                                                                | By hand                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `propose_ai_config`  | Turns desired AI lanes (`{name, provider, model, baseUrl?}`) into a validated `forge.config` + the key NAMES to set.                | Write `forge.config.json`: a `defaultLane` + a `lanes` map of `{ provider, model, apiKeyEnv, baseUrl? }`. Providers: `openai`, `anthropic`, `google`, `openrouter`, `local`. |
| `inspect_env`        | Reports which key NAMES are **set** — presence (boolean) only, never the value.                                                     | `printenv NAME` per key NAME; record set / unset. Do **not** paste values anywhere.                                                                                          |
| `write_forge_config` | **Approval-gated.** Without `approve: true` returns a preview; with it, persists `forge.config.json` + `.env.example` (NAMES only). | Save the two files yourself; fill the real values only in a gitignored `.env`.                                                                                               |
| `validate_setup`     | Verdict: config parses **and** every referenced key NAME is present. Fail-closed.                                                   | Re-check each `apiKeyEnv` is set in your shell; the lane is ready only when all are present.                                                                                 |

## Default key NAMES (BYOK, ADR-0011)

`openai → OPENAI_API_KEY` · `anthropic → ANTHROPIC_API_KEY` · `google → GOOGLE_API_KEY` ·
`openrouter → OPENROUTER_API_KEY` · `local → LOCAL_AI_API_KEY`. Override per lane with `apiKeyEnv`.

## Scope

**AI-provider lanes only.** Database and deploy coaching are out of scope here — that's the
`create-caisson` generator's job, not this coach. The coach never runs a shell or subprocess;
persistence is an injected port.
