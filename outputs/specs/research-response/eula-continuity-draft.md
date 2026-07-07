# EULA vendor-continuity clause — DRAFT for operator review

**Status:** DRAFT ONLY — not applied, not committed. The operator owns the final text.
**Implements:** ADR-0276 (EULA continuity clause; the codified self-maintenance path, NOT the
declined auto-open-source dead-man switch). **Referenced by:** ADR-0272 §5 (pricing-surface terms
rework points at this clause once it ships). **Tag:** `secrets` (legal document release; gates SHIP).
**Target file:** `apps/site/app/legal/eula/page.tsx` (the binding Commercial License Agreement).

---

## 0. What is already true (so the clause CONFIRMS, it does not newly grant)

Three of the four things a buyer fears losing are already contractually true in the live EULA —
the clause makes them explicit and ties them to the vendor-failure scenario, which is where
procurement wants the words:

| Buyer fear                                                | Already in the EULA                                              | Section           |
| --------------------------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| "The license expires if you go away"                      | Perpetual, survives termination except for buyer breach          | §2 Grant, §6 Term |
| "My install stops if your server dies"                    | Ed25519 keys verify **offline**, no call home                    | §4 Entitlement    |
| "I lose the code"                                         | Grant covers the Software **as delivered**; survives termination | §2, §6            |
| **"You stop shipping security patches and I'm stranded"** | **NOT addressed — this is the gap the clause fills**             | — new             |

Consistency guardrails the clause must not break:

- **Perpetual owned Entitlement ≠ perpetual updates.** ADR-0269 makes the _owned entitlement_
  perpetual; ADR-0260 makes the _updates window_ a time-boxed, paid thing (12 months, renewable at
  40%). The clause confirms the entitlement survives a vendor failure; it must **not** promise
  continued updates, or it silently reinstates a lapsed paid window.
- **The trigger is Caisson stopping _for everyone_, not one buyer's lapsed window.** A buyer who let
  their updates window lapse is not receiving patches because _they_ stopped paying — that is not a
  Continuity Event. The trigger fires only when Caisson ceases to make security patches available to
  licensees **generally**. This is the single most important phrasing guard in the whole clause.
- **Assignment already exists (§12).** Caisson may already assign on a merger/acquisition on notice.
  The clause refines that: assignment is fine _if the successor assumes the obligations_; the
  Continuity Event fires only when a successor does **not** assume them.

---

## a. The primary continuity clause (RECOMMENDED — "confirmatory self-help")

### a.1 New defined term (add to §1 "Definitions")

One new term only; everything else reuses existing defined terms (Software, Entitlement, Your
Products, Confidential Information).

> - **"Continuity Event"** means the first to occur of any of the following: (i) Caisson publicly
>   and formally announces the discontinuation or end-of-life of the Software or of the commercial
>   Caisson product line as a whole; (ii) Caisson ceases to make security patches or critical
>   corrective updates for the Software available to its licensees generally for a continuous period
>   of **twelve (12) months**, and no successor has assumed responsibility for doing so; (iii) Caisson
>   becomes insolvent, ceases business operations, makes a general assignment for the benefit of
>   creditors, or a bankruptcy, receivership, or dissolution proceeding is commenced against it and
>   is not dismissed within ninety (90) days; or (iv) Caisson is acquired, or its rights in the
>   Software are sold or transferred, and the acquirer or successor does not, within ninety (90) days
>   of the transaction, assume Caisson's obligations under this Agreement (including this Section) in
>   writing. A Continuity Event is not triggered by the lapse or non-renewal of _your_ updates window
>   or Updates Subscription; clause (ii) concerns availability to licensees generally, not to you
>   individually.

**Operator knobs (bracketed above):** the **twelve (12) months** in (ii) is the `N` ADR-0276 leaves
operator-owned — 12 aligns with every other window in the EULA and the ADR-0272 "12-month cliff"
framing; the **ninety (90) days** dismissal/assumption windows in (iii)/(iv) are conventional and
adjustable.

### a.2 The clause body (new EULA Section — "Vendor continuity and self-maintenance")

> **What survives a Continuity Event.** A Continuity Event does not terminate, suspend, or diminish
> your perpetual license. On and after a Continuity Event, the license granted in _License grant_
> above continues in full force for the Software and any versions already delivered to you, and for
> the modules and bundles in your Entitlement; the offline verification described in _Entitlement and
> offline verification_ above continues to function without dependence on any Caisson-operated
> service; and your right to build, operate, and distribute Your Products is unaffected. Caisson will
> not disable, revoke, or expire a validly issued Entitlement by reason of a Continuity Event.
>
> **Additional rights granted on a Continuity Event.** So that a Continuity Event cannot strand your
> continued secure operation of the Software, and effective automatically on and for as long as a
> Continuity Event subsists, Caisson additionally grants you, under the same perpetual, non-exclusive,
> worldwide terms:
>
> 1. **Self-maintenance.** The right to modify, fork, and patch the Software — including for security,
>    compatibility, and continued operation — and to engage third-party contractors, bound by
>    confidentiality obligations at least as protective as this Agreement, to do so on your behalf.
> 2. **Internal continuity copies.** A waiver of the redistribution restriction in _Restrictions_
>    above **solely** as to copies of the Software shared within your own organization, your
>    affiliates, and contractors engaged under clause (1), and **solely** for self-maintenance and
>    continued internal use. External redistribution, resale, sublicensing, publication, or provision
>    of the Software to any other third party as a kit remains prohibited without exception.
> 3. **Self-hosting of delivery.** The right to host, on infrastructure you control, copies of the
>    Software and of any versions already delivered to you that you would otherwise obtain from
>    `registry.caisson.sh`, so that continued installation and deployment do not depend on any
>    Caisson-operated registry or service.
>
> **Exclusions.** For the avoidance of doubt, a Continuity Event does not grant, revive, or continue:
> (a) any right to use the Caisson name, wordmark, glyph, or other marks, which remain governed by
> _Intellectual property_ above; (b) any obligation of Caisson to provide future updates, new
> versions, security patches, support, or services — the rights above are self-help rights, not a
> continuation of any Caisson service; (c) any updates window or Updates Subscription, neither of
> which is extended, renewed, or reinstated by a Continuity Event; (d) any warranty — the disclaimers
> in _Disclaimer of warranties_ and the limitations in _Limitation of liability_ survive a Continuity
> Event unchanged and apply to any exercise of the rights in this Section; or (e) any right of access
> to Caisson source, versions, or Confidential Information beyond what was actually delivered to you
> before the Continuity Event; Caisson has no obligation to escrow or deliver anything further.
>
> **Successors.** Any successor to Caisson — by merger, acquisition, asset sale, bankruptcy transfer,
> or otherwise — takes the Software subject to this Section, which is intended to bind Caisson's
> successors and to survive Caisson's dissolution. If a successor assumes this Agreement (including
> this Section) in writing within the period stated in clause (iv) of the definition of _Continuity
> Event_, no Continuity Event occurs by reason of that transaction and this Agreement continues in
> effect unchanged.

**Why this is the recommended strength:** every additional right it grants is either already
architecturally true (offline verification, source you keep) or a low-cost self-help right that
creates **no ongoing obligation, cost, or escrow burden** on Caisson — it is a promise not to
interfere, plus a scoped internal waiver, not a service commitment. It directly answers the largest
pre-launch objection cluster (Cookiy: continuity/abandonware, 25/40) in binding terms while staying
inside what ADR-0276 locked and deliberately stopping short of the declined dead-man switch.

---

## b. Alternative phrasings / strengths

| #     | Variant                                                  | What changes vs. Recommended                                                                                                                                                                                                             | Trade-off (reassurance vs. obligation created)                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Confirmatory self-help** (the recommended draft above) | —                                                                                                                                                                                                                                        | **Best balance.** Strong, concrete procurement answer; near-zero new obligation (self-help + internal waiver, no escrow, no future-update duty). This is the ADR-0276 lock.                                                                                                                                                                                                                                                 |
| **B** | **Lean confirmation**                                    | Drop additional-right (2), the explicit internal-redistribution waiver; rely on §11 Confidentiality's existing "personnel and contractors who need it" language to cover internal sharing. Keep survival + self-maintenance + self-host. | Smallest new legal surface, least review effort. But the internal-fork **sharing** right becomes implicit and arguable — a procurement lawyer can read §11 as scoped to "work on Your Products," not "maintain the Software itself." Weaker answer to the exact question buyers ask.                                                                                                                                        |
| **C** | **Escrow-backed**                                        | Everything in A **plus** a commitment to deposit current source with a third-party escrow agent, released to licensees on a Continuity Event.                                                                                            | **Strongest** enterprise/procurement reassurance (an independently-held release, not just a promise). But it creates a **real ongoing obligation, cost, and operational cadence** and edges toward the auto-open-source path ADR-0276 declined as "unpriced pre-launch." Correct posture: hold as the **later-ADR upgrade** if a named enterprise deal's procurement demands escrow (ADR-0276 explicitly leaves this open). |

**Recommendation:** ship **A** now; keep **C** in the back pocket as a per-deal or post-launch ADR.
Do not ship **B** — it saves a paragraph at the cost of leaving the single most-asked question
answerable only by inference.

---

## c. Exact insertion point (diff-style)

### c.1 Placement

New Section inserted **immediately after §6 "Term and termination"** and before §7 "Disclaimer of
warranties". Rationale: §6 establishes that the perpetual license survives _your_ breach-free
termination; the new Section is the natural next beat — it survives _Caisson's_ discontinuation. The
visible section numbers are not rendered (the `{/* N. ... */}` are dev comments only, and headings
use `eyebrow`/`title`, no printed numerals), so no visible renumbering is required.

**One cosmetic note:** the page alternates `band="tint"` / plain. §6 is `tint`, §7 (warranty) is
plain. Insert the new Section as **plain** (no `band`) and flip `band` on each subsequent Section to
preserve the stripe — OR accept one non-alternating pair. Purely visual; operator/implementer's call.

### c.2 Definitions addition — in §1

Add the `Continuity Event` `<li>` to the existing definitions list. Surrounding context:

```diff
           <li style={prose.li}>
             <strong>&ldquo;Your Products&rdquo;</strong> means the products or
             services you build using the Software.
           </li>
+          <li style={prose.li}>
+            <strong>&ldquo;Continuity Event&rdquo;</strong> means the first to
+            occur of any of: (i) Caisson publicly and formally announces the
+            discontinuation or end-of-life of the Software or of the commercial
+            Caisson product line as a whole; (ii) Caisson ceases to make security
+            patches or critical corrective updates for the Software available to
+            its licensees generally for a continuous period of twelve (12) months,
+            and no successor has assumed responsibility for doing so; (iii) Caisson
+            becomes insolvent, ceases business operations, makes a general
+            assignment for the benefit of creditors, or a bankruptcy, receivership,
+            or dissolution proceeding is commenced against it and is not dismissed
+            within ninety (90) days; or (iv) Caisson is acquired, or its rights in
+            the Software are sold or transferred, and the acquirer or successor does
+            not, within ninety (90) days of the transaction, assume Caisson&rsquo;s
+            obligations under this Agreement (including the Vendor-continuity
+            Section) in writing. A Continuity Event is not triggered by the lapse or
+            non-renewal of your own updates window or Updates Subscription; clause
+            (ii) concerns availability to licensees generally, not to you
+            individually.
+          </li>
         </ul>
       </Section>
```

### c.3 The new Section — inserted between §6 and §7

Surrounding context (the close of §6 "Term and termination" and the open of §7 "Disclaimer of
warranties"), with the new Section shown in place:

```diff
         <p style={prose.paragraph}>
           Sections that by their nature should survive termination &mdash;
           including Disclaimer of warranties, Limitation of liability,
           Indemnification, Intellectual property, Confidentiality, and Governing
           law &mdash; survive.
         </p>
       </Section>

+      {/* 6a. Vendor continuity & self-maintenance */}
+      <Section
+        eyebrow="Continuity"
+        title="Vendor continuity and self-maintenance"
+      >
+        <p style={prose.paragraph}>
+          A Continuity Event does not terminate, suspend, or diminish your
+          perpetual license. On and after a Continuity Event, the license granted
+          under License grant, above, continues in full force for the Software and
+          any versions already delivered to you, and for the modules and bundles in
+          your Entitlement; the offline verification described under Entitlement and
+          offline verification, above, continues to function without dependence on
+          any Caisson-operated service; and your right to build, operate, and
+          distribute Your Products is unaffected. Caisson will not disable, revoke,
+          or expire a validly issued Entitlement by reason of a Continuity Event.
+        </p>
+        <p style={prose.paragraph}>
+          So that a Continuity Event cannot strand your continued secure operation
+          of the Software, and effective automatically on and for as long as a
+          Continuity Event subsists, Caisson additionally grants you, under the same
+          perpetual, non-exclusive, worldwide terms:
+        </p>
+        <ul style={prose.list}>
+          <li style={prose.li}>
+            <strong>Self-maintenance.</strong> The right to modify, fork, and patch
+            the Software &mdash; including for security, compatibility, and
+            continued operation &mdash; and to engage third-party contractors, bound
+            by confidentiality obligations at least as protective as this Agreement,
+            to do so on your behalf.
+          </li>
+          <li style={prose.li}>
+            <strong>Internal continuity copies.</strong> A waiver of the
+            redistribution restriction under Restrictions, above, solely as to copies
+            of the Software shared within your own organization, your affiliates, and
+            contractors engaged under the preceding item, and solely for
+            self-maintenance and continued internal use. External redistribution,
+            resale, sublicensing, publication, or provision of the Software to any
+            other third party as a kit remains prohibited without exception.
+          </li>
+          <li style={prose.li}>
+            <strong>Self-hosting of delivery.</strong> The right to host, on
+            infrastructure you control, copies of the Software and of any versions
+            already delivered to you that you would otherwise obtain from{" "}
+            <code className="mono">registry.caisson.sh</code>, so that continued
+            installation and deployment do not depend on any Caisson-operated
+            registry or service.
+          </li>
+        </ul>
+        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
+          For the avoidance of doubt, a Continuity Event does not grant, revive, or
+          continue: (a) any right to use the Caisson name, wordmark, glyph, or other
+          marks, which remain governed by Intellectual property, above; (b) any
+          obligation of Caisson to provide future updates, new versions, security
+          patches, support, or services &mdash; the rights above are self-help
+          rights, not a continuation of any Caisson service; (c) any updates window
+          or Updates Subscription, neither of which is extended, renewed, or
+          reinstated by a Continuity Event; (d) any warranty &mdash; the disclaimers
+          under Disclaimer of warranties and the limitations under Limitation of
+          liability survive a Continuity Event unchanged and apply to any exercise
+          of the rights in this Section; or (e) any right of access to Caisson
+          source, versions, or Confidential Information beyond what was actually
+          delivered to you before the Continuity Event; Caisson has no obligation to
+          escrow or deliver anything further.
+        </p>
+        <p style={prose.paragraph}>
+          Any successor to Caisson &mdash; by merger, acquisition, asset sale,
+          bankruptcy transfer, or otherwise &mdash; takes the Software subject to
+          this Section, which is intended to bind Caisson&rsquo;s successors and to
+          survive Caisson&rsquo;s dissolution. If a successor assumes this Agreement
+          (including this Section) in writing within the period stated in clause (iv)
+          of the definition of Continuity Event, no Continuity Event occurs by reason
+          of that transaction and this Agreement continues in effect unchanged.
+        </p>
+      </Section>
+
       {/* 7. Warranty disclaimer */}
       <Section eyebrow="Warranty" title="Disclaimer of warranties">
```

### c.4 Two consequential edits elsewhere (small, keep the document consistent)

1. **§6 survival list** already enumerates surviving sections — add the new Section so a reader
   sees it survives termination too:

   ```diff
   -          including Disclaimer of warranties, Limitation of liability,
   -          Indemnification, Intellectual property, Confidentiality, and Governing
   -          law &mdash; survive.
   +          including Vendor continuity and self-maintenance, Disclaimer of
   +          warranties, Limitation of liability, Indemnification, Intellectual
   +          property, Confidentiality, and Governing law &mdash; survive.
   ```

2. **Header "Last updated" date** (§ page header, currently `27 June 2026`) bumps to the release
   date on the version that ships this clause. Operator sets the final date at approval.

---

## Consistency check against existing terms (self-verification)

- **§2 / §6 perpetuity** — clause says "does not terminate or diminish"; matches. No conflict.
- **§4 offline verification** — clause says it "continues to function"; matches, and the self-host
  right (a.2 item 3) makes it operational even if `registry.caisson.sh` is gone.
- **§3 restrictions** — the internal-copies waiver is scoped `solely` to inside the org + the
  external prohibition is restated verbatim-in-spirit; the no-compete core is untouched.
- **§5 fees / ADR-0260 time-boxed updates** — exclusion (c) explicitly refuses to extend/reinstate
  any updates window; the clause grants self-help, never continued updates. No collision with the
  paid, time-boxed updates model.
- **ADR-0269 owned entitlements** — clause confirms the _owned Entitlement_ survives (perpetual) while
  keeping updates separate; exactly the ADR-0269/ADR-0260 split.
- **§10 IP / trademarks** — exclusion (a) defers to §10; no trademark grant. Matches.
- **§7 / §8 warranty + liability** — exclusion (d) says they survive and apply to the new rights;
  matches §6's own survival list.
- **§12 assignment** — trigger (iv) + the Successors paragraph refine §12: assignment stands _if_
  the successor assumes obligations; the Continuity Event fires only if it does not. Complementary,
  not contradictory (worth a one-line cross-check by counsel to confirm §12 and this Section read
  together cleanly).

```

```
