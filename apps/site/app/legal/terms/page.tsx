import type { CSSProperties } from "react";

import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";

export const metadata = buildMetadata({
  title: "Terms of Use",
  description:
    "Terms governing use of caisson.sh and the Caisson early-access program. GridWork Digital LLC, governed by the laws of Georgia, USA.",
  path: "/legal/terms",
});

const prose = {
  paragraph: {
    marginTop: "var(--cs-space-4)",
    lineHeight: "var(--cs-leading-relaxed)",
    maxWidth: "72ch",
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
    maxWidth: "68ch",
  } as CSSProperties,
  li: {
    marginBottom: "var(--cs-space-2)",
  } as CSSProperties,
};

export default function TermsPage() {
  return (
    <>
      {/* Page header */}
      <Section eyebrow="Legal" title="Terms of Use" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 27 June 2026. Governs use of caisson.sh and
          participation in the Caisson early-access program.
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
            Working draft — operator legal review required before launch
          </p>
          <p style={{ marginTop: "var(--cs-space-3)", ...prose.paragraph }}>
            This document is a working draft prepared for internal review. It is
            not legal advice and has not been reviewed by Caisson&apos;s legal
            counsel. It will be replaced by a reviewed document before the
            early-access program opens to the public.
          </p>
        </Card>
      </Section>

      {/* Acceptance */}
      <Section eyebrow="Agreement" title="Acceptance of terms">
        <p style={prose.paragraph}>
          By accessing caisson.sh or joining the Caisson early-access program,
          you agree to be bound by these Terms of Use. If you do not agree, do
          not use the site or the program.
        </p>
        <p style={prose.paragraph}>
          These Terms apply to the marketing and documentation site at
          caisson.sh and to participation in the pre-launch waitlist and
          early-access program. They do not govern purchase or use of Caisson
          software — those rights are defined by the separate Commercial License
          Agreement (
          <a href="/legal/license" style={{ color: "var(--cs-accent)" }}>
            see License
          </a>
          ) and the purchase order or entitlement record you receive at
          checkout.
        </p>
      </Section>

      {/* The site and early-access program */}
      <Section
        eyebrow="Scope"
        title="The site and early-access program"
        band="tint"
      >
        <h3 style={prose.h3}>Informational nature of the site</h3>
        <p style={prose.paragraph}>
          Caisson.sh is an informational and pre-launch marketing site. Product
          descriptions, pricing, and feature sets described on the site are
          indicative and subject to change before launch. Nothing on the site
          constitutes a binding offer of sale.
        </p>

        <h3 style={prose.h3}>Early-access waitlist</h3>
        <p style={prose.paragraph}>
          Joining the early-access waitlist places you in a queue to be notified
          when Caisson opens for purchase. Waitlist participation does not
          create a purchase commitment on either side, does not reserve
          capacity, and does not guarantee access at any specific price or date.
          We may close or modify the waitlist at any time.
        </p>

        <h3 style={prose.h3}>Pre-launch pricing</h3>
        <p style={prose.paragraph}>
          Any prices shown on this site are indicative placeholder prices. Final
          pricing will be confirmed before the program launches. A persistent
          notice on the pricing page makes this explicit. Grandfathering policy
          for early-access participants will be communicated at launch.
        </p>
      </Section>

      {/* Acceptable use */}
      <Section eyebrow="Conduct" title="Acceptable use">
        <p style={prose.paragraph}>
          You agree not to use caisson.sh or the early-access program to:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            Scrape, index, or mirror site content for competing products or
            services without our written permission.
          </li>
          <li style={prose.li}>
            Submit false, misleading, or third-party email addresses to the
            waitlist.
          </li>
          <li style={prose.li}>
            Circumvent or interfere with any security, authentication, or access
            control mechanism on the site.
          </li>
          <li style={prose.li}>
            Use the site in any way that violates applicable law or the rights
            of third parties.
          </li>
          <li style={prose.li}>
            Transmit spam, malware, or any harmful code through any submission
            form on the site.
          </li>
        </ul>
        <p style={prose.paragraph}>
          We reserve the right to remove you from the waitlist and block access
          to the site for conduct that violates these terms.
        </p>
      </Section>

      {/* Intellectual property */}
      <Section eyebrow="IP" title="Intellectual property" band="tint">
        <p style={prose.paragraph}>
          All content on caisson.sh — including text, code examples, diagrams,
          the Caisson wordmark and glyph, and the documentation — is owned by
          GridWork Digital LLC or its licensors. All rights reserved.
        </p>
        <p style={prose.paragraph}>
          You may link to caisson.sh and quote brief excerpts for the purpose of
          review, commentary, or education, provided you attribute the source
          and do not imply any endorsement.
        </p>
        <p style={prose.paragraph}>
          The Caisson name, wordmark, glyph, and &ldquo;Fail-closed by
          construction&rdquo; tagline are proprietary marks of GridWork Digital
          LLC. Use in public materials requires written permission.
        </p>
        <p style={prose.paragraph}>
          Rights to use Caisson software are governed exclusively by the
          Commercial License Agreement, not by these Terms.
        </p>
      </Section>

      {/* Third-party services */}
      <Section eyebrow="Third parties" title="Third-party services">
        <p style={prose.paragraph}>
          The site uses third-party infrastructure services including Cloudflare
          (CDN and edge delivery), Resend (transactional email), and Plausible
          Analytics (cookieless, PII-free analytics). Your use of this site
          involves processing governed by those providers&apos; terms to the
          extent described in our{" "}
          <a href="/legal/privacy" style={{ color: "var(--cs-accent)" }}>
            Privacy Policy
          </a>
          .
        </p>
        <p style={prose.paragraph}>
          Links from caisson.sh to third-party sites are provided for
          convenience. We do not control and are not responsible for the
          content, privacy practices, or availability of third-party sites.
        </p>
      </Section>

      {/* Disclaimer */}
      <Section eyebrow="Warranty" title="Disclaimer of warranties" band="tint">
        <p style={prose.paragraph}>
          THE SITE AND EARLY-ACCESS PROGRAM ARE PROVIDED &ldquo;AS IS&rdquo; AND
          &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND. TO THE
          MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, GRIDWORK DIGITAL LLC
          DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT
          LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p style={prose.paragraph}>
          We do not warrant that the site will be uninterrupted, error-free, or
          free of harmful components. Information on the site, including product
          descriptions and indicative pricing, is subject to change without
          notice.
        </p>
        <p style={prose.paragraph}>
          Nothing on this site constitutes compliance, legal, or security
          advice. Caisson ships technical controls; whether those controls
          satisfy a specific regulatory requirement in your jurisdiction is a
          determination you must make, typically with qualified legal counsel.
        </p>
      </Section>

      {/* Limitation of liability */}
      <Section eyebrow="Liability" title="Limitation of liability">
        <p style={prose.paragraph}>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
          GRIDWORK DIGITAL LLC OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR
          CONTRACTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR
          USE OF THIS SITE OR THE EARLY-ACCESS PROGRAM, EVEN IF ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p style={prose.paragraph}>
          GRIDWORK DIGITAL LLC&apos;S TOTAL LIABILITY TO YOU FOR CLAIMS ARISING
          FROM YOUR USE OF THIS SITE SHALL NOT EXCEED ONE HUNDRED US DOLLARS
          (USD $100).
        </p>
      </Section>

      {/* Governing law */}
      <Section
        eyebrow="Jurisdiction"
        title="Governing law and disputes"
        band="tint"
      >
        <p style={prose.paragraph}>
          These Terms are governed by and construed in accordance with the laws
          of the State of Georgia, United States, without regard to its conflict
          of law principles.
        </p>
        <p style={prose.paragraph}>
          Any dispute arising under or relating to these Terms shall be resolved
          exclusively in the state or federal courts located in [County
          placeholder], Georgia, and you consent to the personal jurisdiction of
          those courts. [Operator: confirm county / venue before launch.]
        </p>
        <p style={prose.paragraph}>
          GridWork Digital LLC is a limited liability company registered in the
          State of Georgia, USA.
        </p>
      </Section>

      {/* Changes */}
      <Section eyebrow="Updates" title="Changes to these terms">
        <p style={prose.paragraph}>
          We may update these Terms at any time. Material changes will be posted
          on this page with an updated &ldquo;Last updated&rdquo; date. If you
          are on the early-access waitlist, we will notify you by email before a
          material change takes effect. Continued participation in the
          early-access program after notice constitutes acceptance of the
          updated Terms.
        </p>
      </Section>

      {/* Contact */}
      <Section eyebrow="Contact" title="Questions" band="tint">
        <p style={prose.paragraph}>
          Questions about these Terms? Contact us at:
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
