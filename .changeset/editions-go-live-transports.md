---
"@caisson/audit-worm": minor
"@caisson/ai-kit": minor
"@caisson/local-ai": minor
"@caisson/compliance": minor
---

Editions go live (ADR-0187 + ADR-0201/0202): live transports proven + retention escalation + support impersonation.

- `@caisson/audit-worm`: `extendRetention` on the `ArtifactStore` port (strictly-monotonic, never
  shortens — ADR-0202), `escalateToCompliance` on the S3 backend behind the ADR-0051 three-belt gate,
  and the chain-evidenced `escalateRetention` helper (`retention.escalated` on the tenant chain;
  a chain-append failure fails the whole operation loudly). Live S3 Object-Lock proof in `live/`
  (`test:live`, self-skipping — ADR-0201).
- `@caisson/ai-kit`: `openrouter`/`local`/`ollama` provider lanes moved to
  `@ai-sdk/openai-compatible`, fixing the AI SDK v5 Responses-API default that would have POSTed
  live calls to `{baseURL}/responses` instead of `/chat/completions`; a baseUrl-less `local`/`ollama`
  lane now fails closed instead of silently calling api.openai.com. Live gateway proof in `live/`.
- `@caisson/local-ai`: `createOpenRouterRentedTransport` — the hosted (non-BYOK, fully-metered)
  rented lane over OpenRouter's OpenAI-compatible wire, egress-guarded and strict-revalidated.
  Live rented + availability-gated ONNX proofs in `live/`.
- `@caisson/compliance`: the support-impersonation kernel with a dual audit trail (ADR-0187) —
  time-bounded, reason-required sessions; operator + acting-as-tenant records linked by `sessionId`
  on the target tenant's WORM-anchored chain; `impersonation_session` migration (RLS + column-scoped
  GRANT); the impersonation evidence collector cited by both the SOC2 and HIPAA plans.
