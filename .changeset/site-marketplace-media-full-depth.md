---
"@caisson/site": patch
---

ADR-0308 marketplace media full-depth: every catalog module's media carousel now carries all applicable slide kinds. Live-component slides are added for the modules that genuinely ship a showable @caisson/ui surface: audit-worm (ChainViewer), ai-meter (UsageChart), prompt-registry (PromptBrowser), and local-store (StoreSearch) render their own embeddable /ui component, and credits renders the buyer-dashboard ledger surface (LedgerList/MetricStat). The component slide leads each carousel, ahead of the existing code-artifact and mechanism-diagram slides. Every slide depicts shipped behaviour under the ADR-0082 honest floor - concept-only modules stay diagram-only, and ui-pro (the 22nd module) stays component-only. Private package only; no publishable release.
