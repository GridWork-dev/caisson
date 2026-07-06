---
"@caisson/audit-worm": minor
---

Added two more WORM `ArtifactStore` backends alongside S3: `GcsArtifactStore` (Google Cloud
Storage, using per-object Object Retention Lock) and `R2ArtifactStore` (Cloudflare R2, using its
S3-compatible data plane plus a bucket-lock retention rule instead of S3 Object Lock, which R2
does not support). Both fail closed at construction and on every write when the target bucket
cannot actually guarantee the requested retention, never silently under-retaining. Neither
dependency list grew: GCS talks REST directly over the existing `fetchWithTimeout` helper with a
small hand-rolled service-account OAuth exchange, and R2 reuses the already-shipped
`@aws-sdk/client-s3` wiring for its data plane.
