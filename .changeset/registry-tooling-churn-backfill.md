---
"@caisson/registry": patch
---

The version-publish step now re-verifies every previously recorded package tarball reproduces its advertised bytes, closing a gap where a single-shot release could skip that check entirely. A new maintenance tool backfills older package versions into object storage when their tarball was never uploaded, resolving each historical version from its source history and refusing to upload anything that does not byte-match the advertised checksum.
