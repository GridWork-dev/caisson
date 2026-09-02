---
"@caisson/admin": patch
"@caisson/service-license": patch
---

The registry index digest on the license service's and the operator control-plane's health endpoints no longer depends on the edge origin-secret header. That header proves the request arrived through the front-door edge layer, not who is asking, and the edge layer injects it into every request that goes through it — so every ordinary public caller was already getting the field, and only a caller reaching the raw platform origin directly saw a bare status. The digest itself is a hash of a file the module registry already serves publicly, so there was nothing left for the header to protect. Both endpoints now return the digest and entry count to every caller whenever the underlying index file is present and readable; an unreadable or missing file is still the only reason the fields are omitted.
