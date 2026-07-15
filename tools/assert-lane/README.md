# tools/assert-lane — live behavioral probe (operator-run, outside CI)

**What this is:** a hand-run, pre-release behavioral test of the **live, deployed** `services/docs`
retrieval endpoint and the **live** `services/support-bot` RAG pipeline, using Microsoft's
[responsibleai/ASSERT](https://github.com/responsibleai/ASSERT) (`assert-ai` on PyPI, MIT,
Python≥3.11). ASSERT turns a plain-English behavior spec into generated test cases, runs them
against a target, and scores the results with an LLM judge (`systematize -> test_set -> inference
-> judge`).

**What this is NOT:**

- **Not a CI gate.** Nothing here is wired into any GitHub Actions workflow, and nothing here is
  allowed to touch `.github/workflows/`. This lane is invoked by hand, by the operator, before a
  release — never automatically.
- **Not a replacement for the existing offline eval gates.** Those stay exactly as they are:
  - `packages/ai-evals` + `services/support-bot/tests/evals/` — deterministic, code-graded,
    baseline-regression-gated (`uv run pytest -m eval`, `BLESS=1` to re-baseline). No LLM judge, no
    network call, no cost.
  - `services/support-bot/tests/live/test_retrieval_battery_live.py` — a pytest **integrity**
    battery over the real pipeline (asserts the fail-closed _shape_ holds: resolved answers are
    cited + confident, escalations carry a brief). Also live, but asserts structure, not quality,
    and needs no LLM judge.

  **This lane is different in kind, not just location:** it is the only place an LLM _judges_
  whether the live answers are actually good — grounded, cited, injection-resistant, correctly
  escalating — against a generated case set, not a fixed committed dataset. It complements those
  gates; it never substitutes for them, and running it is never a precondition for anything they
  gate.

## Scope note — gw-core Q5 fork

The open gw-core fork on **which model/lane should power generated-case work across the repo's
eval surfaces** (Q5) is **not** re-litigated here. This trial scopes that decision down to just the
**case-generator runner**: the `pipeline.systematize` and `pipeline.test_set` stages in both config
files pin one fixed model directly in YAML (`openrouter/anthropic/claude-sonnet-4.6`, no engine-lane
indirection). Anything broader than that — e.g. routing case generation through a shared
multi-engine picker — is explicitly sequenced **after** this trial, not decided by it.

## Install

```bash
cd tools/assert-lane
uv sync
```

`uv sync` reads `pyproject.toml` and installs the exact pin `assert-ai==0.1.0` (+ `httpx`) into a
local `.venv` here. (Alternative one-shot, no persistent env: `uvx --from assert-ai==0.1.0
assert-ai run --config ...` — but then `wrappers.py`'s import of `httpx` and the support-bot package
must still resolve, so `uv sync` + `uv run` is the documented path below.)

## Env vars (the repo's real names — nothing here invents a new one)

| Var                                       | Used by                                                                                                                                                                          | Required |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `DOCS_SERVICE_URL`                        | both targets (`services/docs` base URL, e.g. `https://docs.internal`)                                                                                                            | yes      |
| `DOCS_SERVICE_TOKEN`                      | both targets (Bearer for `POST /query`)                                                                                                                                          | yes      |
| `OPENROUTER_API_KEY`                      | ASSERT's own systematize/test_set/judge stages, AND `chat_support_bot`'s generation call (one credential, per the repo's OpenRouter-is-the-one-external-LLM-credential doctrine) | yes      |
| `CAISSON_SUPPORT_BOT__OPENROUTER_API_KEY` | `chat_support_bot` only — checked **before** `OPENROUTER_API_KEY`, same fallback order as `services/support-bot/tests/live/test_retrieval_battery_live.py`                       | no       |
| `OPENROUTER_MODEL`                        | `chat_support_bot` only — overrides the generation model (default `anthropic/claude-sonnet-4.6`, matching `config.py`'s own default)                                             | no       |

These are read straight from the process environment (`os.environ`) — nothing is hardcoded, nothing
is logged. Source real values from `~/.gridwork/env` per this repo's operator convention; never
commit a `.env` file here.

## Run

Against the live docs-RAG retrieval endpoint:

```bash
cd tools/assert-lane
uv sync
DOCS_SERVICE_URL=... DOCS_SERVICE_TOKEN=... OPENROUTER_API_KEY=... \
  uv run assert-ai run --config config/docs-rag.eval_config.yaml
```

Against the live support-bot pipeline:

```bash
cd tools/assert-lane
uv sync
DOCS_SERVICE_URL=... DOCS_SERVICE_TOKEN=... OPENROUTER_API_KEY=... \
  uv run assert-ai run --config config/support-bot.eval_config.yaml
```

Run from **inside** `tools/assert-lane/` in both cases — `pipeline.inference.target.callable` in
each config is the bare module path `wrappers:chat_docs_rag` / `wrappers:chat_support_bot`, resolved
against `wrappers.py` in the current directory (the same convention ASSERT's own examples use for
their `examples.<name>.<module>:<fn>` callables, just one level shallower here since there is no
package wrapper).

Check status / inspect results (per ASSERT's own CLI):

```bash
uv run assert-ai results status <suite> <run>       # e.g. docs-rag-behavior-v1 pre-release-1
```

Artifacts land under `tools/assert-lane/artifacts/` (ASSERT's default `artifacts_root`, relative to
cwd) — gitignored; this is scratch output from a manual run, not a committed record.

## Cost note

Every stage past `inference` calls a real LLM (`systematize` generates the behavior taxonomy,
`test_set` generates cases, `judge` scores every case) — this **spends real OpenRouter/LLM budget**
on every invocation, on top of whatever the target itself costs (the support-bot config's
`inference` stage also calls OpenRouter for generation). Keep `sample_size` small for a spot-check
(both configs default to 8 prompt cases + 2 scenario cases); do not loop this in a script or cron.

## Findings are advisory, not a gate

**Nothing in this lane blocks anything.** A run's `scores.jsonl` / `metrics.json` is input the
**operator** reads before deciding to ship a release — it never fails a build, never blocks a PR,
and is never invoked by CI (enforced structurally: this directory contains no workflow file, and the
task that created it was explicitly forbidden from touching `.github/workflows/`). Treat a red
finding here the same way you'd treat a human beta-tester's bug report: real signal, operator's
call on timing and priority.
