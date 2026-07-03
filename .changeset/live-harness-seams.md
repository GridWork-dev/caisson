---
"@caisson/billing": patch
---

Live-verification harness: self-skipping `live/` proofs for the
five production-wired external seams, run after a launch key rotation to prove the rotated
credentials work end-to-end. Test files + `test:live` scripts only — no product code changed.

billing carries seam 1's `live/paddle-webhook.live.test.ts` (a webhook simulator plus Playwright legs
against the real Paddle surface); the other four seams live under `services/*` and `apps/*`
(exempt) plus the support-bot pytest `live` marker. No runtime behavior change for buyers.
