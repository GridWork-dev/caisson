---
updated: 2026-07-11
status: intake (session Q, 2026-07-12 — ADR-0328 D3)
owner: operator (business/finance track)
source: caisson-docs-2026-07-12.zip (MacBook scp intake)
---

# Paste-Ready Prompt for the Finance-Connected Chat

Paste everything below this line into the existing ChatGPT conversation that already has both account connections.

---

I need you to build a complete, audit-friendly financial reconstruction for Caisson Software LLC from the two financial account environments already connected to this conversation. Work through the data methodically and produce an editable Excel workbook, then stop for my review before finalizing uncertain classifications.

## Objective

Create:

1. `Caisson_Finance_Reconstruction_DRAFT_2026-07-11.xlsx`
2. A short coverage and exceptions summary in this chat.
3. After the mandatory review checkpoint described below, `Caisson_CPA_Handoff_DRAFT_2026-07-11.md` based on the reviewed workbook.

This is a factual reconstruction for my CPA and lawyer. It is not a tax return, legal opinion, final bookkeeping ledger, or permission to move money.

## Known context

- Caisson Software LLC is a Georgia software company formed July 6, 2026.
- The company is pre-sale and has no reported customer revenue yet.
- The principal startup-spend period is January 1, 2026 through July 11, 2026.
- I am Liam Thadani, a minor and the principal operator/code author. My mother is the sole legal member. Do not label me as a current member or owner.
- My father funded startup activity, but the legal, accounting, and tax character of that funding is unresolved and must be decided by the CPA and, where needed, counsel.
- One connected environment is an American Express card/account under my father that he pays and that I use for startup and personal purchases. Do not assume whether I am an authorized user or what card arrangement applies; preserve the exact source metadata.
- The other connected environment is a Current debit account I describe as mine. It receives approximately $200 per week from my father and some larger deposits described informally as gifts. It also contains startup and personal activity. Preserve the exact source ownership metadata and do not treat the informal description as a final classification.
- Both environments were connected previously and were reported backfilled to the beginning of 2025. Verify this yourself before analyzing.

## Non-negotiable safety and privacy rules

1. **Read only.** Do not transfer money, make a payment, initiate a refund, change a payee, connect a new account, open or close an account, or take any other financial action.
2. **Do not mutate source data.** Do not edit transaction descriptions, tags, categories, notes, account settings, or merchant records in either institution or connector.
3. **No permanent recategorization.** All categories must exist only as proposed fields in the new workbook until reviewed.
4. **Do not request or expose credentials.** Do not ask for passwords, security codes, full card numbers, or full account numbers. Use masked account aliases in outputs.
5. **Use only data already lawfully connected to this conversation.** If the connector requires write access for an operation, do not perform it. Explain the limitation.
6. **Minimize unrelated personal data.** Preserve the transaction row needed for reconciliation, but do not speculate about sensitive personal activity or reproduce unnecessary account details in the CPA memo.
7. **Do not delete or hide rows.** Preserve every source transaction in scope, including personal items, transfers, payments, refunds, reversals, duplicates, and uncertain items.
8. **Do not make legal or tax determinations.** Use the candidate labels below and route conclusions to the CPA or counsel.
9. **Do not treat a purchase as deductible because it appears related to the project.** Business purpose, accounting nature, funding treatment, and tax treatment are separate questions.
10. **Do not infer account ownership or authorized-user status from a display name.** Report exact source metadata and mark any ambiguity.

## Preflight - Confirm authority before reading transaction detail

Before exporting, classifying, or summarizing transaction-level data, ask me to confirm both of the following in this chat:

1. My father has expressly authorized this read-only review and export of the connected Amex data, including the fact that unrelated personal transactions may be present.
2. I am authorized to review and export the connected Current data and to share the resulting draft only with the intended family members and professional advisors.

Record my response and the intended recipients in the coverage summary. If I do not confirm both points, **STOP** after reporting only non-sensitive connection/coverage metadata. Do not display, export, or classify transaction detail. A connection by itself is not proof of account ownership, authorized-user status, or permission to share data.

## Stage 0 - Verify coverage before classification

Inspect the two existing connections and report a compact coverage table with:

- Source account alias using only masked identifiers.
- Institution and account/card product type.
- Account owner, cardholder, or user labels exactly as exposed by the source, clearly marked as source metadata rather than legal conclusions.
- Earliest available transaction date.
- Latest available posted transaction date and latest pending date, if any.
- Count of posted and pending transactions.
- Available statement months, if the connector exposes statements.
- Currency or currencies.
- Any missing date range, pagination limit, stale connection, duplicate connection, or access limitation.

Paginate until you reach at least January 1, 2025; do not analyze only a sample or the first page of results. If both expected environments are available and coverage reaches January 1, 2025, continue automatically. If an environment is missing, the history is materially truncated, or read-only access cannot be assured, stop and tell me exactly what is missing. Do not try to fix a connection or ask for credentials.

Record a precise data cutoff timestamp in the workbook.

## Stage 1 - Import and preserve

Use two periods:

- **Inventory period:** January 1, 2025 through the latest available date.
- **Detailed-review period:** January 1, 2026 through July 11, 2026, inclusive.

Import every source row in the inventory period. Preserve the source transaction ID where available. If none exists, create a deterministic ID from the masked account alias, posted date, exact raw description, exact original amount, and a collision suffix. Never replace source identifiers with row numbers alone.

Preserve both the original amount/sign convention and a normalized amount with **inflows positive and outflows negative**. Preserve raw descriptions exactly, and put any cleaned merchant name in a separate field. Mark pending items and do not treat them as final until posted.

Add factual date flags for:

- 2025 inventory only.
- January 1 through July 5, 2026: before LLC formation.
- July 6 through July 9, 2026: after formation and before the EIN notice date.
- July 10 through July 11, 2026.
- After July 11, 2026: inventory only, outside this detailed review.

These flags must not determine deductibility or funding treatment.

## Stage 2 - Link transaction mechanics without deleting anything

Detect and assign link IDs for:

- Likely transfers between connected accounts or subaccounts.
- Credit-card payments versus the underlying charges.
- Refunds, partial refunds, statement credits, rebates, and reversals.
- Duplicate imports versus genuinely repeated purchases.
- Installment-plan charges and their original purchase where available.
- Recurring subscriptions, including price changes and skipped months.
- Cash withdrawals and any later redeposits where the records support a link.

Use evidence and confidence fields. Do not collapse or remove linked rows. A possible duplicate remains a separate row until reviewed. Do not count card payments or matched transfers as expenses in summaries, but preserve them and show the exclusion reason.

## Stage 3 - Apply conservative proposed classifications

Classify these four dimensions independently:

### A. Proposed business status

Use only:

- `Proposed business`
- `Proposed personal`
- `Proposed mixed`
- `Uncertain`

Before my review, do not use the word `confirmed` for business status.

### B. Proposed accounting nature

Use the most appropriate candidate, without deciding tax deductibility:

- Organizational-cost candidate
- Pre-opening startup-cost candidate
- Current operating-expense candidate
- Capital asset/equipment candidate
- Software/cloud/domain/subscription candidate
- Deposit/inflow
- Transfer or card payment - not an expense
- Refund/credit/reversal
- Personal/noncompany
- Unknown/insufficient evidence

### C. Proposed funding treatment

Use only a candidate and never a settled conclusion:

- Father-to-LLC loan/advance candidate
- Potential reimbursement to father
- Direct third-party payment on behalf of LLC - balance-sheet treatment unresolved
- Gift to mother followed by member contribution candidate
- Mother's member contribution candidate
- Potential reimbursement to Liam
- Personal gift to Liam candidate
- Compensation candidate - payroll review required
- Personal/family amount outside company
- Unknown - CPA/counsel decision required

The fact that my father paid does not establish a loan, gift, contribution, or right to reimbursement. The fact that money entered my Current account does not establish wages, a gift, a loan, or company funding. Do not allocate fungible deposits to later purchases unless the records provide a real trace.

### D. Tax treatment

Set this to `CPA decision required` unless the CPA later supplies a written rule for a defined category. Do not calculate a deduction or make a gift-tax, payroll-tax, capitalization, or ownership conclusion.

## Conservative review rules

- Default food, fuel, general shopping, cash withdrawals, entertainment, and ordinary personal purchases to `Proposed personal` or `Uncertain` unless a specific Caisson purpose and evidence exist.
- A merchant associated with technology is not enough to establish business purpose.
- Treat mixed-use items as `Proposed mixed`; do not invent a business-use percentage.
- Treat weekly approximately $200 deposits and larger deposits as `Uncertain` for legal/accounting character unless source evidence resolves them. Preserve any source memo and my informal description separately.
- Mark pre-formation and pre-opening costs factually; do not call them deductible.
- Do not assume that equipment, domains, subscriptions, or accounts paid by my father are legally owned by Caisson.
- Do not treat family support as payroll, and do not relabel gifts as wages.
- Do not treat me as a member, owner, or current beneficial owner.
- Do not infer that my mother contributed an amount merely because she is the legal member.
- For a purchase with credible Caisson purpose but unresolved funding, keep `Proposed business` separate from `Unknown - CPA/counsel decision required` funding treatment.
- Link refunds to the original item and show the net effect without losing either row.
- Flag any transaction whose description, amount, date, or account metadata conflicts across sources.

## Confidence rubric

Assign a numeric confidence from 0 to 100 and a one-sentence basis.

- `90-100`: Source mechanics are directly evidenced, such as an exact matched reversal. This high score does not make a tax or funding conclusion final.
- `75-89`: Strong merchant, receipt, memo, and purpose evidence supports the proposed factual category.
- `50-74`: Plausible but one material fact or document is missing.
- `0-49`: Ambiguous, mixed, family-transfer-related, or materially unsupported.

Regardless of score, route all gift, compensation, loan, contribution, reimbursement, mixed-use, ownership, and pre-formation questions to review.

## Required Excel workbook

Create a clean `.xlsx` workbook with exactly these nine worksheets in this order. Use Excel tables, frozen header rows, filters, readable widths, date and currency formats, and formulas that reference source tables. Do not use macros, external workbook links, hidden rows, hidden sheets, or password protection. Visually label the entire workbook **DRAFT - UNREVIEWED**.

### 1. Raw Transactions

One row per imported source transaction, with these columns:

`Source Transaction ID`, `Source Account Alias`, `Institution`, `Source Account/Card Metadata`, `Apparent Owner/Cardholder Label`, `Account Type`, `Transaction Date`, `Posted Date`, `Pending/Posted`, `Raw Description`, `Original Amount`, `Original Sign Convention`, `Normalized Amount`, `Currency`, `Native Category`, `Native Memo`, `Inventory/Detailed Period`, `Formation-Date Flag`, `Imported At`, `Data Cutoff`, `Source Limitation`, `Do Not Delete`

Do not add proposed business or tax conclusions to this sheet. It is the unaltered raw import layer. Preserve any original export or statement separately and record its source reference or hash where the connector makes one available; otherwise record the connection, account alias, import time, and data cutoff.

### 2. Review Queue

Include all detailed-period transactions plus any 2025 or later transaction linked to one. Columns:

`Source Transaction ID`, `Posted Date`, `Source Account Alias`, `Raw Description`, `Normalized Amount`, `Merchant Normalized`, `Proposed Business Status`, `Proposed Accounting Nature`, `Proposed Funding Treatment`, `Tax Treatment`, `Confidence 0-100`, `Confidence Basis`, `Business Purpose Note`, `Receipt Status`, `Mechanical Link Type`, `Mechanical Link ID`, `Why Flagged`, `Evidence Needed`, `Question for Liam`, `Question for Father/Mother`, `Question for CPA`, `Question for Counsel`, `Liam Review`, `Advisor Decision`, `Decision Date`, `Decision Source`

Leave `Liam Review`, `Advisor Decision`, `Decision Date`, and `Decision Source` blank before the mandatory checkpoint.

### 3. Startup Costs

Include only proposed-business, proposed-mixed, and uncertain detailed-period outflows that could relate to Caisson. Do not include personal items as startup costs, but keep them in the other sheets. Columns:

`Source Transaction ID`, `Posted Date`, `Formation-Date Flag`, `Vendor`, `Description`, `Gross Outflow`, `Payer/Source`, `Proposed Business Status`, `Business Purpose`, `Proposed Accounting Nature`, `Proposed Funding Treatment`, `Receipt/Invoice Status`, `Asset or Subscription Flag`, `Placed-in-Service Date`, `Confidence`, `CPA Treatment`, `Notes`

Leave `Placed-in-Service Date` and `CPA Treatment` blank unless supported or later supplied by the CPA.

### 4. Receipts and Missing Documents

Columns:

`Source Transaction ID`, `Date`, `Vendor/Counterparty`, `Amount`, `Proposed Business Status`, `Required Document`, `Receipt Status`, `Document Link or Reference`, `Business Purpose Present`, `Requested From`, `Request Date`, `Received Date`, `Follow-up Status`, `Privacy Note`

Use receipt statuses: `Available`, `Partial`, `Missing`, `Not applicable`, `Needs review`. Do not fabricate links or claim a document exists because a transaction has a merchant name.

### 5. Funding and Reimbursement

Include deposits, family transfers, third-party-paid Caisson candidates, and possible reimbursements. Columns:

`Event ID`, `Linked Source Transaction ID(s)`, `Date`, `Amount`, `From Account/Person`, `To Account/Person`, `Actual Payer`, `Apparent Benefited Party`, `Event Type - Factual`, `Proposed Funding Treatment`, `Repayment Evidence`, `Written Terms Evidence`, `Related Business Expense ID`, `Gift/Payroll/Loan/Reimbursement Question`, `CPA/Counsel Decision`, `Decision Source`, `Notes`

Do not merge a supposed gift to my mother and a supposed member contribution into one event without evidence of both events.

### 6. Assets and Subscriptions

Columns:

`Asset/Series ID`, `Linked Source Transaction ID(s)`, `Vendor`, `Description`, `Type`, `Purchase/Start Date`, `Renewal Frequency`, `Latest Charge`, `Total Observed Charges`, `Payer`, `User`, `Legal Owner Unknown/Proposed`, `Business/Mixed Status`, `Receipt or Contract`, `Cancellation/Renewal Date`, `Placed-in-Service Date`, `CPA Treatment`, `Notes`

Group recurring series but preserve every underlying transaction ID. Do not assume Caisson owns an account, domain, license, or device merely because it was used for the project.

### 7. Monthly Summary

Create one row per calendar month and separate columns for each account environment. Show:

- Total inflows and outflows from raw data.
- Matched transfers and card payments.
- Refunds and reversals.
- Proposed business, personal, mixed, and uncertain outflows.
- Proposed startup/organizational, operating, asset, and subscription candidates.
- Receipt-supported and receipt-missing proposed-business amounts.
- Number and value of unresolved funding events.
- Counts of posted and pending transactions.

Use formulas tied to the source tables. Show gross categories and reconciliation checks; do not net away personal or uncertain activity.

### 8. Tax-Reserve Scenarios

Build low, base, and high scenario columns with a clearly separated input area and formula area. Include inputs for:

`Projected Paddle Supplier Proceeds`, `Payout Timing`, `Refund/Chargeback Rate`, `Paddle Adjustments/Fees`, `Approved Deductible Operating Expenses`, `Approved Startup/Organizational Treatment`, `Payroll and Employer Tax`, `Federal Tax Input`, `Self-Employment or Other Employment-Tax Input`, `Georgia Tax Input`, `Safe-Harbor Target`, `Withholding/Estimated Payments Already Credited`, `Current Tax-Reserve Cash`, `Current Refund-Reserve Cash`, `Operating-Runway Target`

Every percentage or tax input must say `PROVISIONAL - CPA APPROVAL REQUIRED`. If no CPA-approved input has been supplied, leave it blank or use `CPA INPUT REQUIRED`; do not invent a precise rate. Create formulas that activate when inputs are entered. Keep tax reserve, refund/chargeback reserve, and operating runway as three separate outputs. State prominently that cash deposits and gross checkout figures are not, by themselves, the final taxable-income calculation.

### 9. CPA Questions

Columns:

`Question ID`, `Priority`, `Topic`, `Question`, `Known Facts`, `Linked Transaction/Event IDs`, `Why It Matters`, `Possible Treatments - Not Conclusions`, `Advisor Needed`, `CPA/Counsel Answer`, `Decision Owner`, `Effective Date`, `Supporting Document`, `Follow-up Trigger`

Include at least the questions about account-data authorization, LLC tax classification, father funding, possible reimbursements, pre-formation/startup costs, assets/subscriptions, minor employment and payroll, family gifts versus compensation, Paddle settlement accounting, reserve inputs, and the planned age-18 ownership transfer.

## Reconciliation and quality checks

Before presenting the draft workbook:

1. Confirm every imported source row appears exactly once in `Raw Transactions`.
2. Reconcile monthly raw totals to available source statements or explain the gap.
3. Confirm linked transfers, card payments, and refunds are not double-counted as expenses.
4. Confirm every detailed-period row appears in `Review Queue`.
5. Confirm every row on another worksheet links back to one or more source transaction IDs.
6. Confirm all formulas reference workbook tables rather than hard-coded totals.
7. Search for blank source IDs, invalid dates, inconsistent amount signs, duplicate deterministic IDs, and broken internal references.
8. Confirm no full account/card number, credential, or unnecessary sensitive description appears in any summary or memo.
9. Confirm no uncertain classification has been silently converted to a final category.
10. Confirm the workbook visibly states its data cutoff and `DRAFT - UNREVIEWED` status.

## Mandatory review checkpoint

After creating the draft workbook, give me a compact review message containing:

- Coverage and any gaps.
- Counts and total dollar amounts by proposed business status.
- The 15 largest proposed-business, mixed, or uncertain Caisson-related outflows.
- All recurring subscriptions detected.
- All large deposits and recurring weekly transfers, without assigning them a final gift or business label.
- Missing receipts for the largest proposed-business items.
- Possible duplicates, refunds, transfers, and card-payment issues.
- A consolidated numbered list of questions for me, grouped so I can answer efficiently.

Then **STOP AND WAIT FOR MY RESPONSE**.

At this checkpoint:

- Do not fill the `Liam Review`, `Advisor Decision`, `Decision Date`, or `Decision Source` fields.
- Do not call any classification final.
- Do not generate the CPA handoff memo yet.
- Do not change anything in the connected accounts.
- Do not permanently recategorize anything in the connector.

## After I respond

When I answer the review questions:

1. Preserve the original proposal and add my response to `Liam Review`; do not overwrite history.
2. Update proposed classifications only where my factual answer supports the change.
3. Leave legal, tax, loan, gift, contribution, compensation, reimbursement, ownership, and deductibility decisions for the advisors.
4. Regenerate the workbook as `Caisson_Finance_Reconstruction_REVIEWED_DRAFT_2026-07-11.xlsx` and keep it labeled `DRAFT - CPA REVIEW REQUIRED`.
5. Produce `Caisson_CPA_Handoff_DRAFT_2026-07-11.md` with:
   - Scope and data cutoff.
   - Account coverage and limitations.
   - Reconciliation results.
   - Proposed Caisson costs by month and candidate type.
   - Missing-document summary.
   - Funding and reimbursement events requiring decisions.
   - Assets and recurring subscriptions.
   - My factual answers and remaining uncertainties.
   - Numbered CPA and counsel questions.
   - A statement that no tax, gift, payroll, ownership, or funding treatment is final until the appropriate advisor approves it.
6. Stop again for CPA or advisor instructions before filling any `Advisor Decision` field or producing an opening entry.

Begin with Stage 0 now.
