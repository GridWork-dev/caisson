---
"@caisson/site": patch
---

Document three module surfaces that previously had no guide, and correct two metering examples.

New: a getting-started guide for the OSCAL module covering the evidence-pack round trip, XML
conversion, the ISO 27001 statement of applicability, and control-id lookup against the pinned
NIST catalog. New: an end-to-end tutorial for the governed agent loop, covering approval-gated
tools, the parked result, the operator approve and deny flow, resume behaviour, and every failure
code the loop can return. Added to the field-encryption page: a migration section for callers
upgrading from a pre-1.0 release, covering the borrowed-key callback that replaced direct key
derivation, the runner change, and the key-store interface addition.

The metering quickstart named a model with no entry in the bundled price book, so pasting it
raised a configuration error before the first call. Both examples now name a priced model, and the
agent-loop guide states the requirement so the failure is diagnosable rather than surprising.
