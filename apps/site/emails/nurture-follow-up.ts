// Nurture follow-up email — transactional template (template only, not wired to a sender).
// Sent ~2 weeks after the waitlist welcome when the recipient hasn't opened the docs yet,
// or as a "compliance release is near" signal email. Configure the trigger in your email provider.
//
// Inline styles throughout (same constraint as waitlist-welcome.ts — CSS vars are not email-safe).
//
// Usage: import { buildNurtureFollowUp } from "@/emails/nurture-follow-up";
//   const html = buildNurtureFollowUp({ email: "cto@acme.com", edition: "Compliance" });

export interface NurtureFollowUpData {
  email: string;
  edition?: string;
}

// ponytail: stdlib replace chain, no dep — the escape set is 5 chars; email clients + DOM both
// treat the entities literally. `&` first, else its own replacement re-escapes the others.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand palette — direct hex equivalents of the --cs-* tokens (email-only exception).
const C = {
  bg: "#0d1216",
  surface: "#131a21",
  border: "#1e2d3a",
  fg: "#e2eaf2",
  fgMuted: "#7a8fa3",
  accent: "#2bbfaa",
  mono: "'Courier New', 'Courier', monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
} as const;

export function buildNurtureFollowUp({
  email,
  edition = "Compliance",
}: NurtureFollowUpData): string {
  const editionLabel = `Caisson ${edition}`;
  const subject = nurtureSubject(edition);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:${C.sans};color:${C.fg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-family:${C.mono};font-size:14px;letter-spacing:-0.02em;color:${C.fg};font-weight:600;">caisson</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${C.surface};border:1px solid ${C.border};border-radius:8px;padding:40px;">

              <!-- Eyebrow -->
              <p style="margin:0 0 20px 0;font-family:${C.mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent};">Before you audit</p>

              <!-- Heading -->
              <h1 style="margin:0 0 16px 0;font-family:${C.sans};font-size:24px;font-weight:600;line-height:1.25;color:${C.fg};">
                What the ${editionLabel} ships — and what it doesn't.
              </h1>

              <!-- Body -->
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${C.fg};">
                A note for <strong>${escapeHtml(email)}</strong> — this is the one email we said we'd send, not the start of a drip.
              </p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${C.fg};">
                ${editionLabel} ships the <strong>technical controls</strong> your audit requires: fail-closed Postgres RLS, S3 Object-Lock WORM storage, an append-only SHA-256 audit chain, per-tenant field encryption, and an evidence-pack generator that formats artifacts for your auditor. It is a codebase, not a scanner.
              </p>
              <p style="margin:0 0 32px 0;font-size:16px;line-height:1.65;color:${C.fg};">
                The org controls (HR, vendor management, incident response), the audit engagement, and the final certification remain yours. Caisson generates the evidence; you close the audit. That boundary is intentional and stated plainly in the docs.
              </p>

              <!-- Proof block -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};border-radius:6px;border:1px solid ${C.border};margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px 0;font-family:${C.mono};font-size:11px;color:${C.fgMuted};">$ caisson audit verify --table audit_log</p>
                    <p style="margin:0;font-family:${C.mono};font-size:12px;line-height:1.8;color:${C.accent};">
                      chain intact — 41984 rows, 0 breaks, root 2c9f…b7
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA row -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px;">
                    <a href="https://caisson.sh/compliance" style="display:inline-block;padding:12px 24px;background-color:${C.accent};border-radius:6px;font-family:${C.sans};font-size:14px;font-weight:600;color:#0d1216;text-decoration:none;">
                      See the ${edition} edition
                    </a>
                  </td>
                  <td>
                    <a href="https://caisson.sh/docs" style="display:inline-block;padding:12px 24px;border:1px solid ${C.border};border-radius:6px;font-family:${C.sans};font-size:14px;font-weight:400;color:${C.fg};text-decoration:none;">
                      Read the docs
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Control map teaser -->
          <tr>
            <td style="padding:24px 0 0 0;">
              <p style="margin:0 0 12px 0;font-family:${C.mono};font-size:11px;color:${C.fgMuted};">Technical controls shipped so far:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${C.mono};font-size:12px;line-height:2;color:${C.fgMuted};">
                    RLS · FORCE policy&nbsp;&nbsp;&nbsp;→&nbsp;SOC 2 CC6.1 · HIPAA §164.312(a)(1)<br/>
                    WORM storage&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→&nbsp;SOC 2 CC7.2 · HIPAA §164.312(c)(1)<br/>
                    Audit chain&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→&nbsp;SOC 2 CC7.2 · HIPAA §164.312(b)<br/>
                    Field encryption&nbsp;&nbsp;&nbsp;&nbsp;→&nbsp;HIPAA §164.312(a)(2)(iv)
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;border-top:1px solid ${C.border};">
              <p style="margin:0 0 4px 0;font-size:12px;color:${C.fgMuted};">
                Caisson Software LLC · <a href="https://caisson.sh" style="color:${C.fgMuted};">caisson.sh</a>
              </p>
              <p style="margin:0;font-size:12px;color:${C.fgMuted};">
                You're on the ${editionLabel} early-access list at ${escapeHtml(email)}.
                <a href="https://caisson.sh/unsubscribe" style="color:${C.fgMuted};">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function nurtureSubject(edition = "Compliance"): string {
  return `What Caisson ${edition} ships — and what it doesn't`;
}
