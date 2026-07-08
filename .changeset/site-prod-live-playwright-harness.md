---
"@caisson/site": patch
---

Added a Playwright-based production verification harness: a real browser drives every major
site route (home, marketplace, pricing, updates, docs, legal pages, sign-in, a sample of module
pages) and the signed-in buyer dashboard, checking that each page renders cleanly with no
console errors. It runs on demand against the live site to catch a deploy-time regression before
a buyer hits it — no product code changed, no runtime behavior change for buyers.
