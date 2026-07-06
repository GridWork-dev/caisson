# Audit-ledger verification record — 2026-07-05 (Kickoff B)

**What this is:** the adversarial reproduce-check record for all 264 rows that were `open`
in `outputs/audit/ledger.toml` at the start of the hygiene-audit-remediation session
(operator lock: verify-then-fix ALL 91 open-highs; every high got an opus verifier + an
opus skeptic overturn pass, with a tiebreak arbiter — Fable on the security-adjacent
domains — on any disagreement; warn/info rows got a sonnet adversarial check). 112 agents,
264/264 verdicts, 0 missing.

**Outcome:** 99 (20 high · 45 warn · 34 info) CONFIRMED (fixed in this session's fix wave unless noted
in the PR) · 131 (69 high · 49 warn · 13 info) ALREADY_FIXED (true of an earlier state, already
corrected at HEAD — the ledger simply had not been reconciled since PRs #110–#115) ·
34 (2 high · 23 warn · 9 info) REFUTED (the finding's assertion is wrong at HEAD; closed with the
refutation recorded below, never "fixed").

The ledger reconcile that follows this record flips ALREADY_FIXED and REFUTED rows to
`fixed` mechanically (absence-from-input); the ledger's status enum has no "refuted"
value — THIS file is the refutation record the close points at.

---

## 1. REFUTED — 34 (2 high · 23 warn · 9 info)

### `b96b4b1431cd9139` — generator-templates · high · D3

**SS-9: the free sample's README instructs bun install public npm only @caisson/kernel is Apache-2.0 no license key needed, but @caisson is not the operator's public npm scope.**

- subject: `packages/cli/templates/eu-ai-act-sample/README.md:9,23 and package.json:7`
- verified via: tiebreak
- evidence: The finding mischaracterizes intended behavior. Per ADR-0222 (docs/state/public-surface.md:115-117) in-repo package names intentionally stay @caisson/* and are renamed to @caisson-sh/* only at export. scripts/export-public-mirror.ts:506 runs rewriteCliTemplates for @caisson/cli; rewriteCliTemplates (322-326) + rewriteTreeBlanket (328-339) apply rewriteProseMentions(rewriteImportSpecifiers(...)) to EVERY file in the eu-ai-act-sample tree, so package.json:14 (@caisson/kernel dep), src imports, and README.md:24 prose all become @caisson-sh/kernel in the public mirror (rewriteProseMentions at :173-177 rewrites every bare @caisson/<slug>; NEW_SCOPE='@caisson-sh/' at :43). The exclude note at :71-72 confirms the generator reads the template files from disk at runtime and that these on-disk files are rewritten to @caisson-sh/kernel for the mirror. A public buyer installs @caisson-sh/cli, the generator materializes a fully @caisson-sh-scoped sample, and bun install resolves @caisson-sh/kernel from public npm. The asserted install breakage never occurs; the raw @caisson/kernel in-repo is intended source state, not a buyer-facing defect.

### `4a4298fa273557ec` — packages/ui · high · D3

**SS-9: README's opening description is factually false about the shipped implementation**

- subject: `packages/ui/README.md:3`
- verified via: skeptic-agree
- evidence: packages/ui/README.md:3 describes "typed OKLCH token floor plus a consistent component recipe: Radix behavior, co-located CSS, and data-* attribute variants, shipped as framework-agnostic raw .tsx." Every clause matches the shipped code: src/tokens/foundation.ts uses oklch; src/components/button.tsx + form-field.tsx import radix-ui; 27 co-located *.css files sit beside components; data-sign/data-variant selectors are used (money-cell.tsx:91, button.tsx); components are raw .tsx and the only "next/" hits (button.tsx:17, edition-card.tsx:34, tokens/theme.ts:45) are comments, not imports. The description is factually true, so the finding's SS-9 assertion does not hold.

### `30e4918bedbfe18e` — apps/agent-dev · warn · D3

**SS-12: package.json description opens with an unframed ADR/exception fragment**

- subject: `apps/agent-dev/package.json:6`
- verified via: sonnet-single
- evidence: apps/agent-dev/package.json:6 description opens with 'Agentic-Dev edition CLI reference app: drives one governed lifecycle end-to-end...' — the ADR/exception fragment 'ADR-0044 CLI exception (a kernel demo is not a Next.js page)' is at the END of the string, not the opening, and it IS framed by an explanatory parenthetical. git log -p shows this field was added once and never edited, so it never opened with the fragment either. The finding's premise (opens with an unframed fragment) is factually wrong on both counts.

### `262ec335cd5e4bc3` — oss-mirror · warn · D4

**The operator's real company email domain (admin@gridwork.dev) is hardcoded in shipped public test fixtures.**

- subject: `packages/kernel/src/crypto.test.ts:19,27,30`
- verified via: sonnet-single
- evidence: packages/kernel/src/crypto.test.ts:19,27,30 use "admin@example.com" and "@caisson.sh" addresses only — grep for 'gridwork' across the whole file returns zero matches. The operator's real domain gridwork.dev is not present anywhere in this test file.

### `2c2ac47ac5b6320c` — oss-mirror · warn · D3

**SS-1: a shipped source comment names the private identity repo gridwork-core directly**

- subject: `packages/kernel/src/crypto.ts:1`
- verified via: sonnet-single
- evidence: packages/kernel/src/crypto.ts:1 reads "// Security primitives: constant-time comparison for secrets..." — grep for 'gridwork' across the entire 91-line file returns zero matches. gridwork-core is never named in this file.

### `683efb8b7b3bd005` — oss-mirror · warn · D3

**SS-1: license-verify's shipped source repeatedly names the private sibling repo tessera it was extracted from**

- subject: `packages/license-verify/src/token.ts:2-3`
- verified via: sonnet-single
- evidence: packages/license-verify/src/token.ts:1-10 (the full header) cites ADR-0010 and describes the codec layer; grep for 'tessera' in this file and the whole packages/license-verify/src/ tree returns zero matches. tessera is not named.

### `7871a70a60a9d164` — oss-mirror · warn · D4

**The license-verify package README names a private sibling repo (tessera), the internal pro-private firewall policy, and an internal build-phase codename (P6).**

- subject: `packages/license-verify/README.md:4-8`
- verified via: sonnet-single
- evidence: packages/license-verify/README.md (full file, 15+ lines) has zero matches for 'tessera', 'P6', 'pro-private', or 'firewall' — the README only discusses ADR-0010/ADR-0024 and offline verify mechanics.

### `8f323b59ee0a22bd` — packages/agent-kernel · warn · D3

**SS-2: an extended comment block narrates internal task ids T4/T11/T12 as the build history of the validator instead of documenting its current contract**

- subject: `packages/agent-kernel/src/golden.ts:8`
- verified via: sonnet-single
- evidence: golden.ts:1-70 has no T4/T11/T12 shorthand; grep for 'T4|T11|T12' across golden.ts and golden.test.ts returns zero matches. Header comment (golden.ts:1-6) documents the golden-first contract (ADR-0021/ADR-0013), and the validate-golden block (lines 46-69) documents the ghost-ref validator's actual contract, not build history by task id.

### `c2c16f62261a267b` — packages/agent-kernel · warn · D4

**SS-12: registry-visible description ends in bare (ADR-0065)**

- subject: `packages/agent-kernel/package.json:10`
- verified via: sonnet-single
- evidence: package.json:10 description reads "Engine-neutral agent kernel: agent/skill/rule Zod schema + lifecycle act FSM + hooks dispatcher. The shared base layer cli/mcp-server and the agent-dev edition compose down-only — no vendor SDK, no LLM call." — it contains no ADR reference at all, let alone one ending in a bare '(ADR-0065)'.

### `ddadd574078f510d` — packages/agent-kernel · warn · D4

**SS-2: internal task-shorthand (T4, T11, T12) narrates the package's own build history inside shipped golden-fixture source**

- subject: `packages/agent-kernel/src/golden.ts:6,46,49,56-58,239,242 and golden.test.ts:1,3`
- verified via: sonnet-single
- evidence: Checked every cited line (golden.ts:6,46,49,56-58,239,242 and golden.test.ts:1,3): none contain T4/T11/T12. golden.ts:239-242 is generic fixture-produce code for the validate case; golden.test.ts:1-3 documents golden-first RED-then-green flow via ADR-0013, no task shorthand. grep confirms zero T4/T11/T12 occurrences repo-wide in these files.

### `eaf8ecff6ca2ba78` — packages/agent-kernel · warn · D3

**SS-12: package.json description carries a bare ADR id, visible on the registry/npm listing**

- subject: `packages/agent-kernel/package.json:10`
- verified via: sonnet-single
- evidence: package.json:10 (quoted above) has no ADR id of any kind, bare or otherwise — description text is pure functional prose ending "...no vendor SDK, no LLM call."

### `a675d9102f28bfc6` — packages/ai-config · warn · D4

**SS-12: registry-visible description ends in a bare trailing ADR-0011 sentence**

- subject: `packages/ai-config/package.json:10`
- verified via: sonnet-single
- evidence: packages/ai-config/package.json:10 description reads 'Provider-agnostic AI config resolver (OpenAI, Anthropic, Google, OpenRouter, local, Bedrock, Azure OpenAI, Ollama) + buyer settings file.' — no ADR-0011 reference or bare trailing sentence exists; description is clean and self-contained.

### `139a01f8d16b1f36` — packages/ai-meter · warn · D4

**SS-2: internal task-shorthand (T6, T7, T8) labels the shipped money-path test suite's own describe blocks and header comments**

- subject: `packages/ai-meter/src/meter.integration.test.ts:1, schema.test.ts:1, pricebook.test.ts:1,3,53`
- verified via: sonnet-single
- evidence: meter.integration.test.ts:1-5, schema.test.ts:1-5, pricebook.test.ts:1-4 are prose descriptions citing ADRs (ADR-0060/0007/0005 etc.) — no 'T6'/'T7'/'T8' shorthand anywhere. `grep -rn "T6\|T7\|T8" packages/ai-meter/` returns zero matches repo-wide.

### `7029bdb75caf8070` — packages/ai-meter · warn · D3

**SS-12: package.json description ends with a bare ADR id shown on the registry/npm listing**

- subject: `packages/ai-meter/package.json:10`
- verified via: sonnet-single
- evidence: package.json:10 description reads: "Metered-inference money path: estimate->reserve->reconcile over the credit ledger + versioned price book + atomic spend window + soft/hard caps + circuit breaker, all FORCE-RLS." — ends in prose, no ADR id at all.

### `84568b4227409520` — packages/ai-meter · warn · D3

**SS-1/SS-5 (judgment call): ponytail tagged comments leak the internal AI-pairing shortcut-marking convention into shipped source**

- subject: `packages/ai-meter/src/dedup.ts:149`
- verified via: sonnet-single
- evidence: dedup.ts:149 reads only "Capacity is small by design — a real bucket-indexed Map only pays off past a few thousand entries..." `grep -n ponytail packages/ai-meter/src/dedup.ts` returns nothing — no `ponytail:` tag present in the file.

### `aac690452dbf35f7` — packages/ai-meter · warn · D4

**SS-12: registry-visible description ends in bare ADR-0060/0014/0070**

- subject: `packages/ai-meter/package.json:10`
- verified via: sonnet-single
- evidence: Same package.json:10 description as 7029bdb7 — "...all FORCE-RLS." No bare ADR-0060/0014/0070 suffix; description contains zero ADR references.

### `61c09df43576d9c9` — packages/auth · warn · D3

**SS-12: description carries a bare ADR id instead of plain buyer-readable copy.**

- subject: `packages/auth/package.json:10`
- verified via: sonnet-single
- evidence: packages/auth/package.json:10 description reads: 'Provider-agnostic authentication: EdDSA-JWT account tokens, a session contract, and multi-user account membership over row-level security. better-auth is the reference session provider.' This is plain buyer-readable prose with no bare ADR id anywhere in it — the finding's assertion does not match current content.

### `bfee26cc02c4f2c1` — packages/credits · warn · D3

**SS-12: description ends with a bare ADR-id citation.**

- subject: `packages/credits/package.json:10`
- verified via: sonnet-single
- evidence: packages/credits/package.json:10 description reads 'Integer credit wallet with an append-only ledger, debit-before-spend (HTTP 402), and idempotent credit grants.' — it ends with plain prose, no ADR-id citation at all (bare or otherwise). The finding's claimed content is not present at HEAD.

### `3856cb01c4b34cce` — packages/guardrails · warn · D3

**SS-1: shipped source comment names the sibling private repo media-pipeline**

- subject: `packages/guardrails/src/pii.ts:1`
- verified via: sonnet-single
- evidence: packages/guardrails/src/pii.ts:1-9 header cites only ADR-0063 and ADR-0055 (internal ADR ids, not repo names). No occurrence of "media-pipeline" anywhere in packages/guardrails/ (grep -rn media-pipeline returns nothing). Finding misreads the ADR shorthand as a repo name.

### `e7f840f74b959f18` — packages/guardrails · warn · D3

**SS-12: npm-registry description ends with a standalone bare ADR citation sentence**

- subject: `packages/guardrails/package.json:10`
- verified via: sonnet-single
- evidence: packages/guardrails/package.json:10 description reads: "Content-safety layer: swappable Moderator port (local | provider | custom) + TS-native PII engine (mask / hash / reversible-tokenize via field-crypto) behind a fail-closed input/output guard." There is no ADR citation anywhere in the string — it ends on "guard." with no trailing sentence.

### `83e244924803719c` — packages/kernel · warn · D3

**SS-2: source comment references the P6 dashboard, an internal phase-shorthand with no definition**

- subject: `packages/kernel/src/observability.ts:2`
- verified via: sonnet-single
- evidence: packages/kernel/src/observability.ts:1-7 has no 'P6' reference anywhere in the file (grep confirms zero matches). Line 2 reads 'the buyer dashboard, docs, and support bot read' — plain English, not a phase-shorthand. The finding misreads content that isn't present.

### `c7c84d6541111247` — packages/kernel · warn · D3

**SS-3: Key ADR line is a bare id list with no explanation of what the decisions established**

- subject: `packages/kernel/README.md:7`
- verified via: sonnet-single
- evidence: packages/kernel/README.md is 8 lines total; grep for 'ADR' (case-insensitive) returns zero matches anywhere in the file. Line 7 reads 'Real src + tests: typed config/schema, the CaissonError model, a SHA-256 audit-chain, and append-only version primitives.' — prose, not a bare ADR id list. No 'Key ADR line' exists in this file.

### `21c0cbe9700fb62d` — packages/license-verify · warn · D3

**SS-2: README and AGENTS.md repeatedly call the license issuer P6 with no definition**

- subject: `packages/license-verify/README.md:8; AGENTS.md:1,5,44,49`
- verified via: sonnet-single
- evidence: grep -n "P6" packages/license-verify/README.md packages/license-verify/AGENTS.md returns zero matches at HEAD. README.md:8 and AGENTS.md:1,5,44,49 all say "issuer service" / "license issuer", not "P6" — the codename cited by the finding is not present anywhere in either file.

### `09507286bfba0c96` — packages/retention-runner · warn · D3

**SS-3: the package's opening description is only two bare parenthetical ADR labels, no plain-language explanation.**

- subject: `packages/retention-runner/README.md:4`
- verified via: sonnet-single
- evidence: packages/retention-runner/README.md:3-4 opens with a full plain-language sentence — "CCPA/GDPR right-to-erasure runner — pluggable multi-store erasure with per-target error isolation and a reason-tagged audit row." — before the ADR citations on the same line. It is not "two bare parenthetical ADR labels"; the ADRs are a trailing citation, not the whole description.

### `6af8b0a19983d279` — services/support-bot · warn · D4

**The Discord bot's format_answer renders raw citations/sources_considered source paths straight into its public reply/escalation-thread footer with no allow-list, so an internal-only package path can be quoted directly to a buyer.**

- subject: `services/support-bot/src/caisson_support_bot/bot.py:39-49`
- verified via: sonnet-single
- evidence: bot.py:39-49 format_answer just renders result.citations verbatim, but citations originate solely from RagPipeline (rag.py:179 `citations=[c.source for c in chunks]`), whose chunks come from the docs-service corpus. That corpus (services/docs/src/corpus.ts:1-5, 99-133) walks ONLY `apps/site/content/docs/*.mdx` and `packages/*/README.md` — every package under packages/ (billing, compliance, audit-harness, etc.) is a real shipped product package, and ADRs/specs/internal decision records are explicitly excluded (corpus.ts:4-5). There is no 'internal-only package path' reachable through this pipeline to quote to a buyer — the directory enumeration itself is the allow-list.

### `3c2062fca2fa183c` — oss-mirror · info · D3

**SS-1: a shipped test fixture hardcodes the operator's real-looking email domain gridwork.dev**

- subject: `packages/kernel/src/crypto.test.ts:19,27,30`
- verified via: sonnet-single
- evidence: Same file as 262ec335cd5e4bc3: packages/kernel/src/crypto.test.ts lines 19/27/30 use admin@example.com and *@caisson.sh, never gridwork.dev. Full-file grep for 'gridwork' is empty.

### `45118cf1e6024b5a` — oss-mirror · info · D3

**SS-1: ui's manifest description and a token-source comment name the private sibling repo Wardfile**

- subject: `packages/ui/manifest.ts:18`
- verified via: sonnet-single
- evidence: packages/ui/manifest.ts (all 19 lines) has no mention of 'Wardfile' anywhere. Line 18's description is: "Typed OKLCH token floor (ADR-0042 design foundation: palette + type scale) — OKLCH token objects generate tokens.css via a small gen-script." No private sibling repo is named.

### `1cd5eeb113dc8638` — packages/agent-kernel · info · D3

**SS-3 (judgment call): four ADR ids are listed before their explanations rather than after, reading as a bare id list**

- subject: `packages/agent-kernel/README.md:4`
- verified via: sonnet-single
- evidence: README.md:4-8 has no bare ADR-id list at all — line 4 is prose ("and the agent-dev edition compose down-only."); the only ADR mentions in the file are inline explained refs: "import an edition (ADR-0022 down-only)" (line 8) and "update only via BLESS=1 (ADR-0013)" (line 59). There is no list of four bare ADR ids anywhere in the file.

### `ecbdf2fcd876cdf2` — packages/alerting · info · D6

**Both the AGENTS.md contract and the source file itself cite a non-existent file email.ts for the no-body-leak rule**

- subject: `packages/alerting/AGENTS.md:21 and packages/alerting/src/channels.ts:5`
- verified via: sonnet-single
- evidence: Neither packages/alerting/AGENTS.md:21 nor src/channels.ts:5 cites a filename 'email.ts' — both just say '...the same no-body-leak rule @caisson/email's drivers follow' (package name, not a file path). Additionally the claim that email.ts doesn't exist is itself wrong: packages/email/src/email.ts is a real file in the repo.

### `be50a215e9b9b8e1` — packages/license-verify · info · D4

**README uses unexplained internal phase-codename jargon (P6) in a public (oss-tier) package**

- subject: `packages/license-verify/README.md:5,8`
- verified via: sonnet-single
- evidence: Same basis: README.md:5,8 read 'perpetual-per-major licensing (ADR-0024)' and 'the matching private key lives solely with the issuer service' — no 'P6' string appears in README.md (47 lines) at all. The jargon the finding flags is not present at HEAD.

### `6940fbdc7ee94bc3` — packages/migrate · info · D3

**SS-12: npm-visible description opens with a bare parenthetical ADR pair.**

- subject: `packages/migrate/package.json:10`
- verified via: sonnet-single
- evidence: packages/migrate/package.json:10 description reads: "The base migration assembler + runner: reads each selected package's on-disk migrations/NNNN_*.sql, merges them via the kernel into ONE renumbered sequence..." — plain prose from the start, no leading parenthetical ADR pair (e.g. no "(ADR-0070/0090)" prefix). The finding's claim does not match current content.

### `c92bf6f7b63828fb` — packages/registry-schema · info · D3

**SS-2/SS-3: changelog entry cites an internal decision-fork code, Fork AM-3 = A, unresolvable to a buyer.**

- subject: `packages/registry-schema/CHANGELOG.md:7`
- verified via: sonnet-single
- evidence: packages/registry-schema/CHANGELOG.md:7 actually reads: '- b5915e0: Register the `admin_adjust` feature tag (ADR-0220). An operator credit-adjust action rides the existing ADR-0074 `feature_grant`/`feature_debit` envelope...' — this cites ADR-0220/ADR-0074, not any 'Fork AM-3'. A repo-wide grep for 'Fork AM-3' returns zero hits anywhere in this package. The finding's specific claim does not match the file's content at HEAD.

### `8490b6337d8f6133` — packages/retention-runner · info · D3

**SS-3: comment cites an unresolvable internal locator, ADR-0229 row 56, as part of the explanation.**

- subject: `packages/retention-runner/src/schedule.ts:36`
- verified via: sonnet-single
- evidence: packages/retention-runner/src/schedule.ts:36 cites "ADR-0229 row 56". knowledge/decisions/ADR-0229-wave6-compliance-billing-subset.md:34 has a real Row 56: "Scheduler max_instances=1 / coalesce overlap-safety default | XS | jobs" — exactly the overlap-safety concept the comment describes. The locator resolves precisely; it is not unresolvable.

### `1e231e2c3104bb45` — services/license · info · D3

**SS-4: changelog entry references internal Linear issue ids CAISSON-5/6/7/8/9 (post-wave triage).**

- subject: `services/license/CHANGELOG.md:6`
- verified via: sonnet-single
- evidence: services/license/CHANGELOG.md:6 reads '- Updated dependencies [cf66d65]' (standard changeset autogen text). No CAISSON-5/6/7/8/9 or any 'CAISSON-' string appears anywhere in the file (grep found zero matches). The finding's claimed content does not exist at HEAD.

---

## 2. ALREADY_FIXED — 131 (69 high · 49 warn · 13 info)

Evidence retained in the session verdicts (workflow wf_9eff8300-841 journal); titles only.

### `10bbccfb73e31a70` — apps/site · high · D6

**The site shows two different install commands for the same generator: docs pages say bun create caisson@latest, marketing pages say npx create-caisson@latest**

- subject: `apps/site/content/docs/getting-started.mdx:20 vs apps/site/app/(marketing)/pricing/page.tsx:688`
- verified via: skeptic-agree

### `de817a16dd23e40d` — apps/site · high · D6

**The Agentic-Dev docs page still calls the edition a roadmap edition sequenced post-wedge while the site's own pricing page sells it as a live $249 checkout product**

- subject: `apps/site/content/docs/agentic-dev/index.mdx:6-11`
- verified via: skeptic-agree

### `00dfbec9d34bed4f` — oss-mirror · high · D3

**SS-1/SS-3/SS-11: every package README ships an unedited internal-authoring template naming private sibling repos and linking a doc that isn't in the mirror**

- subject: `packages/kernel/README.md:6-10`
- verified via: skeptic-agree

### `03f8ebee857dbb70` — oss-mirror · high · D4

**Every package README ships unscrubbed internal build-status boilerplate, including two dangling links and a private sibling-repo name.**

- subject: `packages/kernel/README.md:6-10`
- verified via: skeptic-agree

### `14c051799b517ad2` — oss-mirror · high · D6

**11 shipped package READMEs in the public OSS mirror link to internal-only paths (docs/build-state.md, /plan.md) that do not exist in the mirror**

- subject: `packages/kernel/README.md:9-10 (exported mirror output)`
- verified via: skeptic-agree

### `97b89aac268d0739` — oss-mirror · high · D3

**SS-1: every mirrored package README leaks gridwork-isms (gridwork-core/gridwork/tessera as Seeds, and the sibling private repo media-pipeline by name) straight into the public-facing oss-mirror.**

- subject: `packages/kernel/README.md:6,10 (recurs identically in ~16 more mirrored packages, e.g. packages/billing, packages/auth, packages/ui, packages/cli)`
- verified via: skeptic-agree

### `dc5d03dded36381c` — oss-mirror · high · D3

**SS-12: npm-published description field is padded with bare ADR ids, repeated across most of the 18 exported packages**

- subject: `packages/kernel/package.json:10`
- verified via: skeptic-agree

### `1eb7905e95107392` — packages/agent-dev · high · D4

**SS-1/SS-10: shipped README names private sibling repos gridwork-core and media-pipeline as the edition's rebuild seed**

- subject: `packages/agent-dev/README.md:6,10`
- verified via: skeptic-agree

### `93da5a5ad3947b6d` — packages/agent-dev · high · D3

**SS-1: README Seeds line and build-status footer name gridwork-core and media-pipeline, private sibling repos a buyer cannot resolve**

- subject: `packages/agent-dev/README.md:6`
- verified via: skeptic-agree

### `b327e6a013fb5078` — packages/agent-dev · high · D3

**SS-1: comment names the internal gridwork-core gw-prefixed agent convention and its capabilities.toml file, meaningless to a buyer**

- subject: `packages/agent-dev/src/content/rules.ts:4`
- verified via: skeptic-agree

### `6f452361e050969d` — packages/agent-kernel · high · D4

**SS-1/SS-10: shipped README says Rebuilt clean from the public gridwork-core pattern and disclaims pro-private media-pipeline code**

- subject: `packages/agent-kernel/README.md:62-63`
- verified via: skeptic-agree

### `a09f6a5de93ecd93` — packages/agent-kernel · high · D3

**SS-1: README footer names the public gridwork-core pattern and the pro-private media-pipeline repo**

- subject: `packages/agent-kernel/README.md:62`
- verified via: skeptic-agree

### `ca981ee25c8dc9ca` — packages/agent-kernel · high · D6

**Agent-facing contract omits governance.ts and audit-lifecycle.ts, roughly half the package's real exported surface**

- subject: `packages/agent-kernel/AGENTS.md:1-53`
- verified via: skeptic-agree

### `08490e3c44491402` — packages/ai-config · high · D3

**SS-1: README names two private/internal seed repos (gridwork, gridwork-core) and pro-private media-pipeline**

- subject: `packages/ai-config/README.md:6`
- verified via: skeptic-agree

### `2ebc869f85e117e6` — packages/ai-config · high · D3

**SS-10/SS-11: 11-line stub README with no usage snippet and a dead relative link out of the published package**

- subject: `packages/ai-config/README.md:9`
- verified via: skeptic-agree

### `972ff21bfff6ddae` — packages/ai-config · high · D6

**AGENTS.md's supported-provider list is missing 3 of the 8 live providers**

- subject: `packages/ai-config/AGENTS.md:8`
- verified via: skeptic-agree

### `e1f00a496d937e23` — packages/ai-config · high · D3

**SS-12: the entire package.json description is a capability phrase plus a bare, unexplained ADR id**

- subject: `packages/ai-config/package.json:10`
- verified via: skeptic-agree

### `e6ccf84545b51ab7` — packages/ai-config · high · D4

**SS-1/SS-10: shipped README lists gridwork, gridwork-core as rebuild seeds and mentions pro-private media-pipeline**

- subject: `packages/ai-config/README.md:6,10`
- verified via: skeptic-agree

### `7c34b5544cab71d1` — packages/ai-evals · high · D3

**SS-10: package ships with no README.md at all, a buyer opening this paid primitive finds no purpose statement or usage example**

- subject: `packages/ai-evals/`
- verified via: skeptic-agree

### `7534c26b69b2acd8` — packages/ai-meter · high · D3

**SS-10: package ships with no README.md, a buyer of the metered-inference money-path primitive has no purpose statement or usage example**

- subject: `packages/ai-meter/`
- verified via: skeptic-agree

### `1e9237ffe1c42263` — packages/alerting · high · D3

**SS-1: README footer names the private gridworkdigital reference implementation and pro-private media-pipeline**

- subject: `packages/alerting/README.md:65`
- verified via: skeptic-agree

### `44c017d2e8166017` — packages/alerting · high · D4

**SS-1/SS-10: shipped README names gridworkdigital and media-pipeline as the alerting pipeline's source pattern**

- subject: `packages/alerting/README.md:65-66`
- verified via: skeptic-agree

### `744e1bd2994a872f` — packages/alerting · high · D4

**SS-1: shipped source comment names the private gridworkdigital reference repo and reveals it has 12 production event types vs. this package's reduced seed**

- subject: `packages/alerting/src/types.ts:3`
- verified via: skeptic-agree

### `a24e65d6bee99ffa` — packages/alerting · high · D3

**SS-1: source comment names the private gridworkdigital reference and its internal 12-type scope**

- subject: `packages/alerting/src/types.ts:3`
- verified via: skeptic-agree

### `319da3c5058ef603` — packages/audit-worm · high · D3

**SS-1: README names sibling private repos Wardfile and gridwork-core as seed sources.**

- subject: `packages/audit-worm/README.md:11`
- verified via: skeptic-agree

### `ab2bf75c56c8c26d` — packages/auth · high · D3

**SS-1/SS-11: README leaks the seed-repo name gridwork/media-pipeline and links to two internal, unshipped files.**

- subject: `packages/auth/README.md:6-10`
- verified via: skeptic-agree

### `abb3b980610c7f78` — packages/auth · high · D4

**The published @caisson/auth README ships internal build provenance to buyers: a named sibling private repo, dead links into the private monorepo's own docs, and bare ADR citations**

- subject: `packages/auth/README.md:6-10`
- verified via: skeptic-agree

### `ed3f6a7df3b795ca` — packages/billing · high · D3

**SS-4: shipped source comments cite internal Linear issue ids CAISSON-6/7/8 as the explanation for the code's behavior.**

- subject: `packages/billing/src/paddle-events.ts:78,140,166,187,245`
- verified via: skeptic-agree

### `efc3a537b4c7f35a` — packages/billing · high · D3

**SS-1/SS-11: README leaks gridwork/media-pipeline seed provenance and two dead internal links.**

- subject: `packages/billing/README.md:7-11`
- verified via: skeptic-agree

### `1d4ebb3dd54225c4` — packages/cli · high · D3

**SS-2: README section heading Wave-0 scope (skeleton) and body text the full P5 generation drive expose internal phase/wave shorthand.**

- subject: `packages/cli/README.md:6,9`
- verified via: skeptic-agree

### `ddda2d593c367d14` — packages/cli · high · D3

**SS-2: the package's main barrel-export header comment repeats the Wave 0/P5 internal phase shorthand (also generate.ts:49,106, writer.ts:19, meter.ts:245).**

- subject: `packages/cli/src/index.ts:1-2`
- verified via: skeptic-agree

### `0d14c257d17577e4` — packages/compliance · high · D3

**SS-1/SS-3: README's Key ADRs bare list and Seeds line name sibling private repos.**

- subject: `packages/compliance/README.md:10,13`
- verified via: skeptic-agree

### `5275e750a034d903` — packages/compliance · high · D6

**Compliance edition's documented Down-only dependency list omits @caisson/alerting and @caisson/retention-runner, two real runtime dependencies composed into the shipped edition surface.**

- subject: `packages/compliance/README.md:29-34, packages/compliance/AGENTS.md:46-50`
- verified via: skeptic-agree

### `f30bf083eb99865f` — packages/compliance · high · D3

**SS-2: the composed-edition entry file's opening comment names an internal build phase, Stage-2 operational-compliance primitives.**

- subject: `packages/compliance/src/edition.ts:1-2`
- verified via: skeptic-agree

### `3c260472ddbf7845` — packages/credits · high · D3

**SS-4: shipped comment cites an internal Linear issue id CAISSON-5 as part of the function's rationale.**

- subject: `packages/credits/src/credits.ts:347`
- verified via: skeptic-agree

### `4b0c284df10387ef` — packages/credits · high · D3

**SS-1/SS-11: README leaks the gridwork/media-pipeline seed provenance and two dead internal links.**

- subject: `packages/credits/README.md:6-10`
- verified via: skeptic-agree

### `9806646a8d01c205` — packages/credits · high · D4

**The shipped @caisson/credits CHANGELOG.md exposes internal Linear ticket IDs and a sibling internal service's implementation details to every buyer**

- subject: `packages/credits/CHANGELOG.md:49,53-58`
- verified via: skeptic-agree

### `f1f299b67770771c` — packages/field-crypto · high · D3

**SS-4: published CHANGELOG cites bare internal Linear issue ids (CAISSON-10/11/12/13)**

- subject: `packages/field-crypto/CHANGELOG.md:23`
- verified via: skeptic-agree

### `a756905e490bb707` — packages/guardrails · high · D3

**SS-10: the package ships with no README.md at all**

- subject: `packages/guardrails/`
- verified via: skeptic-agree

### `27b9408f2455f7b0` — packages/kernel · high · D3

**SS-1: README names the sibling private repo gridwork-core as the package's seed**

- subject: `packages/kernel/README.md:6`
- verified via: skeptic-agree

### `51fd6d422bdc8502` — packages/kernel · high · D3

**SS-11: README links to the private repo's internal docs/build-state.md**

- subject: `packages/kernel/README.md:9`
- verified via: skeptic-agree

### `b0c2a1dc36f03ee5` — packages/kernel · high · D3

**SS-1: top-of-file comment in a public Apache-2.0 source file names the gridwork-core security floor**

- subject: `packages/kernel/src/crypto.ts:1,31`
- verified via: skeptic-agree

### `d2a4f24f054edab3` — packages/kernel · high · D4

**Public README cites a sibling private repo and two dangling internal-only file paths**

- subject: `packages/kernel/README.md:6,9-10`
- verified via: skeptic-agree

### `ab415b3eb76a401d` — packages/license-verify · high · D3

**SS-12: npm-registry description stacks a sibling-repo name, internal phase shorthand, and a bare trailing ADR sentence**

- subject: `packages/license-verify/package.json:10`
- verified via: skeptic-agree

### `ae203971025c6eac` — packages/license-verify · high · D3

**SS-1: opening paragraph of the README names the sibling private repo tessera and narrates a pro-private firewall**

- subject: `packages/license-verify/README.md:4-6`
- verified via: skeptic-agree

### `015df1ff68ae85d3` — packages/local-ai · high · D3

**SS-1: README names three sibling private repos in one Seeds line**

- subject: `packages/local-ai/README.md:17-18`
- verified via: skeptic-agree

### `5946435afce48765` — packages/local-ai · high · D3

**SS-11/SS-2: README references an internal spec path (outputs/specs/wave1-p4a-local-ai/PLAN.md) and internal task/wave shorthand**

- subject: `packages/local-ai/README.md:22-23`
- verified via: skeptic-agree

### `d2ad39d528d936c9` — packages/local-ai · high · D4

**Paid edition's README names three sibling private/internal repos and a dangling internal spec path**

- subject: `packages/local-ai/README.md:17-18,23`
- verified via: skeptic-agree

### `9b75dc2ac2fa4dd2` — packages/local-store · high · D4

**README names the operator's private self-hosted CI runner label and a sibling private repo, plus ships a truncated duplicate note**

- subject: `packages/local-store/README.md:3-6,74`
- verified via: skeptic-agree

### `a8bd7b69ebf247b8` — packages/local-store · high · D3

**SS-1: shipped source comment names the sibling private repo gridwork-core**

- subject: `packages/local-store/src/store.ts:4-5`
- verified via: skeptic-agree

### `c402b2b104b28f80` — packages/local-store · high · D3

**SS-1: closing paragraph names the sibling private repo gridwork-core and media-pipeline**

- subject: `packages/local-store/README.md:71-72`
- verified via: skeptic-agree

### `f9690dff80dab43e` — packages/local-store · high · D3

**SS-1: the very first lines of the README name an internal self-hosted CI runner and a local host path**

- subject: `packages/local-store/README.md:3-4`
- verified via: skeptic-agree

### `3df30eb743156a96` — packages/mcp-server · high · D3

**SS-1/SS-3/SS-11: README leaks gridwork-isms, a bare ADR id, and a dead internal doc link instead of describing the package.**

- subject: `packages/mcp-server/README.md:6-10`
- verified via: skeptic-agree

### `4f6178f9b3214794` — packages/mcp-server · high · D4

**Package README names two private sibling repos and a dead internal doc link, shipped verbatim in the Apache-2.0 package.**

- subject: `packages/mcp-server/README.md:6`
- verified via: skeptic-agree

### `445fb4eae47f5e0f` — packages/migrate · high · D3

**SS-9/SS-13: README states the package is LicenseRef-Caisson-Commercial but package.json and LICENSE both say Apache-2.0.**

- subject: `packages/migrate/README.md:14-15`
- verified via: skeptic-agree

### `4bfce16dc683465c` — packages/migrate · high · D6

**README claims @caisson/migrate is commercial-licensed, directly contradicting its own package.json, LICENSE file, and manifest.ts**

- subject: `packages/migrate/README.md:14-15`
- verified via: skeptic-agree

### `3865d0e5eb6cf5e0` — packages/observability · high · D4

**Same internal build-tracking footer (dead ../../docs/build-state.md link plus named Pro-private media-pipeline repo) ships inside this Apache-2.0 package's README.**

- subject: `packages/observability/README.md:9`
- verified via: skeptic-agree

### `478f3898403a5269` — packages/observability · high · D6

**AGENTS.md's own Scope section says not to add product-level span helpers, but the package ships one (withRequestSpan) undocumented in Key surface**

- subject: `packages/observability/AGENTS.md:7-19 (Key surface) and :23-26 (Scope)`
- verified via: skeptic-agree

### `86145366fa9ae847` — packages/observability · high · D3

**SS-1: a ponytail comment, the operator's private AI-coding-agent convention, ships in commercial/oss source a buyer reads.**

- subject: `packages/observability/src/request-span.ts:7`
- verified via: skeptic-agree

### `1cc57e7a5f70cee1` — packages/registry-schema · high · D3

**SS-10: a publicly npm-published Apache-2.0 package ships with no README.md at all.**

- subject: `packages/registry-schema/package.json`
- verified via: skeptic-agree

### `17e307f101842c83` — packages/retention-runner · high · D6

**README's recurring-sweep usage example enqueues via raw queue.enqueue(), bypassing the overlap-safe enqueueAutoSweep() helper the code was hardened to require.**

- subject: `packages/retention-runner/README.md:52-54`
- verified via: skeptic-agree

### `205da1cdec6a19ae` — packages/retention-runner · high · D3

**SS-1: README's closing line names the sibling private company/repo gridworkdigital as the source of the erasure design.**

- subject: `packages/retention-runner/README.md:70-71`
- verified via: skeptic-agree

### `3bb093703a71d00b` — packages/retention-runner · high · D4

**Sold-source README credits a named private sibling repo (gridworkdigital) as the module's design source.**

- subject: `packages/retention-runner/README.md:70`
- verified via: skeptic-agree

### `33223afc9d8c3953` — root-docs · high · D6

**Root README still says the site hosts on Cloudflare Pages, but hosting moved to Railway on 2026-07-01 and the Pages project was torn down**

- subject: `README.md:69-70`
- verified via: skeptic-agree

### `41ef0375f9ca9019` — root-docs · high · D6

**Root README still calls Agentic-Dev a roadmap (unbuilt) edition; per docs/build-state.md it now has substantial code, a new shipped package, and a live Paddle price**

- subject: `README.md:12,23`
- verified via: skeptic-agree

### `7ad06001bbae0ac7` — root-docs · high · D6

**Root README's layout section still lists studio as a live app and caps the ADR range at 0137, both long superseded**

- subject: `README.md:49,53`
- verified via: skeptic-agree

### `84d7f755fb13f96a` — root-docs · high · D7

**Orphaned directory with build artifacts but no source code (apps/studio not present in the origin/main baseline domain universe; remapped from apps/studio to root-docs).**

- subject: `apps/studio`
- verified via: skeptic-agree

### `dd450b80725e7988` — root-docs · high · D6

**Root README's Layout/Locked sections describe a repo state 3+ major waves stale: wrong package/app inventory, wrong ADR range, and a superseded hosting claim.**

- subject: `README.md:47,49,53,69`
- verified via: skeptic-agree

### `1099cd58dc804996` — services/license · high · D3

**SS-10/SS-1: the service's README has no purpose line or run instructions and is written as an internal build log, including a sibling-private-repo name (tessera/media-pipeline) in the last line.**

- subject: `services/license/README.md:1-31 (whole file, esp. line 5, 19, 25, 30)`
- verified via: skeptic-agree

### `f331503a190e69aa` — apps/admin · warn · D6

**File header comment says the operator mutation panel has the four locked actions (grant, revoke, adjust, reissue), but a fifth action (RevokePurchaseCard) is now rendered.**

- subject: `apps/admin/src/app/business/mutations.tsx:3`
- verified via: sonnet-single

### `06450268e9d68ad7` — packages/agent-dev · warn · D3

**SS-12: package.json description ends with a bare ADR citation, shown on the registry/npm listing**

- subject: `packages/agent-dev/package.json:10`
- verified via: sonnet-single

### `3c5398109f6441ac` — packages/agent-dev · warn · D4

**SS-12: the npm/registry-visible package description ends in bare (ADR-0065/0066/0067) with no plain-language substitute**

- subject: `packages/agent-dev/package.json:10`
- verified via: sonnet-single

### `61a5db8623eabf43` — packages/agent-dev · warn · D3

**SS-2: source comments narrate internal plan task numbers (T18/T19/T20/T21/T12) as the explanation for the code instead of describing current behavior**

- subject: `packages/agent-dev/src/golden.ts:8`
- verified via: sonnet-single

### `69599df7fee8c7a7` — packages/agent-dev · warn · D4

**SS-2: internal PLAN.md task-shorthand (T19/T20/T12/T21) is baked into ~10 shipped source/test files as the only explanation for why code is ordered/structured this way**

- subject: `packages/agent-dev/src/content/index.ts:1-5 (also agents.ts:1, skills.ts:1, rules.ts:1, content.test.ts:1, golden.ts:2,8,10,80, golden.test.ts:5, emitter.test.ts:1)`
- verified via: sonnet-single

### `6879052ae8a6ec63` — packages/ai-evals · warn · D3

**SS-2/SS-3: manifest comment cites an internal task id (landed at T10) as the only provenance for the golden artifacts**

- subject: `packages/ai-evals/manifest.ts:7`
- verified via: sonnet-single

### `6b626dbbfee43866` — packages/ai-evals · warn · D7

**Missing package documentation file.**

- subject: `packages/ai-evals/README.md`
- verified via: sonnet-single

### `c4f13dd9aef43cc6` — packages/ai-evals · warn · D4

**SS-12: registry-visible description ends in bare ADR-0062/0013**

- subject: `packages/ai-evals/package.json:10`
- verified via: sonnet-single

### `ed7ce7bcaa329c9a` — packages/ai-evals · warn · D3

**SS-1/SS-5 (judgment call): a ponytail tagged comment leaks the internal AI-pairing shortcut-marking convention into shipped source**

- subject: `packages/ai-evals/src/agreement.ts:94`
- verified via: sonnet-single

### `fd42f8af556d7aa5` — packages/ai-meter · warn · D7

**Missing package documentation file.**

- subject: `packages/ai-meter/README.md`
- verified via: sonnet-single

### `fe2ad2d0157751d0` — packages/ai-meter · warn · D6

**Agent-facing contract has no mention of the shipped MinHash/LSH dedup-before-meter gate**

- subject: `packages/ai-meter/AGENTS.md:1-30`
- verified via: sonnet-single

### `1ad2c05357a4d0f5` — packages/alerting · warn · D3

**SS-2: changelog entry names an internal pentest engagement (Strix) and internal vulnerability catalog ids instead of describing the fix**

- subject: `packages/alerting/CHANGELOG.md:7`
- verified via: sonnet-single

### `56519c7ca0535d95` — packages/alerting · warn · D3

**SS-12: package.json description ends with two bare ADR ids shown on the registry/npm listing**

- subject: `packages/alerting/package.json:10`
- verified via: sonnet-single

### `74964f4e61d48ac4` — packages/alerting · warn · D4

**SS-12: registry-visible description ends in bare ADR-0135/0151**

- subject: `packages/alerting/package.json:10`
- verified via: sonnet-single

### `1231076f8309dae7` — packages/audit-worm · warn · D3

**SS-12: package.json description ends with a raw ADR-id string, not buyer-readable copy.**

- subject: `packages/audit-worm/package.json:10`
- verified via: sonnet-single

### `2d576f3822942531` — packages/audit-worm · warn · D3

**SS-3: Key ADRs is a bare numbered list the buyer cannot resolve.**

- subject: `packages/audit-worm/README.md:8-9`
- verified via: sonnet-single

### `451d159a3e533143` — packages/billing · warn · D3

**SS-12: description ends with a bare ADR-id citation.**

- subject: `packages/billing/package.json:10`
- verified via: sonnet-single

### `6fc4564f0e197f46` — packages/cli · warn · D4

**Even with a correct files-allowlist, @caisson/cli's forced-included README.md still names the internal sibling private repo media-pipeline and bare ADR ids to buyers**

- subject: `packages/cli/README.md:3,35`
- verified via: sonnet-single

### `9df433c93ac55256` — packages/cli · warn · D3

**SS-1: footer leaks the sibling private repo name media-pipeline.**

- subject: `packages/cli/README.md:35`
- verified via: sonnet-single

### `4a9c4f27718c87a4` — packages/compliance · warn · D3

**SS-12: description ends with a bare multi-ADR citation.**

- subject: `packages/compliance/package.json:10`
- verified via: sonnet-single

### `a56a0a26aeb9801a` — packages/compliance · warn · D6

**README self-contradicts on the EU AI Act framework: the Surface section calls it the reserved euAiAct slot while the Dependencies section two lines later says all three framework catalogs, including EU AI Act, are authored + golden-pinned.**

- subject: `packages/compliance/README.md:18-19,32-34`
- verified via: sonnet-single

### `fc774e914cccf461` — packages/compliance · warn · D3

**SS-2: registry manifest comments repeat the Stage-2 harvest primitives internal-wave phrase (also packages/compliance/CHANGELOG.md:58).**

- subject: `packages/compliance/manifest.ts:26,53`
- verified via: sonnet-single

### `116ffd232d42ac29` — packages/local-ai · warn · D3

**SS-2: shipped source comment cites an internal fork id (fork P4a-7-D)**

- subject: `packages/local-ai/src/privacy/policy.ts:1`
- verified via: sonnet-single

### `d740b1a214207d52` — packages/local-ai · warn · D3

**SS-2: section header uses a bare internal task id (T13) as if it were product documentation**

- subject: `packages/local-ai/README.md:25`
- verified via: sonnet-single

### `16c095e5302257f0` — packages/local-store · warn · D3

**SS-10: a truncated, mid-sentence duplicate of the opening CI note is left dangling at the end of the file**

- subject: `packages/local-store/README.md:74`
- verified via: sonnet-single

### `b3162ca1c99895df` — packages/local-store · warn · D4

**Shipped manifest exposes the same internal pricing is still a placeholder commentary**

- subject: `packages/local-store/manifest.ts:5-7`
- verified via: sonnet-single

### `fefc3422c1e51489` — packages/mcp-server · warn · D3

**SS-12: the npm/registry-visible description ends in a bare ADR citation with no plain-language content.**

- subject: `packages/mcp-server/package.json:10`
- verified via: sonnet-single

### `72366cad4e881183` — packages/observability · warn · D3

**SS-1/SS-2/SS-11: README uses session shorthand (P6-tail), a dead internal-doc link, and the media-pipeline gridwork-ism.**

- subject: `packages/observability/README.md:6,10-11`
- verified via: sonnet-single

### `722585904581fe1d` — packages/prompt-registry · warn · D3

**SS-12: npm-visible description ends in a bare ADR chain.**

- subject: `packages/prompt-registry/package.json:10`
- verified via: sonnet-single

### `7999820438e8498f` — packages/registry-schema · warn · D3

**SS-12: npm-visible description opens and closes with bare ADR citations.**

- subject: `packages/registry-schema/package.json:10`
- verified via: sonnet-single

### `6019cbd0bdb581f6` — packages/retention-runner · warn · D3

**SS-12: npm-visible description ends in a bare ADR citation.**

- subject: `packages/retention-runner/package.json:10`
- verified via: sonnet-single

### `a183481b2f1af81e` — packages/tenancy-rls · warn · D3

**SS-1: README names two internal/sibling-repo seeds a buyer has no context for**

- subject: `packages/tenancy-rls/README.md:6`
- verified via: sonnet-single

### `c461c5a86beba5b1` — packages/tenancy-rls · warn · D3

**SS-12: package.json description ends in a bare, unframed ADR fragment**

- subject: `packages/tenancy-rls/package.json:10`
- verified via: sonnet-single

### `c9bf66515e2400dc` — packages/tenancy-rls · warn · D3

**SS-11: README links to internal docs paths that do not exist outside this monorepo checkout**

- subject: `packages/tenancy-rls/README.md:9`
- verified via: sonnet-single

### `ee5aaf7222cde6ec` — packages/tenancy-rls · warn · D4

**Seeds (rebuild-clean) line names the private sibling repo gridworkdigital in a buyer-shipped README.**

- subject: `packages/tenancy-rls/README.md:6`
- verified via: sonnet-single

### `f06b8f9b19184aa5` — packages/tenancy-rls · warn · D3

**SS-4: shipped source comment cites an internal issue-tracker id**

- subject: `packages/tenancy-rls/src/rls.ts:220`
- verified via: sonnet-single

### `6ac06de69cf7e54b` — packages/tool-exec · warn · D3

**SS-12: package.json description ends in a bare trailing ADR fragment**

- subject: `packages/tool-exec/package.json:10`
- verified via: sonnet-single

### `7b561d06a02d3725` — packages/tool-exec · warn · D3

**SS-1: README footer names the private sibling repo media-pipeline**

- subject: `packages/tool-exec/README.md:50`
- verified via: sonnet-single

### `3d3b14d00a9deb34` — packages/ui · warn · D3

**SS-11: README links to internal-only paths not part of the published package**

- subject: `packages/ui/README.md:9`
- verified via: sonnet-single

### `9fa29847ab84812a` — packages/ui · warn · D6

**README's one-line description claims the package is a vanilla-extract typed token floor, but the package neither depends on nor uses vanilla-extract anywhere.**

- subject: `packages/ui/README.md:3`
- verified via: sonnet-single

### `aeb15f24c333850a` — packages/ui · warn · D3

**SS-1: README names the private sibling repo tessera as a seed, plus the media-pipeline footer**

- subject: `packages/ui/README.md:6`
- verified via: sonnet-single

### `d037477510358c81` — packages/ui · warn · D4

**Seeds (rebuild-clean) line names the private sibling repo tessera in a buyer-shipped README.**

- subject: `packages/ui/README.md:6`
- verified via: sonnet-single

### `f3e8c0be58d0e540` — packages/ui · warn · D3

**SS-1: exported font-candidate data references the private sibling repo Wardfile**

- subject: `packages/ui/src/tokens/candidates.ts:187`
- verified via: sonnet-single

### `026344ec92e65b2a` — root-docs · warn · D7

**README still lists apps/studio as an active app.**

- subject: `README.md:49`
- verified via: sonnet-single

### `1bbe8d9cf3021b43` — root-docs · warn · D3

**SS-9-style staleness: the root README describes a build state (apps/studio present, Cloudflare Pages hosting, ADRs capped at 0137, editions not yet feature-complete) that no longer matches the repo per CLAUDE.md's own current-state section.**

- subject: `README.md:9-14,40,49,64-72`
- verified via: sonnet-single

### `299d2b36aa8b7754` — root-docs · warn · D6

**Locked vs open section still lists Cloudflare Pages hosting on caisson.sh as a current locked fact; the site moved to Railway**

- subject: `README.md:69`
- verified via: sonnet-single

### `d9b04b6221601a81` — root-docs · warn · D6

**README claims 24 packages under packages/; the tree actually holds 35**

- subject: `README.md:47`
- verified via: sonnet-single

### `e2cb3ed2d64e951b` — root-docs · warn · D6

**DESIGN.md's closing Primitives pointer says Hero/Card/StatusChip/CredentialStrip/EditionCard/SkuMatrix/Icon/Reveal/CodeBlock live in apps/site/components, but they have moved to packages/ui/src/components.**

- subject: `DESIGN.md:134-136`
- verified via: sonnet-single

### `5b0433c2ebab921f` — services/license · warn · D3

**SS-12/SS-2: the package.json description opens with bare kickoff+ADR shorthand (P6, ADR-0089/0017/0071/0108) instead of a plain one-line capability statement.**

- subject: `services/license/package.json:7`
- verified via: sonnet-single

### `847345af56ac0a76` — apps/site · info · D3

**SS-4: changelog entry references PR#35 sibling sweep, an internal GitHub PR number.**

- subject: `apps/site/CHANGELOG.md:57`
- verified via: sonnet-single

### `1206e755b9b121f4` — packages/ai-evals · info · D4

**SS-2: comment cites The T10 fixtures as an internal build-plan reference with no other explanation**

- subject: `packages/ai-evals/src/evals.test.ts:5`
- verified via: sonnet-single

### `8bc45e2e32bdfab6` — packages/audit-worm · info · D3

**SS-2 (judgement call): barrel-file header labels components with internal task ids (T1/T2), (T3), (T4).**

- subject: `packages/audit-worm/src/index.ts:8,10`
- verified via: sonnet-single

### `cd47b80e97685085` — packages/billing · info · D3

**SS-4: shipped comment cites internal Linear issue id CAISSON-5 (companion finding, see packages/credits entry).**

- subject: `packages/credits/src/credits.ts:347`
- verified via: sonnet-single

### `ad2279973aa56176` — packages/compliance · info · D3

**SS-2 (judgement call): the evidence-engine files pervasively label internal components with unexplained task ids (T13), (T14), (T18).**

- subject: `packages/compliance/src/evidence/pack-format.ts:3,12,215 and collector.ts:72,110 and index.ts:42`
- verified via: sonnet-single

### `83861b1f66c4cd27` — packages/guardrails · info · D7

**Missing README.md, inconsistent with all other packages in the cohort.**

- subject: `packages/guardrails`
- verified via: sonnet-single

### `9f68c8ee9c6aea49` — packages/local-ai · info · D3

**SS-2: shipped source comments cite internal task/gate ids (T20, Gate-2)**

- subject: `packages/local-ai/src/inference/bedrock-transport.ts:1-2,6`
- verified via: sonnet-single

### `e46ec3f08e59f46a` — packages/local-store · info · D3

**SS-2: source comment cites an internal plan task id (PLAN T8)**

- subject: `packages/local-store/src/egress-guard.ts:5`
- verified via: sonnet-single

### `10a6650e7a1121ae` — packages/mcp-server · info · D3

**SS-2: shipped source comment names an internal build-wave (the Wave-0 contract) with no definition.**

- subject: `packages/mcp-server/src/server.ts:154`
- verified via: sonnet-single

### `d1b83109f258921e` — packages/mcp-server · info · D3

**SS-2: AGENTS.md scope note defers work to an internal phase label, P5, with no gloss.**

- subject: `packages/mcp-server/AGENTS.md:31`
- verified via: sonnet-single

### `0fe88ed489af10a7` — packages/registry-schema · info · D6

**Publicly-published Apache-2.0 package has no README at all, unlike every sibling package in this audit batch**

- subject: `packages/registry-schema/ (no README.md)`
- verified via: sonnet-single

### `aaf4512f4812dbe5` — packages/retention-runner · info · D3

**SS-2: comment references the source survey as an unexplained internal review process.**

- subject: `packages/retention-runner/AGENTS.md:43`
- verified via: sonnet-single

### `df33298d00152919` — root-docs · info · D6

**Layout section undercounts packages (24 packages) and understates the ADR ledger (ADRs 0001-0137) by roughly a third and by 100 ADRs respectively**

- subject: `README.md:47,53`
- verified via: sonnet-single

---

## 3. CONFIRMED — 99 (20 high · 45 warn · 34 info)

Fixed in this session's per-domain fix wave (see the PR diff); rows the fix agents
reported `propose_accept` or `skipped` instead are enumerated in the PR description and
stay `open` pending the operator.

### `bf4c89b8c3121441` — apps/site · high · D3

**SS-1/SS-4: comments cite the internal pentest tool's codename Strix plus an internal vuln-tracking id (Strix vuln-0006/vuln-0001) as the explanation for a security gate, across at least 7 files.**

- subject: `apps/site/lib/auth.ts:79 (recurs at app/api/byok/route.ts:32, app/dashboard/compliance/page.tsx:26/43/69, app/dashboard/ai-keys/page.tsx:70, lib/ask-ai/handler.ts:103, lib/auth.test.ts:23)`
- verified via: skeptic-agree

### `3688dff361519994` — packages/agent-dev · high · D3

**SS-10/SS-11: the entire README is an 11-line stub with no install/usage snippet and a dead relative link into the monorepo**

- subject: `packages/agent-dev/README.md:9`
- verified via: skeptic-agree

### `fafc234ea93e4090` — packages/ai-evals · high · D3

**SS-1: comment names throughframe, a paused private sibling GridWork repo, as the pattern source**

- subject: `packages/ai-evals/src/reflexivity-queue.ts:1`
- verified via: skeptic-agree

### `d4845f0f9d8e91a7` — packages/audit-worm · high · D4

**A code comment falsely claims the live S3 test file never reaches the published tarball; the package's missing files-allowlist ships it (and AGENTS.md/CHANGELOG.md/manifest.ts) raw to buyers**

- subject: `packages/audit-worm/live/store.s3.live.test.ts:7`
- verified via: skeptic-agree

### `0e1fe15c9ff8da16` — packages/billing · high · D4

**The shipped @caisson/billing CHANGELOG.md names the internal pentest tool and specific internal vulnerability IDs to every buyer who installs the package**

- subject: `packages/billing/CHANGELOG.md:41,54`
- verified via: skeptic-agree

### `8a94468dbc3385e6` — packages/billing · high · D6

**Billing docs and the npm-facing package.json description advertise only Stripe + Paddle drivers, omitting the two LemonSqueezy and Polar BillingProvider drivers that are live and tested (ADR-0175).**

- subject: `packages/billing/README.md:3-4, packages/billing/AGENTS.md:1-5,16-19, packages/billing/package.json:10`
- verified via: skeptic-agree

### `0793dd33b1626d78` — packages/cli · high · D6

**README and AGENTS.md both describe create-caisson as a Wave-0 skeleton where disk materialization is deliberately deferred/out of scope, but the shipped code already writes to disk.**

- subject: `packages/cli/README.md:6-10, packages/cli/AGENTS.md:30-33`
- verified via: skeptic-agree

### `612ef67c4577b758` — packages/field-crypto · high · D4

**Paid package's CHANGELOG discloses internal Linear ticket IDs and implementation details of an unrelated internal-only app**

- subject: `packages/field-crypto/CHANGELOG.md:23-34`
- verified via: skeptic-agree

### `04efb1cd538a09e5` — packages/kernel · high · D3

**SS-9: README's one-line description doesn't match what the package actually ships**

- subject: `packages/kernel/README.md:3`
- verified via: skeptic-agree

### `0bb9a8fdadd9c084` — packages/kernel · high · D4

**Public npm package's CHANGELOG names the pentest vendor and internal vulnerability IDs**

- subject: `packages/kernel/CHANGELOG.md:41`
- verified via: skeptic-agree

### `2e7cb4ab20e4fe4b` — packages/observability · high · D3

**SS-2: release notes read as an internal whole-repo audit log, not what changed in this package.**

- subject: `packages/observability/CHANGELOG.md:7`
- verified via: skeptic-agree

### `f3b633d10ac78349` — packages/pricebook · high · D6

**The package's own Public API documentation omits the entire one-time PURCHASE_BOOK table, the actual live commerce catalog**

- subject: `packages/pricebook/AGENTS.md:16-23 (Public API table) and README.md:9-16`
- verified via: skeptic-agree

### `38f6e29312b04b76` — packages/tenancy-rls · high · D6

**AGENTS.md's usage example calls withTenant with the wrong arity, the real function takes (db, accountId, fn), not (tenantId, fn).**

- subject: `packages/tenancy-rls/AGENTS.md:7`
- verified via: skeptic-agree

### `3c744f43fd38bde4` — packages/tenancy-rls · high · D4

**Comment in shipped RLS source names the internal-only apps/admin app and its admin-read.ts file.**

- subject: `packages/tenancy-rls/src/rls.ts:163`
- verified via: skeptic-agree

### `5acda62ecfb35c61` — packages/ui · high · D4

**Sold-source package doc names the internal-only apps/admin control-plane and its /design gallery route.**

- subject: `packages/ui/RECIPE.md:45`
- verified via: skeptic-agree

### `ac127ba72ea651b7` — packages/ui · high · D3

**SS-14: a thrown runtime error embeds a bare ADR id with no explanation**

- subject: `packages/ui/src/components/money-cell.tsx:24`
- verified via: skeptic-agree

### `a61d6d8c37e71259` — registry/worker · high · D6

**Registry README says Entitlement filtering remains the one P6 item and omits the npm-delivery + revocation surfaces that are already built in registry/worker**

- subject: `registry/README.md:56`
- verified via: skeptic-agree

### `69177803de41c5ad` — services/docs · high · D4

_*The docs corpus ingests README.md from every packages/* dir with no internal-only filter, leaking internal-engineering package docs into the public Ask-AI widget and the unauthenticated GET /llms-full.txt endpoint._*

- subject: `services/docs/src/corpus.ts:115-130`
- verified via: skeptic-agree

### `87fcf09e562b2e71` — services/docs · high · D3

**SS-9/SS-10: the README opens with bare (P6, ADR-0096 / ADR-0009) instead of a plain purpose line, and includes an internal-process blockquote narrating a superseded decision (Supersedes the old scaffold note...) rather than describing the service.**

- subject: `services/docs/README.md:3,12,45`
- verified via: skeptic-agree

### `ab7dd4a9bd7ff506` — services/license · high · D6

**README describes already-shipped features (entitlement resolver, Ed25519 issuer, HTTP transport) as unbuilt Follow-on Bucket-B slices**

- subject: `services/license/README.md:29-31`
- verified via: skeptic-agree

### `60f354f254087a86` — apps/agent-dev · warn · D6

**README describes the reference app as proving three SPEC pillars and never mentions the fourth capability (the agent-runner reference demo) that ADR-0186 added and the CLI entrypoint re-exports.**

- subject: `apps/agent-dev/README.md:5-19`
- verified via: sonnet-single

### `c1727ee4fcaa37df` — apps/agent-dev · warn · D3

**SS-2: file-header comments open with internal phase/task shorthand instead of a plain description**

- subject: `apps/agent-dev/src/demo.ts:1`
- verified via: sonnet-single

### `51f39c00c0c0408a` — apps/ai-kit · warn · D3

**SS-2/SS-12: the app's own headline calls itself the P3 exit artifact**

- subject: `apps/ai-kit/README.md:3`
- verified via: sonnet-single

### `888e038734ac8941` — apps/ai-kit · warn · D3

**SS-2: internal task/phase codes recur as file-header comments across lib/**

- subject: `apps/ai-kit/lib/demo.ts:1`
- verified via: sonnet-single

### `2cd7ac46f2ffdd7b` — apps/base · warn · D3

**SS-2: internal phase/exit-gate labels recur as file-header comments across src/**

- subject: `apps/base/src/app.ts:1`
- verified via: sonnet-single

### `950a2eebd084a0e4` — apps/base · warn · D3

**SS-12: package.json description uses internal phase shorthand (P1 reference)**

- subject: `apps/base/package.json:6`
- verified via: sonnet-single

### `b1de71b8836c7ffc` — apps/base · warn · D3

**SS-2: README uses the repo's internal decision-board term picker**

- subject: `apps/base/README.md:3`
- verified via: sonnet-single

### `b978a148837f9178` — apps/compliance · warn · D3

**SS-1: comment tells real deployments to source key material from the operator's personal gridwork-env path**

- subject: `apps/compliance/lib/harness.ts:39-40`
- verified via: sonnet-single

### `134f5a531161b0b3` — apps/local-ai · warn · D3

**SS-2/SS-3: the file header cites T22, ADR-0044 session-task shorthand, and a later comment explains a doc discrepancy by citing specs/01 section 2, an internal spec file the buyer cannot open.**

- subject: `apps/local-ai/app/demo/pipeline.ts:1,46-49`
- verified via: sonnet-single

### `c26234e55149d03b` — apps/local-ai · warn · D3

**SS-12: the package.json description embeds a bare (ADR-0044) id.**

- subject: `apps/local-ai/package.json:7`
- verified via: sonnet-single

### `d022d6c7a4596245` — apps/site · warn · D3

**SS-2: a migration comment narrates an internal merge-race (wave-6a's billing dedup migration claimed 0010 on main first, second-merger-renumbers) instead of describing what the migration does.**

- subject: `apps/site/lib/deploy-migrate.ts:106-109`
- verified via: sonnet-single

### `0c710b2b0aa7d115` — generator-templates · warn · D4

**Every buyer-generated repo's CI workflow and golden-file test carry code comments citing internal Caisson ADR numbers that reference decision records the buyer never receives.**

- subject: `packages/cli/templates/base/.github/workflows/ci.yml:11`
- verified via: sonnet-single

### `76ba6467e66a421f` — infra/discord · warn · D6

**Script's own runtime message promises a Community-upgrade re-run path that the code never implements**

- subject: `infra/discord/provision.ts:388-397`
- verified via: sonnet-single

### `6efc5c3da5addb5a` — oss-mirror · warn · D3

**SS-2/SS-3: AGENTS.md files ship dense internal wave/phase shorthand and bare ADR ids across nearly every package**

- subject: `packages/cli/AGENTS.md:3`
- verified via: sonnet-single

### `865f1c5cab4e4122` — oss-mirror · warn · D4

**A file-header comment in the shipped migrate package names the private apps/site path and Railway as the internal deploy target.**

- subject: `packages/migrate/src/pg-applier.ts:11-13`
- verified via: sonnet-single

### `a7f243986de1287f` — oss-mirror · warn · D4

**The same unsanitized-prose gap reproduces in every other exported package, not just kernel**

- subject: `/tmp/mirror-audit/packages/billing/README.md:7,10-11 and CHANGELOG.md:41,54 (exported output)`
- verified via: sonnet-single

### `a81226d5469a203a` — oss-mirror · warn · D4

**The shipped Apache-2.0 RLS package's admin-write seam comments name Caisson's private apps/admin control plane, its Cloudflare-Access gate, and Railway as the deploy target.**

- subject: `packages/tenancy-rls/src/rls.ts:163`
- verified via: sonnet-single

### `b21f17c38577ec8b` — oss-mirror · warn · D4

**Package CHANGELOGs ship raw internal-infra migration notes (removed private apps, an internal tool, and an observability-vendor swap) as the public package's own release notes.**

- subject: `packages/ui/CHANGELOG.md:7`
- verified via: sonnet-single

### `e42a5aab205d49b4` — oss-mirror · warn · D3

**SS-3/SS-8/SS-11: ui's RECIPE.md is an internal component-authoring guide shipped verbatim with bare ADR ids, a dead root-doc link, and internal app names**

- subject: `packages/ui/RECIPE.md:3,32,35,45`
- verified via: sonnet-single

### `fcdcfc063b2edc5a` — oss-mirror · warn · D3

**SS-4/SS-2: shipped CHANGELOGs carry raw internal Linear issue ids and harvest/wave shorthand verbatim from commit messages**

- subject: `tooling/testing/CHANGELOG.md:7`
- verified via: sonnet-single

### `6bc29f30382ecb0e` — packages/agent-dev · warn · D6

**publishConfig still points at the retired GitHub-Packages registry the CI pipeline no longer uses**

- subject: `packages/agent-dev/package.json:6-8`
- verified via: sonnet-single

### `98cb2f81f54295f6` — packages/agent-dev · warn · D6

**AGENTS.md's edition description and documented Compose signature omit the live tool-exec gate wired into the composition**

- subject: `packages/agent-dev/AGENTS.md:9-16,29`
- verified via: sonnet-single

### `b9a14ca21b28790f` — packages/agent-dev · warn · D3

**SS-2: changelog entry describes an internal whole-repo audit round and a dated ledger instead of the user-facing change**

- subject: `packages/agent-dev/CHANGELOG.md:49`
- verified via: sonnet-single

### `0d5291a4f6b0edd2` — packages/ai-evals · warn · D6

**Per-package truth table understates ai-evals' test coverage by 6x, contradicting the same doc's own prose**

- subject: `docs/build-state.md:397`
- verified via: sonnet-single

### `bf704c3669238dce` — packages/ai-evals · warn · D3

**SS-2: changelog entry frames the change as an internal whole-repo audit round with a dated ledger reference**

- subject: `packages/ai-evals/CHANGELOG.md:23`
- verified via: sonnet-single

### `c27a0dbcc3324e39` — packages/ai-meter · warn · D3

**SS-2: changelog entry frames a security/correctness fix as an internal whole-repo audit round remediation with a dated ledger**

- subject: `packages/ai-meter/CHANGELOG.md:57`
- verified via: sonnet-single

### `5caf34f3494538ad` — packages/alerting · warn · D3

**SS-2: changelog entry frames a security fix as an internal whole-repo audit round remediation with a dated ledger**

- subject: `packages/alerting/CHANGELOG.md:18`
- verified via: sonnet-single

### `dc608b12c91988e2` — packages/auth · warn · D6

**AGENTS.md instructs using crypto.timingSafeEqual (re-exported via @caisson/kernel), but @caisson/kernel does not export a function of that name.**

- subject: `packages/auth/AGENTS.md:9`
- verified via: sonnet-single

### `c72ebe08d32047e3` — packages/cli · warn · D3

**SS-10: README gives no complete, copy-pasteable install/usage command for the actual CLI a buyer runs.**

- subject: `packages/cli/README.md`
- verified via: sonnet-single

### `929d551dd4cd31fd` — packages/credits · warn · D6

**Credits README/AGENTS.md describe only grant/debit/balance/idempotency, omitting the clawback refund-reversal feature and per-line-item credit tracking that are part of the shipped, tested surface.**

- subject: `packages/credits/README.md:1-10, packages/credits/AGENTS.md:1-15`
- verified via: sonnet-single

### `01c68f570081a94c` — packages/field-crypto · warn · D3

**SS-4: shipped test file comment cites a bare internal issue id (CAISSON-13)**

- subject: `packages/field-crypto/live/kms.live.test.ts:95`
- verified via: sonnet-single

### `755ee6608848de2e` — packages/field-crypto · warn · D3

**SS-12: npm-registry description ends with a standalone bare ADR citation sentence**

- subject: `packages/field-crypto/package.json:10`
- verified via: sonnet-single

### `51b12064d7d333ea` — packages/guardrails · warn · D4

**CHANGELOG exposes the internal whole-repo audit's domain taxonomy and cross-package security-remediation detail**

- subject: `packages/guardrails/CHANGELOG.md:38-47`
- verified via: sonnet-single

### `8c7ba3037f33472f` — packages/guardrails · warn · D3

**SS-2: published CHANGELOG narrates internal audit-round/ledger process instead of describing the change**

- subject: `packages/guardrails/CHANGELOG.md:38,46-47`
- verified via: sonnet-single

### `fb6971740a4005bd` — packages/guardrails · warn · D3

**SS-2: file header cites an internal sweep-item shorthand (lift-sweep #13)**

- subject: `packages/guardrails/src/ftc4p.ts:1`
- verified via: sonnet-single

### `21ff036e4c6108a5` — packages/migrate · warn · D6

**The Public API table omits the @caisson/migrate/pg subpath export (pgMigrationApplier), a real published API surface**

- subject: `packages/migrate/AGENTS.md:16-23 (Public API table)`
- verified via: sonnet-single

### `ee3fd1b8da11cfba` — packages/observability · warn · D4

**Published changeset entry names the internal-only apps/admin app, the audit-harness tool, and the retired SigNoz vendor.**

- subject: `packages/observability/CHANGELOG.md:7`
- verified via: sonnet-single

### `1a44d5fdd66c9337` — packages/registry-schema · warn · D3

**SS-8: comment references the internal-only path tooling/standards-gate, unresolvable to a buyer of this oss package.**

- subject: `packages/registry-schema/src/entitlements.ts:135`
- verified via: sonnet-single

### `1773a85ce862b2d7` — packages/ui · warn · D3

**SS-2: source comment uses internal process/date shorthand for a locked design choice**

- subject: `packages/ui/src/tokens/theme.ts:2`
- verified via: sonnet-single

### `737984b4dd4201cb` — packages/ui · warn · D4

**Published CHANGELOG.md names internal observability vendors (SigNoz/Grafana Cloud), apps/admin, and the GitHub org rename.**

- subject: `packages/ui/CHANGELOG.md:7`
- verified via: sonnet-single

### `fe849725c0b279fc` — packages/ui · warn · D6

**AGENTS.md's Scope section says Component implementations are out of scope for this package, directly contradicted by the package's own contents and RECIPE.md.**

- subject: `packages/ui/AGENTS.md:14`
- verified via: sonnet-single

### `420a8d485db3b71a` — root-docs · warn · D6

**Root README's Build-status table calls mcp-server/license-verify/email/jobs/ui partial / scaffolded, contradicted by docs/build-state.md's per-package rows**

- subject: `README.md:41`
- verified via: sonnet-single

### `5b24ffbd6746cf4c` — services/docs · warn · D3

**SS-12/SS-2: the package.json description opens with bare (P6, ADR-0096/0009) kickoff+ADR shorthand.**

- subject: `services/docs/package.json:7`
- verified via: sonnet-single

### `646c5e90dc6ab8aa` — tools/strix · warn · D6

**README table says apply-patches.sh re-applies the 2 installed-package patches but the script now applies 3**

- subject: `tools/strix/README.md:24`
- verified via: sonnet-single

### `8d02a6efde2a502e` — workflows · warn · D6

**Header comment claims THIS FILE = THE 3 REQUIRED STATUS CHECKS ONLY but the file defines a 4th job, oscal-conformance, which is also a required check**

- subject: `.github/workflows/ci.yml:14-15`
- verified via: sonnet-single

### `2e55c3193abbc678` — apps/agent-dev · info · D3

**SS-2/SS-3: README and source comments assume the buyer can read an internal SPEC**

- subject: `apps/agent-dev/README.md:5`
- verified via: sonnet-single

### `088aad96422bd006` — apps/base · info · D3

**SS-2/SS-4: CHANGELOG cites an internal spec name and a bare numeric fragment**

- subject: `apps/base/CHANGELOG.md:5`
- verified via: sonnet-single

### `f3f24f2dce8cf3e7` — apps/base · info · D6

**apps/base's README says Structure only for now but the app has a real, tested implementation (402 grant 200 MCP loop)**

- subject: `apps/base/README.md:1-4`
- verified via: sonnet-single

### `1d027b87d984b1b9` — apps/compliance · info · D2

**A code comment names the operator's private gridwork-env secrets-file convention inside a reference-app package.**

- subject: `apps/compliance/lib/harness.ts:40`
- verified via: sonnet-single

### `56ff2533405e472c` — apps/compliance · info · D4

**Rendered reference-app copy tells the viewer to run a monorepo-relative test command they don't have.**

- subject: `apps/compliance/app/page.tsx:32-33`
- verified via: sonnet-single

### `b1369604c1d3317c` — apps/compliance · info · D3

**SS-2: README opens with the internal phase label the P2 exit artifact**

- subject: `apps/compliance/README.md:3`
- verified via: sonnet-single

### `742477c5ca9dfc96` — apps/local-ai · info · D3

**SS-4: changelog entry references the PR#35 sibling sweep.**

- subject: `apps/local-ai/CHANGELOG.md:14`
- verified via: sonnet-single

### `8a5e9f7e742f9f73` — apps/site · info · D3

**SS-2: header cites an internal fork id (seam 5, ADR-0224 F4=A) and the F4=A build-grep leg the operator locked, session/decision-process shorthand.**

- subject: `apps/site/live/analytics-bundle.live.test.ts:1,6`
- verified via: sonnet-single

### `f601b09d48be33bf` — infra/discord · info · D1

**provision.ts uses raw fetch with AbortSignal.timeout() instead of the repo's mandatory fetchWithTimeout helper.**

- subject: `infra/discord/provision.ts:76`
- verified via: sonnet-single

### `7023e53bc240b60f` — oss-mirror · info · D4

**Shipped source comments across nearly every exported file cite internal ADR decision-log numbers and the private gridwork-core security floor as if the buyer shares that corpus.**

- subject: `packages/kernel/src/crypto.ts:1`
- verified via: sonnet-single

### `95d02c5d74fd5f28` — oss-mirror · info · D3

**SS-1/SS-2: the testing tool's npm description cites the internal workstream label D9**

- subject: `tooling/testing/package.json:6`
- verified via: sonnet-single

### `061b34f25bdeec23` — packages/agent-dev · info · D6

**Manifest bundles @caisson/agent-runner as a wired dependency but the composition factory never imports or exposes it**

- subject: `packages/agent-dev/manifest.ts:25,42`
- verified via: sonnet-single

### `3aa54d2918b1a7e2` — packages/agent-dev · info · D6

**Per-package truth table's test-file count for agent-dev is stale**

- subject: `docs/build-state.md:404`
- verified via: sonnet-single

### `f5d1a436c274c942` — packages/ai-meter · info · D6

**Per-package truth table's file/loc counts for ai-meter are stale relative to the shipped dedup module**

- subject: `docs/build-state.md:396`
- verified via: sonnet-single

### `1a8085ec4c98fa21` — packages/auth · info · D3

**SS-2: shipped CHANGELOG narrates internal audit-round and wave shorthand instead of user-facing release notes.**

- subject: `packages/auth/CHANGELOG.md:24-34`
- verified via: sonnet-single

### `0639b8173ae4768d` — packages/billing · info · D3

**SS-2 (judgement call): comments cite internal pentest/review-tool artifacts Strix vuln-0005/vuln-0002 and Greptile P1 as provenance.**

- subject: `packages/billing/src/paddle-events.ts:110,116,263 and polar.ts:173`
- verified via: sonnet-single

### `c4097ab825dfcb83` — packages/cli · info · D3

**SS-2 (judgement call): entry-point comment cites internal work-item shorthand (ADR-0095 W3).**

- subject: `packages/cli/src/cli.ts:6`
- verified via: sonnet-single

### `2f6160645242dea0` — packages/observability · info · D4

**Shipped Apache-2.0 test fixture hardcodes the operator's own first name as an example email.**

- subject: `packages/observability/src/scrub.test.ts:21`
- verified via: sonnet-single

### `feae61c4e4889dfd` — packages/pricebook · info · D6

**package.json description field says stripePriceId, stale relative to the Stripe-to-Paddle rename (ADR-0108) that every other doc in the package correctly reflects**

- subject: `packages/pricebook/package.json:10`
- verified via: sonnet-single

### `081a027da55d6847` — packages/prompt-registry · info · D4

**Commercial-package changelog names the internal-only AUDIT_DOMAINS constant and internal audit-round codenames.**

- subject: `packages/prompt-registry/CHANGELOG.md:32`
- verified via: sonnet-single

### `ad010ce3aa0aea1e` — packages/registry-schema · info · D3

**SS-2: test comment references the pre-rename package scope @stack and Wave-0 build-wave shorthand.**

- subject: `packages/registry-schema/src/module-id.test.ts:1`
- verified via: sonnet-single

### `c5754b682ea59114` — packages/registry-schema · info · D4

**Apache-2.0-shipped docstring references the internal-only tooling/standards-gate authority by path.**

- subject: `packages/registry-schema/src/entitlements.ts:135`
- verified via: sonnet-single

### `b6db53d444ee29c4` — packages/tenancy-rls · info · D3

**SS-2/SS-4: CHANGELOG entries use internal wave/session language and issue ids, and ship in the npm tarball**

- subject: `packages/tenancy-rls/CHANGELOG.md:45`
- verified via: sonnet-single

### `b2115d8791210336` — packages/ui · info · D4

**Locked-token comment frames the palette choice as an operator pick with an internal decision date, in buyer-shipped source.**

- subject: `packages/ui/src/tokens/theme.ts:2`
- verified via: sonnet-single

### `45b4b5f98f3f4d65` — registry/worker · info · D2

**Real Cloudflare account id is hardcoded in a comment instead of referenced by name only**

- subject: `registry/worker/deploy.sh:11`
- verified via: sonnet-single

### `598aedb9035ba761` — root-docs · info · D2

**A local operator filesystem path is disclosed in a committed doc.**

- subject: `SUMMARY.md:116`
- verified via: sonnet-single

### `6b0964bd12792fd7` — root-docs · info · D2

**Committed doc leaks the operator's private local filesystem path (username plus directory layout).**

- subject: `SUMMARY.md:116`
- verified via: sonnet-single

### `96e4203f18788b18` — root-docs · info · D2

**SUMMARY.md embeds the operator's absolute local filesystem path (/home/gw/lab/library-research/).**

- subject: `SUMMARY.md:116`
- verified via: sonnet-single

### `aaa844e9211e15ac` — root-docs · info · D6

**plan.md's P6 status claims the Ed25519 license issuer is Remaining (only verify exists), but the issuer was built and shipped.**

- subject: `plan.md:130-131`
- verified via: sonnet-single

### `e40331bed09f5843` — root-docs · info · D4

**Root planning docs name every sibling private repo (gridwork, gridwork-core, tessera, health-service, prospector, Wardfile, gwdigital, media-pipeline), but confirmed no shipped or public surface ingests them**

- subject: `SUMMARY.md:40-41,55-59; plan.md:34,48,51,95-96`
- verified via: sonnet-single

### `f5f0d6ae1829b389` — root-docs · info · D2

**Root CLAUDE.md names the operator's private secrets-file convention and path (~/.gridwork/caisson.env, ~/.gridwork/env) in checked-in prose.**

- subject: `CLAUDE.md:81`
- verified via: sonnet-single

### `92bb208a5c75774e` — services/docs · info · D2

**railway.toml's deploy-config comment names the operator's private env path (~/.gridwork/env) as the source of the DOCS_SERVICE_TOKEN value.**

- subject: `services/docs/railway.toml:9`
- verified via: sonnet-single

### `c90bf1b2dd1c4a20` — services/support-bot · info · D3

**SS-1: the gridwork security floor phrase leaks into a shipped service docstring**

- subject: `services/support-bot/src/caisson_support_bot/config.py:3`
- verified via: sonnet-single

### `9333ba6c05756dbf` — workflows · info · D6

**Step is still labeled build site (static export) after the file's own header says the static export no longer exists**

- subject: `.github/workflows/lighthouse.yml:26`
- verified via: sonnet-single

---

## 4. Final disposition (post fix-wave + reconcile)

Reconcile result: **264 open -> 5 open · 0 open-high** (259 closed · 5 unchanged · 0 new ·
0 regressed; ledger now 936 fixed / 5 open of 941).

### Operator batch list — proposed open->accepted (ONLY the operator hand-edits these)

- `e40331bed09f5843` (root-docs, info) — SUMMARY.md/plan.md name the sibling private seed
  repos. Proposed ACCEPT: internal root planning docs, never shipped, never exported (the
  mirror exporter has no path to them); the provenance record is intentional (pro-private
  firewall documentation). Accepting records the leak as deliberate.

### Still open with a named trigger (Kickoff A owns the docs tree — split-by-tree lock)

- `3aa54d2918b1a7e2` / `0d5291a4f6b0edd2` / `f5d1a436c274c942` — docs/build-state.md
  per-package truth-table counts stale (agent-dev tests, ai-evals coverage 6x, ai-meter).
  Trigger: Kickoff A build-state banner/table refresh.
- `f5f0d6ae1829b389` — CLAUDE.md:81 names the operator env-file path. Trigger: Kickoff A
  CLAUDE.md trim (program-spec row #3); also a candidate for the accept list (internal-only
  file).

### Closed as stale during the fix wave (beyond the verifier verdicts)

- `755ee6608848de2e` (packages/field-crypto) — fix agent found the package.json description
  already clean at HEAD; nothing to fix, closed by reconcile absence.
