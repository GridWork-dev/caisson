// Dev-only branded-email preview (mirrors the Wardfile ADR-0105 pattern): renders every
// `@caisson/email` React-Email template with sample data so it can be reviewed without sending.
// Gated to non-production, no secrets, no send.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
  type EmailTemplateId,
  type TemplateDataMap,
} from "@caisson/email";

export const metadata: Metadata = {
  title: "Email preview (dev)",
  robots: { index: false, follow: false },
};

const SAMPLE_DATA: { [K in EmailTemplateId]: TemplateDataMap[K] } = {
  "magic-link": {
    url: "https://caisson.sh/api/auth/magic-link/verify?token=sample",
  },
  "password-reset": {
    url: "https://caisson.sh/api/auth/reset-password/sample?callbackURL=/reset-password",
  },
  "verify-email": {
    url: "https://caisson.sh/api/auth/verify-email?token=sample",
  },
  "credits-expiring": {
    credits: 120,
    expiresOn: "2027-07-06",
    url: "https://caisson.sh/dashboard/credits",
  },
  "purchase-confirmation": {
    buyerName: "Sample Buyer",
    orderId: "txn_01sample",
    currency: "usd",
    amountTotalMinor: 104900,
    lines: [{ label: "Compliance bundle", amountMinor: 104900 }],
    dashboardUrl: "https://caisson.sh/dashboard",
  },
  "subscription-payment-received": {
    buyerName: "Sample Buyer",
    orderId: "txn_01cycle",
    currency: "usd",
    amountTotalMinor: 149900,
    lines: [{ label: "Compliance Updates" }],
    dashboardUrl: "https://caisson.sh/dashboard",
  },
  "renewal-confirmation": {
    buyerName: "Sample Buyer",
    orderId: "txn_01sample",
    currency: "usd",
    amountTotalMinor: 41900,
    lines: [{ label: "Compliance bundle", newWindowEnd: "2028-07-06" }],
    dashboardUrl: "https://caisson.sh/dashboard",
  },
};

// A generic helper keeps `id` and its sample data type-correlated across the map call.
function renderSample<K extends EmailTemplateId>(id: K) {
  return renderEmailTemplate(id, SAMPLE_DATA[id]);
}

export default async function EmailPreviewPage(): Promise<React.ReactElement> {
  if (process.env.NODE_ENV === "production") notFound();

  const rendered = await Promise.all(
    EMAIL_TEMPLATE_IDS.map(async (id) => ({
      id,
      ...(await renderSample(id)),
    })),
  );

  return (
    <main
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "var(--cs-space-8)",
      }}
    >
      <h1
        style={{
          fontSize: "var(--cs-text-2xl)",
          margin: "0 0 var(--cs-space-2)",
        }}
      >
        Email templates
      </h1>
      <p
        className="cs-muted"
        style={{
          fontSize: "var(--cs-text-sm)",
          margin: "0 0 var(--cs-space-6)",
        }}
      >
        Dev preview of every transactional template (ADR-0018). Not available in
        production. No email is sent.
      </p>
      <nav
        aria-label="Templates"
        style={{
          display: "flex",
          gap: "var(--cs-space-4)",
          marginBottom: "var(--cs-space-8)",
        }}
      >
        {rendered.map((r) => (
          <a key={r.id} href={`#${r.id}`}>
            {r.id}
          </a>
        ))}
      </nav>
      {rendered.map((r) => (
        <section
          key={r.id}
          id={r.id}
          style={{ marginBottom: "var(--cs-space-10)" }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--cs-space-3)",
              fontSize: "var(--cs-text-lg)",
            }}
          >
            <code>{r.id}</code>
            <span
              className="cs-muted"
              style={{ fontSize: "var(--cs-text-sm)" }}
            >
              {r.subject}
            </span>
          </h2>
          <iframe
            title={`${r.id} preview`}
            srcDoc={r.html}
            sandbox=""
            style={{
              width: "100%",
              height: "480px",
              border: "1px solid var(--cs-border)",
              borderRadius: "var(--cs-radius-md)",
              background: "#fff",
            }}
          />
          <details style={{ marginTop: "var(--cs-space-3)" }}>
            <summary
              className="cs-muted"
              style={{ fontSize: "var(--cs-text-sm)" }}
            >
              Plain-text fallback
            </summary>
            <pre
              style={{
                fontSize: "var(--cs-text-sm)",
                whiteSpace: "pre-wrap",
                padding: "var(--cs-space-3)",
                border: "1px solid var(--cs-border)",
                borderRadius: "var(--cs-radius-md)",
              }}
            >
              {r.text}
            </pre>
          </details>
        </section>
      ))}
    </main>
  );
}
