"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { createInvitation } from "@/lib/api/invitation";
import { buildInvitationEmailDraft, buildInvitationGmailUrl, buildInvitationMailto } from "@/lib/invitation-email";
import { createTrip, type Trip } from "@/lib/api/trip";

export default function TripsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const trip = await createTrip(name.trim());

      setCreatedTrip(trip);
      setName("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create this trip.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!createdTrip) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const invitation = await createInvitation(
        createdTrip.id,
        email.trim(),
      );

      const link = `${window.location.origin}/invitations/${
        invitation.token ?? ""
      }`;

      setInviteLink(link);
      setInviteeEmail(email.trim());
      setMessage(
        "Invitation created. Share this link with your traveler.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create the invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteLink) return;

    await navigator.clipboard.writeText(inviteLink);
    setMessage("Invitation link copied.");
  }

  async function draftInviteEmail() {
    if (!inviteLink) return;

    const draft = buildInvitationEmailDraft(inviteeEmail, inviteLink);
    const gmailWindow = window.open(
      buildInvitationGmailUrl(inviteeEmail, inviteLink),
      "_blank",
      "noopener,noreferrer",
    );
    if (gmailWindow) {
      setMessage("Gmail draft opened.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setMessage("Email draft copied. Paste it into your email app.");
    } catch {
      window.location.href = buildInvitationMailto(inviteeEmail, inviteLink);
    }
  }

  return (
    <main className="trips-page">
      <SiteHeader />

      <section
        className="trip-entry"
        aria-labelledby="trips-heading"
      >
        <p className="eyebrow">NEW TRIP</p>

        <h1 id="trips-heading">
          Bring your group together.
        </h1>

        <p className="trip-entry-lede">
          Create your trip, then share a secure invitation
          with friends.
        </p>

        {!createdTrip ? (
          <form
            className="trip-create-form"
            onSubmit={handleCreate}
          >
            <label>
              <span>TRIP NAME</span>

              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Tokyo winter break"
                required
                maxLength={200}
              />
            </label>

            <button
              className="gold-button"
              disabled={busy}
            >
              {busy ? "CREATING…" : "CREATE TRIP"}
            </button>
          </form>
        ) : (
          <div className="invite-card">
            <p className="eyebrow">TRIP CREATED</p>

            <h2>{createdTrip.name}</h2>

            <p>
              Invite someone by email to add them to your
              group.
            </p>

            <form
              className="trip-create-form"
              onSubmit={handleInvite}
            >
              <label>
                <span>TRAVELER EMAIL</span>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="friend@example.com"
                  required
                />
              </label>

              <button
                className="gold-button"
                disabled={busy}
              >
                {busy
                  ? "CREATING…"
                  : "CREATE INVITE"}
              </button>
            </form>

            {inviteLink && (
              <div className="invite-link-box">
                <span>{inviteLink}</span>

                <button
                  type="button"
                  className="outline-button"
                  onClick={copyInvite}
                >
                  COPY LINK
                </button>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => void draftInviteEmail()}
                >
                  DRAFT EMAIL
                </button>
              </div>
            )}

            <Link
              className="text-link"
              href={`/trips/${createdTrip.id}/plan`}
            >
              OPEN TRIP PLANNING →
            </Link>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}

      </section>
    </main>
  );
}
