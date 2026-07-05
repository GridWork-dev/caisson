import type { CSSProperties } from "react";

import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";

export const metadata = buildMetadata({
  title: "EULA",
  description:
    "The binding Caisson End User License Agreement (EULA) — the Commercial License Agreement governing your purchase and use of Caisson software. GridWork Digital LLC, governed by the laws of Georgia, USA.",
  path: "/legal/eula",
});

// `ch` is defined against the font's "0" glyph, not its average character width — Hubot Sans's
// "0" is narrow enough that the original `72ch`/`68ch` resolved to ~742-766px, fitting ~100-110
// real characters per line (measured live), well past the 65-75ch readability cap the values were
// meant to enforce (visual-audit remediation). Fixed rem widths, tuned against this typeface's
// actual measured ~7.1px average character width at 16px, replace the ch units: 33rem/31rem land
// paragraph/list back in the 65-75-real-character band this page's dense legal prose needs.
const prose = {
  paragraph: {
    marginTop: "var(--cs-space-4)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "33rem",
  } as CSSProperties,
  h3: {
    marginTop: "var(--cs-space-8)",
    marginBottom: "var(--cs-space-3)",
    fontSize: "var(--cs-text-lg)",
    fontWeight: "var(--cs-weight-semibold)",
    letterSpacing: "var(--cs-tracking-tight)",
  } as CSSProperties,
  list: {
    marginTop: "var(--cs-space-3)",
    paddingLeft: "var(--cs-space-5)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "31rem",
  } as CSSProperties,
  li: {
    marginBottom: "var(--cs-space-2)",
  } as CSSProperties,
};

export default function EulaPage() {
  return (
    <>
      {/* Page header */}
      <Section eyebrow="Legal" title="End User License Agreement" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 27 June 2026. The binding Commercial License Agreement
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
          &ldquo;EULA&rdquo;) is between GridWork Digital LLC, a limited
          liability company registered in the State of Georgia, USA
          (&ldquo;GridWork,&rdquo; &ldquo;we,&rdquo; or &ldquo;us&rdquo;), and
          the individual or entity that purchases a Caisson software license
          (&ldquo;Licensee&rdquo; or &ldquo;you&rdquo;).
        </p>

        <h3 style={prose.h3}>Definitions</h3>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>&ldquo;Software&rdquo;</strong> means the Caisson source
            code, the packages under the <code className="mono">@caisson</code>{" "}
            scope, related documentation, and any updates delivered under a
            Compliance Updates subscription, as licensed to you under this
            Agreement.
          </li>
          <li style={prose.li}>
            <strong>&ldquo;Entitlement&rdquo;</strong> means the record of which
            modules and editions you are licensed to access, verified by a
            signed Ed25519 offline license key.
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
        </ul>
      </Section>

      {/* 2. License grant */}
      <Section eyebrow="Grant" title="License grant" band="tint">
        <p style={prose.paragraph}>
          Subject to your compliance with this Agreement and full payment of
          applicable fees, GridWork grants you a{" "}
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
          offline license key covering the modules and editions purchased. The
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
          fees are exclusive of taxes unless stated otherwise, and are
          non-refundable except as required by applicable law or as GridWork
          agrees in writing.
        </p>
        <p style={prose.paragraph}>
          The perpetual license fee is a one-time charge. A Compliance Updates
          subscription, where purchased, is billed on a recurring basis until
          cancelled and grants access to new package versions with updated
          control mappings; it is optional and does not affect the perpetual
          license for versions already delivered.
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
          Disclaimer of warranties, Limitation of liability, Indemnification,
          Intellectual property, Confidentiality, and Governing law — survive.
        </p>
      </Section>

      {/* 7. Warranty disclaimer */}
      <Section eyebrow="Warranty" title="Disclaimer of warranties">
        <p style={prose.paragraph}>
          THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE,&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. GRIDWORK DOES NOT WARRANT THAT THE SOFTWARE WILL BE
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
          GRIDWORK OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR CONTRACTORS BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE,
          DATA, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO THIS
          AGREEMENT OR THE SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
          DAMAGES.
        </p>
        <p style={prose.paragraph}>
          GRIDWORK&apos;S TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED
          TO THIS AGREEMENT WILL NOT EXCEED THE TOTAL FEES YOU ACTUALLY PAID TO
          GRIDWORK FOR THE SOFTWARE GIVING RISE TO THE CLAIM IN THE TWELVE (12)
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
          You agree to indemnify, defend, and hold harmless GridWork and its
          officers, directors, employees, and contractors from any claim, loss,
          liability, damage, or expense (including reasonable attorneys&apos;
          fees) arising out of or related to: (a) Your Products; (b) your use of
          the Software in violation of this Agreement; or (c) your violation of
          applicable law.
        </p>
        <p style={prose.paragraph}>
          GridWork will provide you with prompt notice of any such claim and
          reasonable cooperation, at your expense, in its defense. You may not
          settle any claim in a way that admits fault on behalf of GridWork
          without our prior written consent.
        </p>
      </Section>

      {/* 10. Intellectual property */}
      <Section eyebrow="IP" title="Intellectual property" band="tint">
        <p style={prose.paragraph}>
          GridWork and its licensors retain all right, title, and interest in
          and to the Software, including all intellectual property rights
          therein. This Agreement grants you a license to use the Software; it
          does not transfer ownership. No rights are granted by implication,
          estoppel, or otherwise beyond those expressly stated in this
          Agreement.
        </p>
        <p style={prose.paragraph}>
          You retain all right, title, and interest in Your Products and in any
          modifications you make to the Software for use in Your Products,
          subject to GridWork&apos;s underlying rights in the Software and the
          restrictions in this Agreement — you may not use those modifications
          to circumvent the redistribution restriction.
        </p>
        <p style={prose.paragraph}>
          The Caisson name, wordmark, glyph, and associated marks are the
          property of GridWork Digital LLC. This Agreement does not grant you
          any right to use GridWork&apos;s or Caisson&apos;s trademarks, except
          to state, accurately, that Your Products are built with Caisson.
        </p>
      </Section>

      {/* 11. Confidentiality */}
      <Section eyebrow="Confidential" title="Confidentiality">
        <p style={prose.paragraph}>
          The Software&apos;s non-public source code, and any non-public
          technical or business information GridWork shares with you in
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
          GridWork&apos;s prior written consent, except that you may transfer
          your license, without consent, to an entity that acquires
          substantially all of your business or the specific product in which
          the Software is embedded, provided the transferee agrees in writing to
          be bound by this Agreement. Contact us for transfer terms.
        </p>
        <p style={prose.paragraph}>
          GridWork may assign this Agreement in connection with a merger,
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
          GridWork Digital LLC is a limited liability company registered in the
          State of Georgia, USA.
        </p>
      </Section>

      {/* 14. Entire agreement */}
      <Section eyebrow="Agreement" title="Entire agreement" band="tint">
        <p style={prose.paragraph}>
          This Agreement, together with your Order confirmation and any
          applicable module- or edition-specific terms referenced in your
          Entitlement, constitutes the entire agreement between you and GridWork
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
          remaining provisions remain in full force. GridWork&apos;s failure to
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
          GridWork Digital LLC
          <br />
          Atlanta, Georgia, USA
          <br />
          <a
            href="mailto:<email>"
            style={{ color: "var(--cs-accent)" }}
          >
            <email>
          </a>
        </p>
      </Section>
    </>
  );
}
