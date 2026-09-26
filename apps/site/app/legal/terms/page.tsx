// OPERATOR REVIEW: rewritten for the open-source model on 2026-09-26; review before launch.
import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";
import { prose } from "../prose";
import { LegalToc, type LegalTocItem } from "../toc";

export const metadata = buildMetadata({
  title: "Terms of Use",
  description:
    "Terms governing use of caisson.sh. Caisson Software LLC, governed by the laws of Georgia, USA.",
  path: "/legal/terms",
});

const TOC: readonly LegalTocItem[] = [
  { id: "acceptance-of-terms", label: "Acceptance of terms" },
  {
    id: "the-site-and-software-licenses",
    label: "The site and software licenses",
  },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "intellectual-property", label: "Intellectual property" },
  { id: "third-party-services", label: "Third-party services" },
  { id: "disclaimer-of-warranties", label: "Disclaimer of warranties" },
  { id: "limitation-of-liability", label: "Limitation of liability" },
  { id: "governing-law-and-disputes", label: "Governing law and disputes" },
  { id: "changes-to-these-terms", label: "Changes to these terms" },
  { id: "questions", label: "Questions" },
];

export default function TermsPage() {
  return (
    <>
      <LegalToc items={TOC} />

      {/* Page header */}
      <Section eyebrow="Legal" title="Terms of Use" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 25 September 2026. Governs use of caisson.sh.
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
            These terms govern your use of the Caisson site. They are being
            finalized with legal counsel and may be updated. Your rights to use
            Caisson software are defined by the license that ships with each
            package.
          </p>
        </Card>
      </Section>

      {/* Acceptance */}
      <Section id="acceptance-of-terms" title="Acceptance of terms">
        <p style={prose.paragraph}>
          By accessing caisson.sh, you agree to be bound by these Terms of Use.
          If you do not agree, do not use the site.
        </p>
        <p style={prose.paragraph}>
          These Terms apply to the marketing and documentation site at
          caisson.sh. Your rights to use Caisson software are defined
          exclusively by the license that ships with each package. Where these
          Terms and a package license conflict, the package license controls.
        </p>
      </Section>

      {/* The site and software */}
      <Section
        id="the-site-and-software-licenses"
        title="The site and software licenses"
        band="tint"
      >
        <h3 style={prose.h3}>Documentation and site content</h3>
        <p style={prose.paragraph}>
          Product descriptions, code examples, and documentation on caisson.sh
          are provided for informational purposes. While we keep them accurate,
          feature availability may change between versions. The installed
          package is the authoritative source of truth for a given release.
        </p>
      </Section>

      {/* Acceptable use */}
      <Section id="acceptable-use" title="Acceptable use">
        <p style={prose.paragraph}>
          You agree not to use caisson.sh or any Caisson software to:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            Scrape, index, or mirror site content for competing products or
            services without our written permission.
          </li>
          <li style={prose.li}>
            Circumvent or interfere with any security, authentication, or access
            control mechanism on the site.
          </li>
          <li style={prose.li}>
            Use the site in any way that violates applicable law or the rights
            of third parties.
          </li>
        </ul>
        <p style={prose.paragraph}>
          We reserve the right to block access to the site for conduct that
          violates these terms.
        </p>
      </Section>

      {/* Intellectual property */}
      <Section
        id="intellectual-property"
        title="Intellectual property"
        band="tint"
      >
        <p style={prose.paragraph}>
          All content on caisson.sh (including text, code examples, diagrams,
          the Caisson wordmark and glyph, and the documentation) is owned by
          Caisson Software LLC or its licensors. All rights reserved.
        </p>
        <p style={prose.paragraph}>
          You may link to caisson.sh and quote brief excerpts for the purpose of
          review, commentary, or education, provided you attribute the source
          and do not imply any endorsement.
        </p>
        <p style={prose.paragraph}>
          The Caisson name, wordmark, glyph, and &ldquo;Fail-closed by
          construction&rdquo; tagline are proprietary marks of Caisson Software
          LLC. Use in public materials requires written permission.
        </p>
        <p style={prose.paragraph}>
          Rights to use Caisson software are governed exclusively by the license
          that ships with each package, not by these Terms.
        </p>
      </Section>

      {/* Third-party services */}
      <Section id="third-party-services" title="Third-party services">
        <p style={prose.paragraph}>
          The site uses one third-party infrastructure service: Cloudflare
          (hosting and edge delivery). Your use of this site involves processing
          governed by Cloudflare&apos;s terms to the extent described in our{" "}
          <a href="/legal/privacy" className="cs-link">
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
      <Section
        id="disclaimer-of-warranties"
        title="Disclaimer of warranties"
        band="tint"
      >
        <Card style={{ marginTop: "var(--cs-space-4)" }}>
          <p style={{ ...prose.paragraph, marginTop: 0, ...prose.conspicuous }}>
            The site and its contents are provided &ldquo;as is&rdquo; and
            &ldquo;as available&rdquo; without warranty of any kind. To the
            maximum extent permitted by applicable law, Caisson Software LLC
            disclaims all warranties, express or implied, including but not
            limited to warranties of merchantability, fitness for a particular
            purpose, and non-infringement.
          </p>
        </Card>
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
      <Section id="limitation-of-liability" title="Limitation of liability">
        <Card style={{ marginTop: "var(--cs-space-4)" }}>
          <p style={{ ...prose.paragraph, marginTop: 0, ...prose.conspicuous }}>
            To the maximum extent permitted by applicable law, in no event shall
            Caisson Software LLC or its officers, directors, employees, or
            contractors be liable for any indirect, incidental, special,
            consequential, or punitive damages arising out of or related to your
            use of this site, even if advised of the possibility of such
            damages.
          </p>
          <p
            style={{
              ...prose.paragraph,
              ...prose.conspicuous,
              marginTop: "var(--cs-space-3)",
            }}
          >
            Caisson Software LLC&apos;s total liability to you for claims
            arising from your use of this site shall not exceed one hundred US
            dollars (USD 100). Liability arising from the use of Caisson
            software is governed by the license that ships with it.
          </p>
        </Card>
      </Section>

      {/* Governing law */}
      <Section
        id="governing-law-and-disputes"
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
          Caisson Software LLC is a limited liability company registered in the
          State of Georgia, USA.
        </p>
      </Section>

      {/* Changes */}
      <Section id="changes-to-these-terms" title="Changes to these terms">
        <p style={prose.paragraph}>
          We may update these Terms at any time. Material changes will be posted
          on this page with an updated &ldquo;Last updated&rdquo; date.
          Continued use of the site after notice constitutes acceptance of the
          updated Terms.
        </p>
      </Section>

      {/* Contact */}
      <Section id="questions" title="Questions" band="tint">
        <p style={prose.paragraph}>
          Questions about these Terms? Contact us at:
        </p>
        <p style={{ marginTop: "var(--cs-space-4)", ...prose.paragraph }}>
          Caisson Software LLC
          <br />
          Atlanta, Georgia, USA
          <br />
          <a href="mailto:support@caisson.sh" className="cs-link">
            support@caisson.sh
          </a>
        </p>
      </Section>
    </>
  );
}
