# S8 publish-image gate repair — R324

Tags: infra, security, external-system. Tier: STANDARD.

Goal: restore the full image-publication gate on the cockpit-selected runner without removing checks or publishing during the experiment. R324 authorizes this separate pipeline PR off origin/main 0b2046e7, a branch red/green mutation measured from the gates step conclusion, then hold for cockpit merge. Release train stays blocked until the first green publish-image run on main.

Evidence: Sep 2 run 33642937584 six gates success on distinct Blacksmith 4-vCPU VMs. Sep 10 run 34431098568 six gates also success, three subsequent Docker build failures; site test-summary totals 7,264 vs 7,265. Sep 14 run 34877205333 six cancelled gates on distinct ubicloud-standard-2 VMs. Site runner shutdown signal precedes SIGTERM and exit 137. No direct OOM proof yet. Workflow matrix fail-fast is false and workflow cancel-in-progress false, so sibling failure is not configured to cancel peers.

Acceptance: retain all deploy/gates.sh checks; use the same script on the branch and publisher, same runner expression and version inputs; capture memory pressure before any failure; baseline original gate is predicted cancelled/failure, then bounded concurrency predicted success. Both actual step conclusions must be recorded. A counterexample stops for ruling. No image push, credentialed auth, deployment or release occurs in the branch experiment.
