---
"@caisson/ds-manifest": patch
---

The colour-contrast check now treats an unmeasurable pair as a failure rather than a pass. A ratio that cannot be computed made every comparison against the minimum come out false, so such a pair would have been reported as compliant; the check now requires a ratio to be at or above the minimum before it passes.
