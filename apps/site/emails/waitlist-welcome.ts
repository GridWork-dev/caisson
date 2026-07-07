// Waitlist welcome email — transactional template (template only, not wired to a sender).
//
// Inline styles throughout — email clients strip <style> tags. The brand palette is rendered
// with explicit hex here because CSS custom properties (--cs-*) are not supported in email
// clients. These hex values match the tokens in packages/ui/src/tokens exactly.
//
// Usage (pseudo-code): import { buildWaitlistWelcome } from "@/emails/waitlist-welcome";
//   const html = buildWaitlistWelcome({ email: "founder@acme.com", edition: "Compliance" });

export interface WaitlistWelcomeData {
  /** Recipient email — displayed in the salutation. */
  email: string;
  /** The edition they joined from, or "Caisson" for the general waitlist. */
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

export function buildWaitlistWelcome({
  email,
  edition = "Caisson",
}: WaitlistWelcomeData): string {
  const editionLabel = edition === "Caisson" ? "Caisson" : `Caisson ${edition}`;
  const subject = `You're on the ${editionLabel} early-access list`;

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
              <p style="margin:0 0 20px 0;font-family:${C.mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent};">Early access</p>

              <!-- Heading -->
              <h1 style="margin:0 0 16px 0;font-family:${C.sans};font-size:24px;font-weight:600;line-height:1.25;color:${C.fg};">
                You're on the list.
              </h1>

              <!-- Body -->
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${C.fg};">
                We received your request for early access to ${editionLabel}. We'll reach out to <strong>${escapeHtml(email)}</strong> when the ${edition === "Caisson" ? "first edition" : edition + " edition"} opens — roughly one email, not a drip.
              </p>
              <p style="margin:0 0 32px 0;font-size:16px;line-height:1.65;color:${C.fg};">
                In the meantime, the docs cover the architecture, the module contracts, and the compliance control maps:
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${C.accent};border-radius:6px;">
                    <a href="https://caisson.sh/docs" style="display:inline-block;padding:12px 24px;font-family:${C.sans};font-size:14px;font-weight:600;color:#0d1216;text-decoration:none;border-radius:6px;">
                      Read the docs
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Divider rule -->
          <tr>
            <td style="padding:32px 0 0 0;border-top:1px solid ${C.border};margin-top:32px;">
              <!-- Proof strip -->
              <p style="margin:0 0 8px 0;font-family:${C.mono};font-size:11px;color:${C.fgMuted};">What ships in the Compliance edition:</p>
              <p style="margin:0;font-family:${C.mono};font-size:12px;line-height:2;color:${C.fgMuted};">
                ✓ Fail-closed Postgres RLS (FORCE, CI-tested)<br/>
                ✓ S3 Object-Lock WORM in COMPLIANCE mode<br/>
                ✓ Append-only SHA-256 audit chain<br/>
                ✓ Per-tenant field encryption (AES-256-GCM)<br/>
                ✓ Evidence-pack generator (SOC 2 / HIPAA)
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;">
              <p style="margin:0 0 4px 0;font-size:12px;color:${C.fgMuted};">
                GridWork Digital LLC · <a href="https://caisson.sh" style="color:${C.fgMuted};">caisson.sh</a>
              </p>
              <p style="margin:0;font-size:12px;color:${C.fgMuted};">
                You're receiving this because you requested early access to ${editionLabel}.
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

/** Subject line — export separately so the sender can set it without parsing the HTML. */
export function waitlistWelcomeSubject(edition = "Caisson"): string {
  const label = edition === "Caisson" ? "Caisson" : `Caisson ${edition}`;
  return `You're on the ${label} early-access list`;
}
