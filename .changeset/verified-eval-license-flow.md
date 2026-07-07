---
"@caisson/service-license": patch
---

Add a verified, time-boxed evaluation-license flow. An applicant is scored on their
work-email domain — free-mail and disposable domains are rejected outright, and a hybrid
risk score (mail-exchange presence, domain age, an optional enrichment lookup) routes the
rest to auto-approve, an operator review queue, or auto-reject, with every uncertain signal
widening toward review rather than approval. An approved, card-validated applicant can then
be issued a short-lived license that carries its own expiry: it unlocks the evaluated modules
for the window and falls back to the free tier automatically when the window ends or the
evaluation is revoked. The service health response also gains an index digest + entry count
so a drift probe can confirm the deployed registry-index copies agree. Private package only;
no publishable release.
