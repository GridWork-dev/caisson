// Operator sign-in (ADR-0283). GitHub OAuth only — this is a single-operator control-plane, not a
// buyer product, so there's no email/password or magic-link path to offer. `next` is validated
// server-side too (LoginButton also guards it) so an external `?next=` can never become an open
// redirect out of the app.
import type { Metadata } from "next";
import { LoginButton } from "./login-button";

export const metadata: Metadata = {
  title: "Sign in · Caisson Admin",
  robots: { index: false, follow: false },
};

function safeNext(next: string | undefined): string {
  return next !== undefined && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-8)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          Operator sign-in
        </h1>
        <p className="lede">
          GitHub sign-in, restricted to the gridwork-dev operator account.
        </p>
      </section>
      <LoginButton next={safeNext(next)} />
    </div>
  );
}
