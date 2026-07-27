# Caisson Ask AI configuration-recovery audit

**Advisory:** this targeted production run does not gate CI and does not promote a
deterministic browser test.

Run: `2026-07-26-ask-ai-config-recovery`

Executed: 2026-07-26

Ring: public

Origin: `https://caisson.sh/docs`

Viewport/theme: 1440×1000, production default

Reference lock: [reference-lock.md](reference-lock.md)

Decision ledger: [decision-ledger.md](decision-ledger.md)

Evidence retention: the report, manifest, findings, journals, reference lock, decision ledger,
verification note, and network summary are tracked. The four PNG captures remain organized
locally under `evidence/` and gitignored, matching the repository's browser-audit retention
policy.

## Outcome

**BLOCKED — the retrieval seam was not exercised.**

The deployed docs page rendered, the Ask AI disclosure opened, the question field accepted
input, and submission entered the “Searching the docs…” state. Cloudflare then rejected the
automated browser's Turnstile token. The application correctly failed closed:

- Cloudflare challenge Private Access Token request: HTTP 401.
- `POST https://caisson.sh/api/ask`: HTTP 403.
- Visible recovery state: “We couldn't verify your browser. Reload the page and try again.”
- Recovery actions: “Browse the docs,” “Talk to the team,” and “Ask another question.”

This proves the public route, widget interaction, and fail-closed challenge boundary. It does
**not** prove that `DOCS_QUERY_URL` and `DOCS_SERVICE_TOKEN` now produce a grounded answer,
because `apps/site/lib/ask-ai/handler.ts` verifies Turnstile before retrieval.

The configuration deployment itself is separately verified by Railway: every approved site
variable is present, the site-only deployment
`5b42693e-2508-4e4f-bc42-8e4f730fc443` reached `SUCCESS`, and no variable values were read into
the audit. Those facts establish configuration presence and deployment completion, not end-to-end
Ask AI behavior.

## Coverage

| Surface | Result | Evidence |
| --- | --- | --- |
| Docs render | PASS | `evidence/ask-ai-before.png` |
| Ask AI disclosure | PASS | `evidence/ask-ai-open.png` |
| Question entry and submission | PASS | `evidence/ask-ai-question.png` |
| Turnstile boundary | PASS, fail-closed | `evidence/ask-ai-turnstile-blocked.png`, `evidence/network-summary.json` |
| Docs retrieval | NOT COVERED | Turnstile rejected the automated browser before retrieval |
| Grounded generation and citations | NOT COVERED | Retrieval was not reached |

The manifest contains the complete 59-surface production inventory. This was intentionally a
targeted regression probe, not a replacement for the prior exhaustive audit: authenticated rings,
mobile parity, alternate themes, unrelated journeys, performance traces, and reversible account
mutations were not exercised.

## Findings

No product defect is filed from this run. Cloudflare documents mandatory server-side validation,
single-use five-minute tokens, production/test-key separation, and explicit error handling. The
observed 403 is therefore the expected security posture for a rejected automated-browser token,
not evidence of a broken human journey.

The missing end-to-end proof remains an operational verification gap. A human browser with a real
production Turnstile token must ask one non-sensitive docs question and observe either:

1. streamed answer text plus at least one cited docs source, or
2. a machine-readable Ask AI escalation state after Turnstile admission.

Only the first result closes the original retrieval-configuration recovery.

## Mutations

No application, account, entitlement, billing, admin, or external-system mutation occurred.
One public question was submitted, but Turnstile rejected it before the admitted-request capture,
retrieval, generation, spend, or escalation seams. The mutation journal is empty.

## Reference-informed judgment

The existing Caisson UI direction remains locked: cold-steel surfaces, mono for proof, one
instrument accent, and explicit recovery language. Refero references were used only to evaluate
the interaction hierarchy:

- Perplexity AI input `d997aa75-4352-429a-81e9-373a956cdc8a`
- Anthropic support search `3db8dd52-8b90-4bee-8212-5e924f64a26c`
- Lovable Help and Resources flow `12206`

The current widget already follows the useful parts of those references: focused entry, visible
working state, structured recovery, and an escape to source docs or support. No visual redesign
is justified by this configuration-recovery run.

## Next proof

Run the same question — “What is included in the Compliance bundle?” — once in an ordinary human
browser. Capture the settled answer and citations plus the `/api/ask` status. Do not substitute
Cloudflare test keys in production and do not bypass server-side verification.
