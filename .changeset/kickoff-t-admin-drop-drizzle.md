---
"@caisson/admin": patch
---

Drop the unused drizzle-orm dependency from apps/admin (Kickoff T task 8 non-gated leg). No admin
source imports it; knip could not flag it because better-auth declares drizzle-orm as an optional
peerDependency, which knip counts as a legitimate reference.
