// The shared branded shell every template renders into (ADR-0018). Email clients strip
// <style>/external CSS and don't resolve CSS custom properties, so these are frozen inline hex
// snapshots of the light-mode palette "a" tokens (packages/ui/src/tokens/candidates.ts) — not
// live tokens. Regenerate by hand if the locked palette (ADR-0042/0078) ever changes.
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
} from "@react-email/components";
import type { ReactNode } from "react";

export const BRAND_COLOR = {
  bg: "#fafcfd",
  surface: "#f3f8f9",
  border: "#d2d9db",
  fg: "#131c1f",
  fgMuted: "#4b585c",
  accent: "#007491",
  onAccent: "#f5feff",
} as const;

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BRAND_COLOR.bg,
          margin: 0,
          padding: "32px 0",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        }}
      >
        <Container
          style={{
            backgroundColor: BRAND_COLOR.surface,
            border: `1px solid ${BRAND_COLOR.border}`,
            borderRadius: 12,
            padding: "32px",
            maxWidth: 480,
          }}
        >
          <Text
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
            style={{ fontSize: 20, color: BRAND_COLOR.fg, margin: "0 0 16px" }}
          >
            {heading}
          </Heading>
          {children}
          <Hr
            style={{ borderColor: BRAND_COLOR.border, margin: "32px 0 16px" }}
          />
          <Text style={{ fontSize: 12, color: BRAND_COLOR.fgMuted, margin: 0 }}>
            Caisson — fail-closed by construction. This is a transactional email
            triggered by an action on your account, not a marketing message.
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
    <Text style={{ fontSize: 14, color: BRAND_COLOR.fg, lineHeight: 1.6 }}>
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
