# SECURITY — `services/docs` (Act 7 conditional audit, tag `auth`)

`gw-security-auditor` on `services/docs/src/*.ts` vs the gridwork security floor (`identity/security.md`),
branch `feature/p6-docs-service` @ `69e6a71`.

## Verdict: **PASS — 0 findings** (no BLOCKER, no WARNING). Ship-clear.

| Focus                        | Site                                              | Result                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bearer auth on `POST /query` | `app.ts:authorized`, `server.ts`                  | **SHA-256-digest both sides → `timingSafeEqual`** (floor VARIABLE-LENGTH rule — `DOCS_SERVICE_TOKEN` is opaque, not-guaranteed-fixed length); no length guard, so no byte-length timing leak. Fail-closed both layers (empty token → `false`; unset env → startup throws); auth runs before parse/retrieval. |
| Input validation             | `app.ts:19-25,82-98`                              | `z.object().strict()` → 400 on unknown field; invalid JSON → 400; `query` ≤2000, `k` 1-20 — bounded before retrieval.                                                                                                                                                                                        |
| FTS/SQL injection            | `index-store.ts` + local-store `store.ts:201-229` | No raw SQL in services/docs; only `upsert`/`hybridSearch`. FTS leg is parameterized (`MATCH ?`) + `sanitizeFts` quoted-phrase escaping. Double-protected.                                                                                                                                                    |
| Path safety                  | `corpus.ts:30-124`                                | Fixed-root sorted enumeration; no request input reaches a filesystem path. No traversal.                                                                                                                                                                                                                     |
| Security headers             | `app.ts:27-43`                                    | nosniff / frame-deny / HSTS on every response via the single `respond()` chokepoint; no CORS (server-to-server, correct).                                                                                                                                                                                    |
| Secrets / outbound           | whole service                                     | No outbound fetch (real embedder is a deferred seam); no hardcoded secrets; no `console.*`; no `any` in product code; token from env only.                                                                                                                                                                   |

**Post-audit refinement (Greptile P1, applied pre-merge).** The first auditor pass classified the token as
fixed-length and blessed an `a.length === b.length && timingSafeEqual` guard. Greptile correctly flagged
that the equal-length short-circuit leaks the token's byte length to a remote timing oracle (O(log n) length
search) and that an opaque Bearer of non-guaranteed-fixed length falls under the floor's **variable-length**
rule. Fix applied: both sides SHA-256-digested to fixed 32-byte buffers before `timingSafeEqual`,
eliminating the guard and the leak. Greptile's other two findings — unused `@caisson/kernel` dep; `PORT=""`
→ `Number("")=0` via `??` — also fixed pre-merge.

**Informational (non-findings):** `new RegExp` in `chunk.ts` is built from hardcoded literals over trusted
repo docs (no request input → no ReDoS surface). `sha256` for chunk-id/vector bucketing is content hashing,
not secret comparison.

Full transcript: dispatched audit, 2026-06-29.
