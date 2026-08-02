---
"@caisson/local-store": minor
"@caisson/site": patch
---

The Reciprocal Rank Fusion arithmetic is now a public function, `fuseByRrf`, exported from the main
entry alongside `RRF_K` and from a new browser-safe `./browser` entry point. Hand it leg rankings
your server or worker already produced and it returns the fused ranking — the same function
`hybridSearch` merges its vector and keyword legs through, so there is one implementation rather
than a formula restated per call site, and it runs inside a client bundle. Retrieval itself stays
on the main entry: the vec0 KNN and FTS5 legs need SQLite and its vector extension. Ranking,
scores, and tie-breaks are unchanged. The site's local-store interactive demo now runs that real
fusion instead of a hand-maintained copy.
