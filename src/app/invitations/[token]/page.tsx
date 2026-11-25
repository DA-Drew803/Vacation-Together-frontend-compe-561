"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/Context/auth-context";
import { SiteHeader } from "@/components/site-header";
import { acceptInvitation } from "@/lib/api/invitation";

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function joinTrip() {
    setState("loading");
    setError(null);

    try {
      const member = await acceptInvitation(token);

      router.replace(`/trips/${member.trip_id}/plan`);
    } catch (cause) {
      setState("error");

      setError(
        cause instanceof Error
          ? cause.message
          : "This invitation is unavailable.",
      );
    }
  }

  return (
    <main className="trips-page">
      <SiteHeader />

      <section
        className="trip-entry invitation-entry"
        aria-labelledby="invitation-heading"
      >
        <p className="eyebrow">YOU&apos;RE INVITED</p>

        <h1 id="invitation-heading">Join the trip.</h1>

        <p className="trip-entry-lede">
          Accept this invitation to plan with the group.
        </p>

        {isLoading ? (
          <p className="my-trips-notice" role="status">Checking your session…</p>
        ) : !isAuthenticated ? (
          <>
            <p className="form-error">
              Sign in or create an account before accepting this invitation.
            </p>

            <Link
              className="gold-button"
              href={`/login?next=/invitations/${encodeURIComponent(token)}`}
            >
              SIGN IN TO JOIN
            </Link>
            <Link
              className="outline-button"
              href={`/register?next=/invitations/${encodeURIComponent(token)}`}
            >
              CREATE ACCOUNT TO JOIN
            </Link>
          </>
        ) : (
          <button
            className="gold-button"
            onClick={joinTrip}
            disabled={state === "loading"}
          >
            {state === "loading"
              ? "JOINING…"
              : "ACCEPT INVITATION"}
          </button>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
