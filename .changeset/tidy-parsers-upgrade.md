---
"@caisson/site": patch
---

The HTML parser behind the weekly regulatory-claim watch moves to its current major line, so the
watch stays on a maintained parser. Entity decoding, comments, and hidden and implicitly closed
subtrees retain the previous extraction behavior. The parser now treats iframe, xmp, plaintext,
noembed, and noframes as raw text; the watch excludes those element bodies from evidence and routes
malformed raw-text pages with no extractable text to manual review. Golden fixtures pin the new
behavior. The watch reads the same sources and stays advisory-only.
