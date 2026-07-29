---
"@caisson/service-docs": patch
---

Plain price questions now retrieve the right price. Asking "how much is the Compliance bundle" or "what does it cost to renew Compliance" used to return no priced answer at all — the generated catalog headings read "Compliance — $1,649", which shares no word with "how much" or "cost", and the keyword floor has no synonyms. Each bundle now carries a one-line answer in the buyer's own words, including the renewal figure.

Answering in the buyer's words was not sufficient on its own. Every bundle's member list travelled in the same block as its price, and the longest lists were pushed down the ranking by their own length, so a question about one bundle could still be answered with a different bundle's price. Each bundle's price and its member list are now separate blocks, and the retrieval checks pin the expected figure rather than merely the page, so a question answered with the wrong bundle's number fails.

The retrieval checks also build the corpus the way the running service does, with the generated pricing content included; they previously omitted it, which is why these failures reached production with the suite green.
