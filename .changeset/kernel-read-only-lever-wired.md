---
"@caisson/kernel": patch
---

The read-only mutation gate's documentation now reflects its live wiring: the admin
service's operator maintenance lever is the mode source that feeds `assertNotReadOnly`.
The gate's behavior is unchanged; the mode is never derived from billing or dunning
state — a past-due subscription keeps full access.
