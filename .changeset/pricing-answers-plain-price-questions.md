---
"@caisson/service-docs": patch
---

Plain price questions now retrieve the price. Asking "how much is the Compliance bundle" or "what does it cost to renew Compliance" used to return no priced answer at all — the generated catalog headings read "Compliance — $1,649", which shares no word with "how much" or "cost", and the keyword floor has no synonyms. Each bundle now carries a one-line answer in the buyer's own words, including the renewal figure, so the chunk that holds the number is also the chunk that matches the question. The retrieval goldens build the corpus the way the running service does, with the generated pricing sources included; they previously omitted them, which is why every one of these failures reached production with the suite green.
