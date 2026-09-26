// The shared branded shell every template renders into (ADR-0018). Email clients strip
// external CSS and don't resolve CSS custom properties, so these are frozen inline hex
// snapshots of the locked palette (packages/ui/styles/tokens.css) — not live tokens.
// Regenerate by hand if the locked palette (ADR-0042/0078) ever changes.
//
// Dark mode is the HYBRID technique:
//   1. The LIGHT palette is tuned off the pure-white/near-black extremes so Gmail-style
//      forced inversion (which ignores author dark styles and remaps by luminance) lands on
//      legible mid-luminance colors in both directions.
//   2. Clients that honor author dark styles (Apple Mail, Outlook.com) get a real dark
//      palette via <meta name="color-scheme"> + a prefers-color-scheme block in <Head>,
//      keyed off explicit classes on the layout components. `!important` is required —
//      the base palette is inline styles, which otherwise always win over the style block.
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "react-email";
import type { ReactNode } from "react";

export const BRAND_COLOR = {
  bg: "#f2f6f7",
  surface: "#e9eef0",
  border: "#d2d9db",
  fg: "#1a2327",
  fgMuted: "#4b585c",
  accent: "#007491",
  onAccent: "#eefafc",
} as const;

// Hex snapshots of the dark-theme tokens (tokens.css :root, oklch → sRGB).
export const BRAND_COLOR_DARK = {
  bg: "#0f171a",
  surface: "#162125",
  border: "#2c3437",
  fg: "#eff2f4",
  fgMuted: "#9da6aa",
  accent: "#34bfcd",
  onAccent: "#05282e",
} as const;

const DARK_STYLES = `
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  /* react-email's <Body> copies the inline bg onto an unclassed wrapper td — cover both. */
  .em-body, .em-body > table > tbody > tr > td { background-color: ${BRAND_COLOR_DARK.bg} !important; }
  .em-container { background-color: ${BRAND_COLOR_DARK.surface} !important; border-color: ${BRAND_COLOR_DARK.border} !important; }
  .em-brand { color: ${BRAND_COLOR_DARK.accent} !important; }
  .em-heading { color: ${BRAND_COLOR_DARK.fg} !important; }
  .em-text { color: ${BRAND_COLOR_DARK.fg} !important; }
  .em-footer { color: ${BRAND_COLOR_DARK.fgMuted} !important; }
  .em-hr { border-color: ${BRAND_COLOR_DARK.border} !important; }
  .em-btn { background-color: ${BRAND_COLOR_DARK.accent} !important; color: ${BRAND_COLOR_DARK.onAccent} !important; }
}
`;

const DEFAULT_FOOTER_NOTE =
  "This is a transactional email triggered by an action on your account, not a marketing message.";

export function EmailLayout({
  preview,
  heading,
  children,
  footerNote = DEFAULT_FOOTER_NOTE,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
  /** What kind of email this is, stated honestly (ADR-0082 truth floor) — a scheduled
   *  nurture/lifecycle send is not "triggered by an action on your account," so it MUST pass its
   *  own accurate note rather than inherit the transactional default. */
  footerNote?: string;
}): React.ReactElement {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_STYLES}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="em-body"
        style={{
          backgroundColor: BRAND_COLOR.bg,
          margin: 0,
          padding: "32px 0",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        }}
      >
        <Container
          className="em-container"
          style={{
            backgroundColor: BRAND_COLOR.surface,
            border: `1px solid ${BRAND_COLOR.border}`,
            borderRadius: 12,
            padding: "32px",
            maxWidth: 480,
          }}
        >
          <Text
            className="em-brand"
            style={{
              fontSize: 13,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: BRAND_COLOR.accent,
              fontWeight: 600,
              margin: "0 0 24px",
            }}
          >
            Caisson
          </Text>
          <Heading
            className="em-heading"
            style={{ fontSize: 20, color: BRAND_COLOR.fg, margin: "0 0 16px" }}
          >
            {heading}
          </Heading>
          {children}
          <Hr
            className="em-hr"
            style={{ borderColor: BRAND_COLOR.border, margin: "32px 0 16px" }}
          />
          <Text
            className="em-footer"
            style={{ fontSize: 12, color: BRAND_COLOR.fgMuted, margin: 0 }}
          >
            Caisson, fail-closed by construction. {footerNote}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailBody({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <Text
      className="em-text"
      style={{ fontSize: 14, color: BRAND_COLOR.fg, lineHeight: 1.6 }}
    >
      {children}
    </Text>
  );
}

export function EmailButton({
  href,
  label,
}: {
  href: string;
  label: string;
}): React.ReactElement {
  return (
    <Button
      className="em-btn"
      href={href}
      style={{
        backgroundColor: BRAND_COLOR.accent,
        color: BRAND_COLOR.onAccent,
        fontWeight: 600,
        fontSize: 14,
        padding: "12px 20px",
        borderRadius: 8,
        textDecoration: "none",
        margin: "8px 0 4px",
      }}
    >
      {label}
    </Button>
  );
}
