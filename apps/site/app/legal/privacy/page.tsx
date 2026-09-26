// OPERATOR REVIEW: rewritten for the open-source model on 2026-09-26; review before launch.
import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";
import { prose } from "../prose";
import { LegalToc, type LegalTocItem } from "../toc";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Caisson handles personal data on caisson.sh: a static site with no accounts, no forms, and minimal data collection.",
  path: "/legal/privacy",
});

const TOC: readonly LegalTocItem[] = [
  { id: "what-we-collect", label: "What we collect" },
  { id: "why-we-collect-it", label: "Why we collect it" },
  { id: "lawful-basis-for-processing", label: "Lawful basis for processing" },
  { id: "how-long-we-keep-it", label: "How long we keep it" },
  { id: "where-your-data-lives", label: "Where your data lives" },
  {
    id: "access-erasure-and-portability",
    label: "Access, erasure, and portability",
  },
  { id: "changes-to-this-policy", label: "Changes to this policy" },
  { id: "get-in-touch", label: "Get in touch" },
];

export default function PrivacyPage() {
  return (
    <>
      <LegalToc items={TOC} />

      {/* Page header */}
      <Section eyebrow="Legal" title="Privacy Policy" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 26 September 2026. Applies to caisson.sh. Caisson the
          software is open source and runs on your own infrastructure; this
          policy covers only the caisson.sh website.
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
            This policy describes how Caisson handles your data. It is being
            finalized with legal counsel and may be updated as our data
            practices are formalized.
          </p>
        </Card>
      </Section>

      {/* What we collect */}
      <Section id="what-we-collect" title="What we collect">
        <h3 style={prose.h3}>The site has no accounts or forms</h3>
        <p style={prose.paragraph}>
          Caisson.sh has no sign-in, no account, and no form that collects
          personal data. We do not ask you for an email address to read the
          docs, view a demo, or start a project.
        </p>

        <h3 style={prose.h3}>Cloudflare infrastructure metadata</h3>
        <p style={prose.paragraph}>
          Caisson.sh is served as static files from Cloudflare&apos;s edge
          network. Cloudflare processes standard HTTP request metadata
          (originating IP address, user-agent, referring URL) for the purposes
          of routing, security filtering, and DDoS protection. This processing
          is governed by{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            rel="noreferrer"
            className="cs-link"
          >
            Cloudflare&apos;s privacy policy
          </a>{" "}
          and the Cloudflare Data Processing Addendum. We do not receive or
          store individual IP addresses or user-agent strings ourselves.
        </p>

        <h3 style={prose.h3}>If you email us</h3>
        <p style={prose.paragraph}>
          If you send an email to one of our published addresses, we hold that
          message and your email address for as long as needed to respond and
          keep a reasonable record of the correspondence. This is the only way
          we come to hold your email address.
        </p>

        <h3 style={prose.h3}>Analytics</h3>
        <p style={prose.paragraph}>
          We use Cloudflare Web Analytics to count page views and measure how
          fast pages load. It sets no cookies, uses no local or session storage,
          and does not fingerprint you or follow you across sites. A small
          script from static.cloudflareinsights.com sends one measurement per
          page view to Cloudflare, and we see only aggregate figures (visits,
          pages, referrers, countries, load times), never an individual visitor.
        </p>
      </Section>

      {/* Why we collect it */}
      <Section id="why-we-collect-it" title="Why we collect it" band="tint">
        <p style={prose.paragraph}>
          We collect no personal data by default. Cloudflare&apos;s request
          metadata exists only to route and secure the site, and the aggregate
          analytics tell us which pages people read and how fast they load. If
          you write to us, we use your email address to answer your message.
        </p>
      </Section>

      {/* Lawful basis */}
      <Section
        id="lawful-basis-for-processing"
        title="Lawful basis for processing"
      >
        <p style={prose.paragraph}>
          For users in the European Economic Area (EEA) or the United Kingdom,
          processing is carried out on the following bases:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>
              Cloudflare infrastructure metadata: legitimate interest.
            </strong>{" "}
            Routing and security processing is necessary to deliver the site
            securely. No alternative exists that does not involve a CDN.
          </li>
          <li style={prose.li}>
            <strong>Aggregate analytics: legitimate interest.</strong> Knowing
            which pages are read and how fast they load lets us maintain the
            docs. It uses no cookies and builds no profile of you.
          </li>
          <li style={prose.li}>
            <strong>Email correspondence: legitimate interest.</strong> You
            initiate contact and provide your address so we can reply; we use it
            for no other purpose.
          </li>
        </ul>
      </Section>

      {/* Retention */}
      <Section id="how-long-we-keep-it" title="How long we keep it" band="tint">
        <p style={prose.paragraph}>
          We keep email correspondence as long as needed to resolve your
          question or report and to maintain a reasonable business record, then
          delete it on request. Cloudflare retains request-level logs and Web
          Analytics data under its own policies; we do not hold a separate copy.
        </p>
      </Section>

      {/* Data location */}
      <Section id="where-your-data-lives" title="Where your data lives">
        <h3 style={prose.h3}>Site: Cloudflare</h3>
        <p style={prose.paragraph}>
          Caisson.sh is served as static files across Cloudflare&apos;s global
          edge network. Cloudflare is certified under the EU-US Data Privacy
          Framework. Their data processing terms apply to request metadata
          processed at the edge.
        </p>

        <h3 style={prose.h3}>Email</h3>
        <p style={prose.paragraph}>
          Correspondence sent to our published addresses is held in the mail
          account tied to that address. We have not published a separate Data
          Processing Addendum for email; contact us at the address below if you
          require one.
        </p>
      </Section>

      {/* Your rights */}
      <Section
        id="access-erasure-and-portability"
        title="Access, erasure, and portability"
        band="tint"
      >
        <p style={prose.paragraph}>
          If you are in the EEA, UK, or another jurisdiction with data
          protection rights, you have the following rights with respect to
          personal data we hold — in practice, this means any email
          correspondence you have sent us:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>Access.</strong> Request a copy of the correspondence we
            hold from you.
          </li>
          <li style={prose.li}>
            <strong>Erasure.</strong> Request that we delete that
            correspondence. We will action this within 30 days, subject to any
            legal retention obligations.
          </li>
          <li style={prose.li}>
            <strong>Portability.</strong> Request your data in a
            machine-readable format. Given the minimal data held, this is a
            one-line response.
          </li>
          <li style={prose.li}>
            <strong>Objection.</strong> Object to processing carried out under
            legitimate interest. We will assess the objection and respond within
            30 days.
          </li>
        </ul>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          To exercise any of these rights, email{" "}
          <a href="mailto:admin@caisson.sh" className="cs-link">
            admin@caisson.sh
          </a>{" "}
          with the subject line &ldquo;Data request: [right you are
          exercising]&rdquo;. We will respond within 30 days. If you are
          unsatisfied with our response, you have the right to lodge a complaint
          with your local supervisory authority.
        </p>
      </Section>

      {/* Changes */}
      <Section id="changes-to-this-policy" title="Changes to this policy">
        <p style={prose.paragraph}>
          We will post material changes to this page and update the &ldquo;Last
          updated&rdquo; date. Continued use of the site after notice
          constitutes acceptance of the updated policy.
        </p>
      </Section>

      {/* Contact */}
      <Section id="get-in-touch" title="Get in touch" band="tint">
        <p style={prose.paragraph}>
          Caisson Software LLC
          <br />
          Atlanta, Georgia, USA
          <br />
          <a href="mailto:admin@caisson.sh" className="cs-link">
            admin@caisson.sh
          </a>
        </p>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          For general questions about the product, use{" "}
          <a href="/docs" className="cs-link">
            the docs
          </a>{" "}
          or the contact link in the site footer.
        </p>
      </Section>
    </>
  );
}
