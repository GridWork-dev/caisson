# SECURITY — `services/docs` (Act 7 conditional audit, tag `auth`)

`gw-security-auditor` on `services/docs/src/*.ts` vs the gridwork security floor (`identity/security.md`),
branch `feature/p6-docs-service` @ `69e6a71`.

## Verdict: **PASS — 0 findings** (no BLOCKER, no WARNING). Ship-clear.

| Focus                        | Site                                              | Result                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bearer auth on `POST /query` | `app.ts:46-53`, `server.ts:20-25`                 | `timingSafeEqual` only; equal-length guard short-circuits via `&&` before the compare (no length-mismatch throw side-channel); fail-closed both layers (empty token → `false`; unset env → startup throws); auth runs before parse/retrieval. The two `===` are the length guard + the empty-token guard, neither on secret bytes. Floor's fixed-length timing-safe pattern, correctly. |
| Input validation             | `app.ts:19-25,82-98`                              | `z.object().strict()` → 400 on unknown field; invalid JSON → 400; `query` ≤2000, `k` 1-20 — bounded before retrieval.                                                                                                                                                                                                                                                                   |
| FTS/SQL injection            | `index-store.ts` + local-store `store.ts:201-229` | No raw SQL in services/docs; only `upsert`/`hybridSearch`. FTS leg is parameterized (`MATCH ?`) + `sanitizeFts` quoted-phrase escaping. Double-protected.                                                                                                                                                                                                                               |
| Path safety                  | `corpus.ts:30-124`                                | Fixed-root sorted enumeration; no request input reaches a filesystem path. No traversal.                                                                                                                                                                                                                                                                                                |
| Security headers             | `app.ts:27-43`                                    | nosniff / frame-deny / HSTS on every response via the single `respond()` chokepoint; no CORS (server-to-server, correct).                                                                                                                                                                                                                                                               |
| Secrets / outbound           | whole service                                     | No outbound fetch (real embedder is a deferred seam); no hardcoded secrets; no `console.*`; no `any` in product code; token from env only.                                                                                                                                                                                                                                              |

**Informational (non-findings):** the length-guard leaks token byte-length via timing — negligible for a
high-entropy opaque token, floor-prescribed. `new RegExp` in `chunk.ts` is built from hardcoded literals
over trusted repo docs (no request input → no ReDoS surface). `sha256` is for vector bucketing + content
hashing, not secret comparison.

Full transcript: dispatched audit, 2026-06-29.
