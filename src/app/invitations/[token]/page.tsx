"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/api/invitation";
import { getAccessToken } from "@/lib/auth/session";

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

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

  const isSignedIn = Boolean(getAccessToken());

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

        {!isSignedIn ? (
          <>
            <Alert className="form-error">
              <AlertDescription className="form-feedback-copy">
                Sign in or create an account before accepting this invitation.
              </AlertDescription>
            </Alert>

            <Button asChild className="gold-button">
              <Link href={`/login?next=/invitations/${encodeURIComponent(token)}`}>
                SIGN IN TO JOIN
              </Link>
            </Button>
          </>
        ) : (
          <Button
            className="gold-button"
            onClick={joinTrip}
            disabled={state === "loading"}
          >
            {state === "loading"
              ? "JOINING…"
              : "ACCEPT INVITATION"}
          </Button>
        )}

        {error && (
          <Alert className="form-error" role="alert">
            <AlertDescription className="form-feedback-copy">{error}</AlertDescription>
          </Alert>
        )}
      </section>
    </main>
  );
}
