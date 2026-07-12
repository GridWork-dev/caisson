---
"@caisson/local-store": minor
---

`hybridSearch` gains an `ftsWeight` option (CAISSON-83): the FTS leg's reciprocal-rank
contribution is scaled by `ftsWeight / (RRF_K + rank)` so callers can damp or boost
lexical matches against the vector leg without forking the fusion. Default is 1 —
byte-identical scores to the previous behavior — and a non-positive or non-finite
weight throws a ValidationError.
