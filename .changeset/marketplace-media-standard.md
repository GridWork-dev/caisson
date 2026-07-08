---
"@caisson/site": patch
---

Marketplace media standard (ADR-0290): every one of the 28 catalog items (22 modules + 6 bundles)
now renders real media in the marketplace card viewer and module depth pages — closing the prior
8/28 media gap to 28/28 on one standardized framed-slide template (a chrome bar + body mirroring the
homepage-terminal aesthetic). Content preference per item: the actual live `@caisson/ui-pro`
component the item ships (ui-pro's data grid + audit timeline, rendered presentationally — no slide
pulls interactive state); the item's real depth-page code artifact (the eight modules that already
carry one — alerting, ai-meter, ai-evals, guardrails, prompt-registry, local-store, agent-kernel,
agent-runner — rendered through the same framed `CodeBlock` the homepage uses); or an authored
mechanism/composition diagram for everything else. Every bundle now leads with a composition slide
naming its own real member modules composing onto the Apache-2.0 audited base (the Everything bundle
reuses the whole-catalog hero artifact), and eight new authored diagrams close the gap for the
remaining concept-only modules (credits, local-sync, local-inference, local-privacy, tool-exec,
org-controls, billing-orchestration, frameworks-pack). The single existing audit-worm Remotion video
slide is replaced by a static code-artifact slide for uniformity — the Remotion pipeline itself is
untouched and stays available, just unused by the marketplace launch set. A `code-artifact` slide now
counts toward the MEDIA facet on the same footing as a diagram or a live component.
