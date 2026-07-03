---
"@caisson/pricebook": patch
---

Drop the four edition-core a-la-carte purchase rows: compliance/ai-kit/local-ai/agent-dev module SKUs named their own edition entitlement id and expanded to the whole parent edition; no separable core artifact exists. Their PLACEHOLDER + REAL sandbox price-id rows are removed and resolvePurchase now fails closed on the retired ids. 11 standalone module rows remain.
