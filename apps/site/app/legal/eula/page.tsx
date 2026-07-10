import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";
import { prose } from "../prose";

export const metadata = buildMetadata({
  title: "EULA",
  description:
    "The binding Caisson End User License Agreement (EULA) — the Commercial License Agreement governing your purchase and use of Caisson software. Caisson Software LLC, governed by the laws of Georgia, USA.",
  path: "/legal/eula",
});

export default function EulaPage() {
  return (
    <>
      {/* Page header */}
      <Section eyebrow="Legal" title="End User License Agreement" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 10 July 2026. The binding Commercial License Agreement
          (&ldquo;EULA&rdquo;) governing your purchase and use of Caisson
          software.
        </p>
      </Section>

      {/* Draft notice */}
      <Section band="tint">
        <Card accent>
          <p
            className="cs-status"
            style={{
              fontFamily: "var(--cs-font-mono)",
              fontSize: "var(--cs-text-xs)",
              textTransform: "uppercase",
              letterSpacing: "var(--cs-tracking-wide)",
              color: "var(--cs-accent)",
            }}
          >
            Pending final legal review
          </p>
          <p style={{ marginTop: "var(--cs-space-3)", ...prose.paragraph }}>
            This End User License Agreement is being finalized with legal
            counsel and may be updated before the first sale. It is provided
            here for reference. The{" "}
            <a href="/legal/license" style={{ color: "var(--cs-accent)" }}>
              License page
            </a>{" "}
            is a plain-language summary only — this document is the binding
            agreement.
          </p>
        </Card>
      </Section>

      {/* 1. Parties & definitions */}
      <Section eyebrow="Parties" title="Parties and definitions">
        <p style={prose.paragraph}>
          This End User License Agreement (&ldquo;Agreement&rdquo; or
          &ldquo;EULA&rdquo;) is between Caisson Software LLC, a Georgia limited
          liability company (&ldquo;Caisson,&rdquo; &ldquo;we,&rdquo; or
          &ldquo;us&rdquo;), and the individual or entity that purchases a
          Caisson software license (&ldquo;Licensee&rdquo; or
          &ldquo;you&rdquo;).
        </p>

        <h3 style={prose.h3}>Definitions</h3>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>&ldquo;Software&rdquo;</strong> means the Caisson source
            code, the packages under the <code className="mono">@caisson</code>{" "}
            scope, related documentation, and any updates delivered under the
            license&rsquo;s included updates window or an active updates
            subscription, as licensed to you under this Agreement.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Entitlement&rdquo;</strong> means the record of which
            modules and bundles you are licensed to access, verified by a signed
            Ed25519 offline license key.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Order&rdquo;</strong> means the purchase transaction
            completed through the Caisson storefront, processed by our merchant
            of record, that establishes your Entitlement.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Your Products&rdquo;</strong> means the products or
            services you build using the Software.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Affiliate&rdquo;</strong> means an entity that
            controls, is controlled by, or is under common control with you,
            where &ldquo;control&rdquo; means ownership of more than fifty
            percent (50%) of the voting interests of the entity or the power to
            direct its management.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Continuity Event&rdquo;</strong> means the first to
            occur of any of: (i) Caisson publicly and formally announces the
            discontinuation or end-of-life of the Software or of the commercial
            Caisson product line as a whole; (ii) for a continuous period of
            twelve (12) months, Caisson fails to make available to its licensees
            generally any security patch or critical corrective update for the
            Software despite at least one publicly disclosed vulnerability or
            defect materially affecting the Software remaining unremediated
            during that period, and no successor has assumed responsibility for
            doing so; (iii) Caisson becomes insolvent, ceases business
            operations, makes a general assignment for the benefit of creditors,
            or a bankruptcy, receivership, or dissolution proceeding is
            commenced against it and is not dismissed within ninety (90) days;
            or (iv) Caisson is acquired, or its rights in the Software are sold
            or transferred, and the acquirer or successor does not, within
            ninety (90) days of the transaction, assume Caisson&rsquo;s
            obligations under this Agreement (including the Vendor-continuity
            Section) in writing. A Continuity Event is not triggered by the
            lapse or non-renewal of your own updates window or Updates
            Subscription; clause (ii) concerns availability to licensees
            generally, not to you individually.
          </li>
        </ul>
      </Section>

      {/* 2. License grant */}
      <Section eyebrow="Grant" title="License grant" band="tint">
        <p style={prose.paragraph}>
          Subject to your compliance with this Agreement and full payment of
          applicable fees, Caisson grants you a{" "}
          <strong>perpetual, non-exclusive, worldwide, non-transferable</strong>{" "}
          (except as permitted under Assignment and transfer, below) license to
          use, modify, and integrate the Software identified in your
          Entitlement, for the purpose of developing, operating, and
          distributing Your Products. This license is identified by the SPDX
          license identifier{" "}
          <code className="mono">LicenseRef-Caisson-Commercial</code> in each
          licensed package&apos;s <code className="mono">package.json</code>.
        </p>
        <p style={prose.paragraph}>
          The license is perpetual for the version of the Software covered by
          your Order. It does not expire and does not require renewal, periodic
          payment, or a network call to remain valid.
        </p>
      </Section>

      {/* 3. Restrictions */}
      <Section eyebrow="Limits" title="Restrictions">
        <p style={prose.paragraph}>
          The license granted above is subject to the following restrictions.
          You agree not to:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            Redistribute, resell, sublicense, or publish the Software, in source
            or compiled form, as a standalone kit, boilerplate, library, or
            template — including one that competes with Caisson.
          </li>
          <li style={prose.li}>
            Grant any third party access to the Software itself; your customers
            may use Your Products, not the underlying Caisson source.
          </li>
          <li style={prose.li}>
            Remove or obscure license notices, copyright notices, SPDX
            identifiers, or attribution embedded in the Software.
          </li>
          <li style={prose.li}>
            Use the Software to build a product whose primary purpose is to
            provide a competing compliance-infrastructure kit, boilerplate
            service, or source-code library.
          </li>
          <li style={prose.li}>
            Use the Software except as expressly permitted by this Agreement.
          </li>
        </ul>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          For the avoidance of doubt, this Agreement permits unlimited use of
          the Software in commercial products you build and operate yourself,
          including products you sell to your own customers. Your customers
          interact with Your Products; they do not receive the Caisson source.
        </p>
      </Section>

      {/* 4. Entitlement & offline verification */}
      <Section
        eyebrow="Entitlement"
        title="Entitlement and offline verification"
        band="tint"
      >
        <p style={prose.paragraph}>
          Your Order generates an Entitlement record and a signed Ed25519
          offline license key covering the modules and bundles purchased. The
          key is verified locally at install time and, for license-gated
          features, at runtime; no call home is required to exercise the
          perpetual license.
        </p>
        <p style={prose.paragraph}>
          Entitlement is per purchasing entity. If you purchased as an
          individual, the Entitlement is yours; if you purchased on behalf of an
          organization, the Entitlement belongs to that organization and may be
          used by personnel you authorize to work on Your Products.
        </p>
        <p style={prose.paragraph}>
          We may revoke an Entitlement issued in error, obtained fraudulently,
          or subject to a refund or chargeback. Revocation does not affect an
          Entitlement properly issued and paid for.
        </p>
      </Section>

      {/* 5. Fees & payment */}
      <Section eyebrow="Fees" title="Fees and payment">
        <p style={prose.paragraph}>
          Fees are as displayed on caisson.sh at the time of your Order and are
          processed through our merchant of record, who handles payment
          collection, tax calculation, and remittance for your jurisdiction. All
          fees are exclusive of taxes unless stated otherwise. Every purchase is
          covered by an unconditional 14-day money-back guarantee: request a
          refund within 14 days for any reason and the merchant of record
          returns your payment. See the{" "}
          <a href="/legal/terms" style={{ color: "var(--cs-accent)" }}>
            Terms of Use
          </a>{" "}
          for the full refund policy.
        </p>
        <p style={prose.paragraph}>
          The perpetual license fee is a one-time charge that includes 12 months
          of updates from your Order date &mdash; registry access to any
          entitled-package version published in that window, plus everything
          already delivered. After that window, you may renew updates access for
          another 12 months at 40% of the then-current list price, or let it
          lapse; non-renewal never affects the perpetual license for versions
          already delivered. An Updates Subscription, where purchased, is billed
          on a recurring basis until cancelled and grants access to new versions
          of your entitled packages published while it is active; it is optional
          and does not affect the perpetual license for versions already
          delivered.
        </p>

        <h3 style={prose.h3}>Credits</h3>
        <p style={prose.paragraph}>
          Certain AI-feature and codegen functionality within the Software is
          metered using a prepaid credit balance (&ldquo;Credits&rdquo;).
          Credits are issued in grants &mdash; through a subscription cycle, a
          one-time top-up purchase, or a promotional grant &mdash; and are
          pooled into a single wallet; unused Credits from a prior grant roll
          over and are not forfeited at the end of a billing cycle. Each Credit
          grant expires twelve (12) months after it is issued, unless we state a
          different expiration for that grant at the time it is issued. Credits
          are consumed on a first-in, first-out basis, drawing from your oldest
          outstanding grant first, so that Credits nearing expiration are used
          before newer Credits &mdash; an actively used balance is not lost to
          expiration through non-use alone. Credits remaining in a grant that
          expires unused are forfeited without refund; expiration of a Credit
          grant does not affect your license to the Software or any other right
          under this Agreement.
        </p>
      </Section>

      {/* 6. Term & termination */}
      <Section eyebrow="Term" title="Term and termination" band="tint">
        <p style={prose.paragraph}>
          This Agreement is effective from the date of your Order and continues
          until terminated as described below. The license grant for the
          perpetual license, once fees are paid, survives termination of this
          Agreement for any reason other than the breach described next.
        </p>
        <p style={prose.paragraph}>
          We may terminate your license to the Software, effective immediately
          on written notice, if you materially breach the restrictions in this
          Agreement (including unauthorized redistribution) and fail to cure the
          breach within 30 days of notice, where curable. On termination for
          breach, you must stop using and destroy all copies of the Software;
          Your Products already distributed to your own customers are not
          affected, but you may not create new copies of, or updates from, the
          Software.
        </p>
        <p style={prose.paragraph}>
          Sections that by their nature should survive termination — including
          Vendor continuity and self-maintenance, Disclaimer of warranties,
          Limitation of liability, Indemnification, Intellectual property,
          Confidentiality, and Governing law — survive.
        </p>
      </Section>

      {/* 6a. Vendor continuity & self-maintenance (ADR-0276/0282; polish pass approved 2026-07-10) */}
      <Section
        eyebrow="Continuity"
        title="Vendor continuity and self-maintenance"
      >
        <p style={prose.paragraph}>
          A Continuity Event does not terminate, suspend, or diminish your
          perpetual license. On and after a Continuity Event, the license
          granted under License grant, above, continues in full force for the
          Software and any versions already delivered to you, and for the
          modules and bundles in your Entitlement; the offline verification
          described under Entitlement and offline verification, above, continues
          to function without dependence on any Caisson-operated service; and
          your right to build, operate, and distribute Your Products is
          unaffected. Caisson will not disable, revoke, or expire a validly
          issued Entitlement by reason of a Continuity Event.
        </p>
        <p style={prose.paragraph}>
          So that a Continuity Event cannot strand your continued secure
          operation of the Software, and effective automatically on and for as
          long as a Continuity Event subsists, Caisson additionally grants you,
          under the same perpetual, non-exclusive, worldwide terms:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>Self-maintenance.</strong> The right to modify, fork, and
            patch the Software as delivered to you &mdash; including for
            security, compatibility, and continued operation &mdash; and to
            engage third-party contractors, bound by confidentiality obligations
            at least as protective as this Agreement, to do so on your behalf.
          </li>
          <li style={prose.li}>
            <strong>Internal continuity copies.</strong> A waiver of the
            redistribution restriction under Restrictions, above, solely as to
            copies of the Software shared within your own organization, your
            Affiliates, and contractors engaged under the preceding item, and
            solely for self-maintenance and continued internal use. External
            redistribution, resale, sublicensing, publication, or provision of
            the Software to any other third party as a kit remains prohibited
            without exception.
          </li>
          <li style={prose.li}>
            <strong>Self-hosting of delivery.</strong> The right to host, on
            infrastructure you control, copies of the Software and of any
            versions already delivered to you that you would otherwise obtain
            from <code className="mono">registry.caisson.sh</code>, so that
            continued installation and deployment do not depend on any
            Caisson-operated registry or service.
          </li>
        </ul>
        <p style={prose.paragraph}>
          If a Continuity Event is cured (including by a successor&rsquo;s
          assumption), the additional rights above terminate prospectively only:
          modifications made, copies shared, and hosting established during the
          Continuity Event remain licensed as exercised.
        </p>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          For the avoidance of doubt, a Continuity Event does not grant, revive,
          or continue: (a) any right to use the Caisson name, wordmark, glyph,
          or other marks, which remain governed by Intellectual property, above;
          (b) any obligation of Caisson to provide future updates, new versions,
          security patches, support, or services &mdash; the rights above are
          self-help rights, not a continuation of any Caisson service; (c) any
          updates window or Updates Subscription, neither of which is extended,
          renewed, or reinstated by a Continuity Event; (d) any warranty &mdash;
          the disclaimers under Disclaimer of warranties and the limitations
          under Limitation of liability survive a Continuity Event unchanged and
          apply to any exercise of the rights in this Section; or (e) any right
          of access to Caisson source, versions, or Confidential Information
          beyond what was actually delivered to you before the Continuity Event;
          Caisson has no obligation to escrow or deliver anything further.
        </p>
        <p style={prose.paragraph}>
          Any successor to Caisson &mdash; by merger, acquisition, asset sale,
          bankruptcy transfer, or otherwise &mdash; takes the Software subject
          to this Section. This Section runs with Caisson&rsquo;s rights in the
          Software and binds Caisson&rsquo;s successors and assigns; Caisson
          shall make any assignment or transfer of its rights in the Software
          expressly subject to this Section. The parties intend that this
          Agreement is a license of &ldquo;intellectual property&rdquo; as
          defined in Section 101(35A) of the U.S. Bankruptcy Code, and that you
          retain the rights of a licensee under Section 365(n), including the
          right to retain and use the Software as delivered. If a successor
          assumes this Agreement (including this Section) in writing within the
          period stated in clause (iv) of the definition of Continuity Event, no
          Continuity Event occurs by reason of that transaction and this
          Agreement continues in effect unchanged.
        </p>
      </Section>

      {/* 7. Warranty disclaimer */}
      <Section eyebrow="Warranty" title="Disclaimer of warranties">
        <p style={prose.paragraph}>
          THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. CAISSON DOES NOT WARRANT THAT THE SOFTWARE WILL BE
          ERROR-FREE OR UNINTERRUPTED, OR THAT IT WILL MEET YOUR SPECIFIC
          REQUIREMENTS.
        </p>
        <p style={prose.paragraph}>
          Nothing in the Software or this Agreement constitutes compliance,
          legal, or security advice, and no statement here is a certification of
          SOC 2, HIPAA, or any other framework. Caisson ships technical
          controls; whether those controls satisfy a specific regulatory
          requirement in your jurisdiction is a determination you must make,
          typically with qualified legal counsel and your own auditor.
        </p>
      </Section>

      {/* 8. Limitation of liability */}
      <Section eyebrow="Liability" title="Limitation of liability" band="tint">
        <p style={prose.paragraph}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL
          CAISSON OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR CONTRACTORS BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE,
          DATA, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO THIS
          AGREEMENT OR THE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
          DAMAGES.
        </p>
        <p style={prose.paragraph}>
          CAISSON&apos;S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO
          THIS AGREEMENT WILL NOT EXCEED THE TOTAL FEES YOU ACTUALLY PAID TO
          CAISSON FOR THE SOFTWARE GIVING RISE TO THE CLAIM IN THE TWELVE (12)
          MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.
        </p>
        <p style={prose.paragraph}>
          These limitations apply regardless of the legal theory on which a
          claim is based, and even if a remedy fails of its essential purpose.
          Some jurisdictions do not allow the exclusion or limitation of certain
          damages, so some of the above limitations may not apply to you.
        </p>
      </Section>

      {/* 9. Indemnification */}
      <Section eyebrow="Indemnity" title="Indemnification">
        <p style={prose.paragraph}>
          You agree to indemnify, defend, and hold harmless Caisson and its
          officers, directors, employees, and contractors from any claim, loss,
          liability, damage, or expense (including reasonable attorneys&apos;
          fees) arising out of or related to: (a) Your Products; (b) your use of
          the Software in violation of this Agreement; or (c) your violation of
          applicable law.
        </p>
        <p style={prose.paragraph}>
          Caisson will provide you with prompt notice of any such claim and
          reasonable cooperation, at your expense, in its defense. You may not
          settle any claim in a way that admits fault on behalf of Caisson
          without our prior written consent.
        </p>
      </Section>

      {/* 10. Intellectual property */}
      <Section eyebrow="IP" title="Intellectual property" band="tint">
        <p style={prose.paragraph}>
          Caisson and its licensors retain all right, title, and interest in and
          to the Software, including all intellectual property rights therein.
          This Agreement grants you a license to use the Software; it does not
          transfer ownership. No rights are granted by implication, estoppel, or
          otherwise beyond those expressly stated in this Agreement.
        </p>
        <p style={prose.paragraph}>
          You retain all right, title, and interest in Your Products and in any
          modifications you make to the Software for use in Your Products,
          subject to Caisson&apos;s underlying rights in the Software and the
          restrictions in this Agreement — you may not use those modifications
          to circumvent the redistribution restriction.
        </p>
        <p style={prose.paragraph}>
          The Caisson name, wordmark, glyph, and associated marks are the
          property of Caisson Software LLC. This Agreement does not grant you
          any right to use those trademarks, except to state, accurately, that
          Your Products are built with Caisson.
        </p>
      </Section>

      {/* 11. Confidentiality */}
      <Section eyebrow="Confidential" title="Confidentiality">
        <p style={prose.paragraph}>
          The Software&apos;s non-public source code, and any non-public
          technical or business information Caisson shares with you in
          connection with an Order (collectively, &ldquo;Confidential
          Information&rdquo;), are confidential. You agree to use Confidential
          Information only as necessary to exercise your rights under this
          Agreement, and not to disclose it to third parties except personnel
          and contractors who need it to work on Your Products and who are bound
          by confidentiality obligations at least as protective as this
          Agreement.
        </p>
        <p style={prose.paragraph}>
          Confidential Information does not include information that is or
          becomes publicly available through no fault of yours, was rightfully
          known to you before disclosure, or is independently developed without
          reference to the Confidential Information.
        </p>
      </Section>

      {/* 12. Assignment & transfer */}
      <Section eyebrow="Assignment" title="Assignment and transfer" band="tint">
        <p style={prose.paragraph}>
          You may not assign or transfer this Agreement or your license without
          Caisson&apos;s prior written consent, except that you may transfer
          your license, without consent, to an entity that acquires
          substantially all of your business or the specific product in which
          the Software is embedded, provided the transferee agrees in writing to
          be bound by this Agreement. Contact us for transfer terms.
        </p>
        <p style={prose.paragraph}>
          Caisson may assign this Agreement in connection with a merger,
          acquisition, or sale of substantially all of its assets, on notice to
          you.
        </p>
      </Section>

      {/* 13. Governing law */}
      <Section eyebrow="Jurisdiction" title="Governing law and disputes">
        <p style={prose.paragraph}>
          This Agreement is governed by and construed in accordance with the
          laws of the State of Georgia, United States, without regard to its
          conflict of law principles.
        </p>
        <p style={prose.paragraph}>
          Any dispute arising under or relating to this Agreement shall be
          resolved exclusively in the state or federal courts located in Fulton
          County, Georgia, and you consent to the personal jurisdiction of those
          courts.
        </p>
        <p style={prose.paragraph}>
          Caisson Software LLC is a limited liability company organized under
          the laws of the State of Georgia, based in Atlanta, Georgia.
        </p>
      </Section>

      {/* 14. Entire agreement */}
      <Section eyebrow="Agreement" title="Entire agreement" band="tint">
        <p style={prose.paragraph}>
          This Agreement, together with your Order confirmation and any
          applicable module- or bundle-specific terms referenced in your
          Entitlement, constitutes the entire agreement between you and Caisson
          regarding the Software, and supersedes all prior or contemporaneous
          understandings regarding its subject matter. Where the plain-language
          summary at{" "}
          <a href="/legal/license" style={{ color: "var(--cs-accent)" }}>
            /legal/license
          </a>{" "}
          and this Agreement conflict, this Agreement governs.
        </p>
        <p style={prose.paragraph}>
          If any provision of this Agreement is held unenforceable, the
          remaining provisions remain in full force. Caisson&apos;s failure to
          enforce a provision is not a waiver of that provision. We may update
          this Agreement for future Orders; the version delivered with your
          Order governs that Order.
        </p>
      </Section>

      {/* 15. Contact */}
      <Section eyebrow="Contact" title="Licensing and legal questions">
        <p style={prose.paragraph}>
          For questions about this Agreement, transfer requests, or enterprise
          terms:
        </p>
        <p style={{ marginTop: "var(--cs-space-4)", ...prose.paragraph }}>
          Caisson Software LLC
          <br />
          Atlanta, Georgia, USA
          <br />
          <a
            href="mailto:admin@caisson.sh"
            style={{ color: "var(--cs-accent)" }}
          >
            admin@caisson.sh
          </a>
        </p>
      </Section>
    </>
  );
}
