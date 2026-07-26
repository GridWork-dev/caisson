---
"@caisson/site": patch
---

Generate the docs source module before running the site test suite. One test file reaches the docs
source through the trust-signals helper, and that module is produced by the app build rather than
checked in. Nothing ordered the build ahead of the tests, so the suite passed or failed on whether a
previous build happened to leave the artifact behind. Generating it in the test script takes a few
milliseconds and makes the run self-sufficient.
