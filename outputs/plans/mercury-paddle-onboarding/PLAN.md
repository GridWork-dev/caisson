# PLAN — Mercury onboarding and Paddle production readiness

- **SPEC:** `outputs/specs/mercury-paddle-onboarding/SPEC.md`
- **Execution mode:** isolated worktree; local prerequisites first; provider and deployment actions
  remain operator-gated.

## Tasks

| Task | Outcome                                                                        | Evidence                                                            |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| T1   | Dedicated public refund/support routes and footer/sitemap registration         | route + static-render tests                                         |
| T2   | Exact production catalog mapping export with contained, non-overwriting output | red/green tool tests; self-check                                    |
| T3   | Paste-ready Mercury and Paddle browser execution prompts                       | prompt review against the locked spec                               |
| T4   | Local verification and source-of-truth reconciliation                          | site typecheck/lint/build; root checks; `bun run sot`               |
| T5   | Provider submissions, catalog creation, secret wiring, deploy, and real proof  | **HELD** for external-system/secrets gates                          |
| T6   | Conditional reviewer capability                                                | **NOT TRIGGERED**; separate auth/security/migration cycle if needed |

## External hand-back sequence

1. Run the Mercury prompt and return its redacted receipt.
2. Deploy the public route prerequisite only after the external-system gate is released.
3. Run the Paddle prompt through account approval and temporary catalog-key readiness.
4. Run the catalog tool under the secret/external-system gate and return its generated mapping.
5. Append production IDs to the pricebooks, switch the site to production IDs, verify all
   consumers, and deploy together under a second gated code/deployment receipt.
6. Resume the Paddle prompt for webhook, credentials, payout, controlled checkout, and refund.
