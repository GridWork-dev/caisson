// Forgot-password entry point (better-auth email+password, ADR-0015 extension). Kept minimal —
// a copy/design polish pass follows separately, same as /login.
import type { Metadata } from "next";
import { Hero, Section } from "@caisson/ui/components";
import { buildMetadata } from "@/lib/metadata";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Reset the password on your Caisson buyer dashboard account.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <>
      <Hero
        eyebrow="Forgot password"
        title="Reset your password"
        lede="Enter the email on your account and we'll send a one-time reset link."
      />
      <Section eyebrow="Reset" title="Send a reset link">
        <ForgotPasswordForm />
      </Section>
    </>
  );
}
