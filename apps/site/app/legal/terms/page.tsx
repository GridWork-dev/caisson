import type { CSSProperties } from "react";
import Link from "next/link";

import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";

export const metadata = buildMetadata({
  title: "Terms of Use",
  description:
    "Terms governing use of caisson.sh and purchase of Caisson software licenses. GridWork Digital LLC, governed by the laws of Georgia, USA.",
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
          Last updated: 27 June 2026. Governs use of caisson.sh and purchase of
          Caisson software.
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
            These terms govern your use of the Caisson site and products. They
            are being finalized with legal counsel and may be updated. The
            controlling document for any purchase is the Commercial License
            Agreement (&ldquo;EULA&rdquo;), available at{" "}
            <Link href="/legal/eula">caisson.sh/legal/eula</Link> and provided
            at checkout.
          </p>
        </Card>
      </Section>

      {/* Acceptance */}
      <Section eyebrow="Agreement" title="Acceptance of terms">
        <p style={prose.paragraph}>
          By accessing caisson.sh, purchasing a Caisson software license, or
          subscribing to product updates, you agree to be bound by these Terms
          of Use. If you do not agree, do not use the site or purchase a
          license.
        </p>
        <p style={prose.paragraph}>
          These Terms apply to the marketing and documentation site at
          caisson.sh and to product-update communications we send you. Your
          rights to use Caisson software are defined exclusively by the
          Commercial License Agreement (
          <a href="/legal/license" style={{ color: "var(--cs-accent)" }}>
            see License
          </a>
          ) and the purchase record or entitlement you receive at checkout.
          Where these Terms and the Commercial License Agreement conflict, the
          Commercial License Agreement controls.
        </p>
      </Section>

      {/* The site and software */}
      <Section
        eyebrow="Scope"
        title="The site and software licenses"
        band="tint"
      >
        <h3 style={prose.h3}>Commercial product</h3>
        <p style={prose.paragraph}>
          Caisson is a commercially available software library. Prices shown on
          the site are the current listed prices for each edition and module. A
          purchase grants you a{" "}
          <a href="/legal/license" style={{ color: "var(--cs-accent)" }}>
            LicenseRef-Caisson-Commercial
          </a>{" "}
          license: buy once, build unlimited products — you may not resell or
          redistribute the Caisson source or compiled output as a standalone
          library.
        </p>

        <h3 style={prose.h3}>Documentation and site content</h3>
        <p style={prose.paragraph}>
          Product descriptions, code examples, and documentation on caisson.sh
          are provided for informational purposes. While we keep them accurate,
          feature availability and pricing may change between versions. The
          installed package is the authoritative source of truth for a given
          release.
        </p>

        <h3 style={prose.h3}>Product-update communications</h3>
        <p style={prose.paragraph}>
          If you subscribe to product updates on the site, we will send you
          occasional emails about new releases, changelog highlights, and
          product news. You may unsubscribe at any time using the link in any
          email we send.
        </p>
      </Section>

      {/* Acceptable use */}
      <Section eyebrow="Conduct" title="Acceptable use">
        <p style={prose.paragraph}>
          You agree not to use caisson.sh or any Caisson software to:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            Scrape, index, or mirror site content for competing products or
            services without our written permission.
          </li>
          <li style={prose.li}>
            Submit false or misleading contact information to any form on the
            site.
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
          We reserve the right to cancel licenses and block access to the site
          for conduct that violates these terms.
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
          THE SITE AND ITS CONTENTS ARE PROVIDED &ldquo;AS IS&rdquo; AND
          &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND. TO THE
          MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, GRIDWORK DIGITAL LLC
          DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT
          LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p style={prose.paragraph}>
          We do not warrant that the site will be uninterrupted, error-free, or
          free of harmful components. Product details on the site may be updated
          between releases.
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
          USE OF THIS SITE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p style={prose.paragraph}>
          GRIDWORK DIGITAL LLC&apos;S TOTAL LIABILITY TO YOU FOR CLAIMS ARISING
          FROM YOUR USE OF THIS SITE SHALL NOT EXCEED ONE HUNDRED US DOLLARS
          (USD $100). LIABILITY ARISING FROM THE USE OF CAISSON SOFTWARE IS
          GOVERNED BY THE COMMERCIAL LICENSE AGREEMENT.
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
          exclusively in the state or federal courts located in Fulton County,
          Georgia, and you consent to the personal jurisdiction of those courts.
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
          are a Caisson license holder or product-updates subscriber, we will
          notify you by email before a material change takes effect. Continued
          use of the site after notice constitutes acceptance of the updated
          Terms.
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
