// Every branded email template, rendered with sample data — absorbs the former dev-only site
// preview page (superseded: this surface adds the send-test-to-operator action and lives behind the
// same GitHub-OAuth gate (ADR-0283) as the rest of admin, so it works in every environment, not
// just dev). Server Component: `renderEmailTemplate` runs server-side via `@react-email/render`;
// only the send button is a client island.
import {
  EMAIL_SAMPLE_DATA,
  EMAIL_TEMPLATE_IDS,
  renderEmailTemplate,
  type EmailTemplateId,
} from "@caisson/email";
import { SendTestButton } from "./send-test-button";

function renderSample(id: EmailTemplateId) {
  return renderEmailTemplate(id, EMAIL_SAMPLE_DATA[id]);
}

export default async function EmailsCatalogPage() {
  const rendered = await Promise.all(
    EMAIL_TEMPLATE_IDS.map(async (id) => ({ id, ...(await renderSample(id)) })),
  );

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · emails</p>
        <h1 className="page-title" style={{ maxWidth: "24ch" }}>
          Every email in the product, in one pile.
        </h1>
        <p className="lede">
          The {EMAIL_TEMPLATE_IDS.length} branded templates — transactional and
          growth — rendered from <code>@caisson/email</code> with sample data.
          Send a real test to the configured operator inbox from any card.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
          gap: "var(--cs-space-6)",
        }}
      >
        {rendered.map((r) => (
          <div
            key={r.id}
            className="panel stack"
            style={{ gap: "var(--cs-space-4)" }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--cs-text-lg)" }}>
                <code>{r.id}</code>
              </h2>
              <p
                className="muted"
                style={{
                  fontSize: "var(--cs-text-sm)",
                  margin: "var(--cs-space-1) 0 0",
                }}
              >
                {r.subject}
              </p>
            </div>
            <iframe
              title={`${r.id} preview`}
              srcDoc={r.html}
              sandbox=""
              style={{
                width: "100%",
                height: "420px",
                border: "1px solid var(--cs-border)",
                borderRadius: "var(--cs-radius-md)",
                background: "#fff",
              }}
            />
            <SendTestButton templateId={r.id} />
          </div>
        ))}
      </section>
    </div>
  );
}
