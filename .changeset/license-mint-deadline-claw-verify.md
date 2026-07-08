---
"@caisson/service-license": patch
---

Bound the post-commit license mint (fired synchronously in the Paddle webhook response path) with
a 5-second deadline. A hung signer — the local Ed25519 signer never blocks, but a future KMS-backed
one could — now times out cleanly instead of hanging forever, preserving the never-5xx contract;
the mint failure is logged and the receipt simply omits the token, same as any other mint failure
(the buyer's next grant/renewal, or the admin first-mint lever, recovers it). This bounds the hang;
it does not guarantee staying inside Paddle's own webhook timeout on a slow signer, since the
deadline stacks on top of the grant transaction that already ran — a redundant, idempotent retry
from Paddle may still occur.
