---
"@caisson/ai-evals": patch
---

Eval-science depth (ADR-0208, harvest slice-2): a dependency-free exit-reason classifier
(`classifyExit`), an opt-in Wilson-CI confidence-floor gate augmentation (`wilsonFloor` on
`DefineEvalConfig`/`EvalRun`, additive — unset is zero behavior change), a budget-isolated
eval-spend ledger (`recordEvalSpend`, never touches `@caisson/ai-meter`), a production
judge/human reflexivity queue (`captureDisagreement`/`consolidateReflexivityQueue`, queued for
operator review, never auto-merged into a golden dataset), and Fleiss-kappa ensemble agreement +
counterfactual stability scoring (`fleissKappa`/`ensembleAgreement`/`counterfactualStability`).
