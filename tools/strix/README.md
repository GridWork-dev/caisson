# tools/strix

On-demand agentic pentest of Caisson with [Strix](https://github.com/usestrix/strix). Full runbook +
findings: [`docs/security/strix-pentest.md`](../../docs/security/strix-pentest.md).

## Quick start

```bash
uv tool install strix-agent     # once
./apply-patches.sh              # once, and after any `uv tool upgrade` (idempotent)

./run-strix-zai.sh              # GLM-5.2 (Coding Plan) — cheapest; needs ZAI_API_KEY in ~/.gridwork/env
./run-strix-chatgpt.sh          # ChatGPT sub via a localhost codex bridge — see script header
```

Both runs are **read-only** (`STRIX_READONLY=1`), full-depth (`deep`), TUI, and target the source
tree + live site origin + `license` + `docs` APIs. Output → `~/lab/caisson-strix-runs/strix_runs/<run>/`.

| File                   | What                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `_common.sh`           | shared: env, clean-tree build, live targets, read-only, instruction                            |
| `run-strix-zai.sh`     | z.ai GLM-5.2 engine                                                                            |
| `run-strix-chatgpt.sh` | ChatGPT-subscription engine (localhost bridge)                                                 |
| `apply-patches.sh`     | re-applies the 3 installed-package patches (Exa web_search + read-only + null-usage tolerance) |

Stop a run: `Ctrl-C` in the TUI, or `pkill -f 'strix -t'`. Partial findings are saved as it goes.
