---
"@caisson/registry-schema": patch
---

An entitlement compatibility edge that cannot be resolved no longer discards the buyer's whole entitlement set. Previously one unresolvable edge threw, which dropped a paying customer to the free base floor; now only that edge is skipped and everything else the purchase grants is kept. Skipping cannot over-grant, because an unresolvable target is not a servable module for anyone.
