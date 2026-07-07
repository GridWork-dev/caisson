// Operator sign-in (ADR-0283). GitHub OAuth only — this is a single-operator control-plane, not a
// buyer product, so there's no email/password or magic-link path to offer. `next` is sanitized
// server-side (`safeNextPath`) BEFORE it ever reaches the client button, so an external `?next=`
// can never become an open redirect out of the app.
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginButton } from "./login-button";

export const metadata: Metadata = {
  title: "Sign in · Caisson Admin",
  robots: { index: false, follow: false },
};

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
      <LoginButton next={safeNextPath(next)} />
    </div>
  );
}
