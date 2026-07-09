import { buildMetadata } from "@/lib/metadata";
import { Card, Section } from "@/components";
import { prose } from "../prose";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Caisson collects and handles personal data on caisson.sh — product-update email, purchase account communications, cookieless analytics, and your rights under GDPR.",
  path: "/legal/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      {/* Page header */}
      <Section eyebrow="Legal" title="Privacy Policy" flush as="h1">
        <p className="cs-lede" style={{ marginTop: "var(--cs-space-3)" }}>
          Last updated: 27 June 2026. Applies to caisson.sh and the Caisson
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
            This policy describes how Caisson handles your data. It is being
            finalized with legal counsel and may be updated as our data
            practices are formalized.
          </p>
        </Card>
      </Section>

      {/* What we collect */}
      <Section eyebrow="Data" title="What we collect">
        <h3 style={prose.h3}>Email address</h3>
        <p style={prose.paragraph}>
          When you subscribe to product updates or complete a purchase on this
          site, we collect your email address. That is the only piece of
          personally identifying information we ask for at the point of sign-up.
          Purchase checkout collects the additional information necessary to
          process payment and deliver your license entitlement. Payment is
          processed by Paddle, our merchant of record — we do not receive or
          store your payment card details.
        </p>

        <h3 style={prose.h3}>Cloudflare infrastructure metadata</h3>
        <p style={prose.paragraph}>
          Caisson.sh is served by Railway, with Cloudflare in front as DNS and
          reverse proxy. Cloudflare processes standard HTTP request metadata
          (originating IP address, user-agent, referring URL) for the purposes
          of routing, security filtering, and DDoS protection. This processing
          is governed by{" "}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            rel="noreferrer"
            style={{ color: "var(--cs-accent)" }}
          >
            Cloudflare&apos;s privacy policy
          </a>{" "}
          and the Cloudflare Data Processing Addendum. We do not receive or
          store individual IP addresses or user-agent strings ourselves.
        </p>

        <h3 style={prose.h3}>Cookieless page-view analytics</h3>
        <p style={prose.paragraph}>
          We use{" "}
          <a
            href="https://plausible.io"
            rel="noreferrer"
            style={{ color: "var(--cs-accent)" }}
          >
            Plausible Analytics
          </a>{" "}
          to understand aggregate traffic patterns. Plausible is cookieless by
          design: it does not set cookies, does not fingerprint individual
          browsers, does not track visitors across sites, and does not collect
          personally identifiable information. The data Plausible reports is
          aggregate only (page paths, referrers, country-level geography,
          browser family). No consent banner is required for this analytics
          implementation.
        </p>

        <h3 style={prose.h3}>Ask-AI questions</h3>
        <p style={prose.paragraph}>
          Questions submitted to the on-site Ask-AI widget are stored to improve
          the product and its documentation. The stored record is the question
          text, the date, and whether it was answered — never your IP address,
          account identity, or the generated answer. The widget carries the same
          notice where you type: do not include secrets or personal data in a
          question. Stored questions are hard-deleted after 90 days.
        </p>
      </Section>

      {/* Why we collect it */}
      <Section eyebrow="Purpose" title="Why we collect it" band="tint">
        <h3 style={prose.h3}>
          Email — product updates and account communications
        </h3>
        <p style={prose.paragraph}>
          We collect your email address to send you product-update notifications
          (new releases, changelog highlights, product news) and to deliver
          essential account communications such as purchase confirmations,
          license entitlements, and support correspondence. We will not send
          marketing email unrelated to Caisson, sell your address, or share it
          with third parties except as required to operate these communications
          (Resend — see Data location, below).
        </p>

        <h3 style={prose.h3}>Analytics — aggregate site improvement</h3>
        <p style={prose.paragraph}>
          Aggregate, anonymous page-view data helps us understand which
          documentation and marketing pages are useful. No individual is
          identifiable in the data we receive.
        </p>
      </Section>

      {/* Lawful basis */}
      <Section eyebrow="GDPR" title="Lawful basis for processing">
        <p style={prose.paragraph}>
          For users in the European Economic Area (EEA) or the United Kingdom,
          processing is carried out on the following bases:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>Email address (product updates) — consent.</strong> You
            provided your address by submitting the product-updates form, having
            been told at the point of submission that signing up means
            occasional product email. You may withdraw consent at any time by
            requesting deletion of your address (see Your rights, below).
          </li>
          <li style={prose.li}>
            <strong>Email address (purchase / account) — contract.</strong>{" "}
            Processing is necessary to perform the contract of sale, deliver
            your license entitlement, and respond to support requests.
          </li>
          <li style={prose.li}>
            <strong>
              Cloudflare infrastructure metadata — legitimate interest.
            </strong>{" "}
            Routing and security processing is necessary to deliver the site
            securely. No alternative exists that does not involve a CDN.
          </li>
          <li style={prose.li}>
            <strong>Plausible analytics — legitimate interest.</strong>{" "}
            Cookieless, PII-free aggregate analytics carry a minimal privacy
            impact while providing a legitimate operational benefit. You may
            object by using a content blocker that targets plausible.io.
          </li>
        </ul>
      </Section>

      {/* Retention */}
      <Section eyebrow="Retention" title="How long we keep it" band="tint">
        <p style={prose.paragraph}>
          We retain product-update subscriber email addresses until one of the
          following occurs:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>You unsubscribe or request deletion.</li>
          <li style={prose.li}>
            We discontinue the product-update mailing list and have no further
            basis to retain it.
          </li>
          <li style={prose.li}>
            Three years pass without any active communication (we will delete
            the record and notify you).
          </li>
        </ul>
        <p style={prose.paragraph}>
          Purchase and account email addresses are retained for as long as
          required to fulfill the contract and comply with applicable tax and
          legal obligations, which may exceed the subscription retention period
          above.
        </p>
        <p style={prose.paragraph}>
          Plausible retains aggregate analytics data per their own retention
          policy. Because no PII is collected by Plausible, no individual
          retention period applies on our end.
        </p>
      </Section>

      {/* Data location */}
      <Section eyebrow="Infrastructure" title="Where your data lives">
        <h3 style={prose.h3}>Payment and order data — Paddle</h3>
        <p style={prose.paragraph}>
          Purchases are processed by Paddle, acting as merchant of record and
          reseller. Paddle collects the billing and payment information
          necessary to complete your order, calculate and remit applicable sales
          tax and VAT, and issue your order receipt; we do not receive or store
          your payment card details. Paddle&apos;s handling of this data —
          including which Paddle entity processes your order — is governed by{" "}
          <a
            href="https://www.paddle.com/legal/privacy"
            rel="noreferrer"
            style={{ color: "var(--cs-accent)" }}
          >
            Paddle&apos;s own privacy policy
          </a>
          .
        </p>

        <h3 style={prose.h3}>Email — Resend</h3>
        <p style={prose.paragraph}>
          Email addresses are stored and managed by{" "}
          <a
            href="https://resend.com"
            rel="noreferrer"
            style={{ color: "var(--cs-accent)" }}
          >
            Resend
          </a>
          , a transactional email infrastructure provider. Resend is a US-based
          company. EEA customers may request a Data Processing Addendum (DPA)
          covering Standard Contractual Clauses. Contact us at the address below
          if you require a DPA.
        </p>

        <h3 style={prose.h3}>Site — Railway + Cloudflare</h3>
        <p style={prose.paragraph}>
          Caisson.sh is served by Railway. Cloudflare remains in front as DNS
          and reverse proxy across Cloudflare&apos;s global edge network.
          Cloudflare is certified under the EU-US Data Privacy Framework. Their
          data processing terms apply to request metadata processed at the edge.
        </p>

        <h3 style={prose.h3}>Analytics — Plausible</h3>
        <p style={prose.paragraph}>
          Plausible Analytics is EU-based and stores aggregate data on servers
          in the EU. Because no PII is collected, no cross-border transfer
          assessment is required for this service.
        </p>
      </Section>

      {/* Your rights */}
      <Section
        eyebrow="Your rights"
        title="Access, erasure, and portability"
        band="tint"
      >
        <p style={prose.paragraph}>
          If you are in the EEA, UK, or another jurisdiction with data
          protection rights, you have the following rights with respect to
          personal data we hold:
        </p>
        <ul style={prose.list}>
          <li style={prose.li}>
            <strong>Access.</strong> Request a copy of the personal data we hold
            about you (in practice: your email address and the date it was
            submitted).
          </li>
          <li style={prose.li}>
            <strong>Erasure.</strong> Request that we delete your email address
            from our records. We will action this within 30 days, subject to any
            legal retention obligations.
          </li>
          <li style={prose.li}>
            <strong>Portability.</strong> Request your data in a
            machine-readable format (CSV or JSON). Given the minimal data held,
            this is a one-line response.
          </li>
          <li style={prose.li}>
            <strong>Objection.</strong> Object to processing carried out under
            legitimate interest. We will assess the objection and respond within
            30 days.
          </li>
          <li style={prose.li}>
            <strong>Withdrawal of consent.</strong> Withdraw the consent on
            which product-update email processing is based at any time. This
            does not affect lawfulness of processing before withdrawal.
          </li>
        </ul>
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          To exercise any of these rights, email{" "}
          <a
            href="mailto:admin@caisson.sh"
            style={{ color: "var(--cs-accent)" }}
          >
            admin@caisson.sh
          </a>{" "}
          with the subject line &ldquo;Data request — [right you are
          exercising]&rdquo;. We will respond within 30 days. If you are
          unsatisfied with our response, you have the right to lodge a complaint
          with your local supervisory authority.
        </p>
      </Section>

      {/* Changes */}
      <Section eyebrow="Updates" title="Changes to this policy">
        <p style={prose.paragraph}>
          We will post material changes to this page and update the &ldquo;Last
          updated&rdquo; date. If the change materially affects how we use your
          email address, we will notify you by email before the change takes
          effect. Continued use of the site after notice constitutes acceptance
          of the updated policy.
        </p>
      </Section>

      {/* Contact */}
      <Section eyebrow="Contact" title="Get in touch" band="tint">
        <p style={prose.paragraph}>
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
        <p style={{ marginTop: "var(--cs-space-5)", ...prose.paragraph }}>
          For general questions about the product, use{" "}
          <a href="/docs" style={{ color: "var(--cs-accent)" }}>
            the docs
          </a>{" "}
          or the contact link in the site footer.
        </p>
      </Section>
    </>
  );
}
