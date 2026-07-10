---
"@caisson/local-store": patch
---

Fixed a retrieval bug that silently killed the FTS leg of hybrid search for every multi-word
query: caller text was wrapped as a single FTS5 phrase, which required all the query's tokens to
appear adjacent and in order in a document. A natural-language query like "refund policy" or
"how do I install" matched zero rows, leaving retrieval to the vector leg alone (or returning
nothing on the FTS floor). Queries are now sanitized per token — each whitespace-split token is
individually quoted and OR-joined — so FTS operators in caller text stay inert while multi-word
queries match documents containing any of the terms, ranked by bm25.
