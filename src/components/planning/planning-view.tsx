"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/api/auth";
import {
  getTripMembers,
  removeTripMember,
  type TripMember,
} from "@/lib/api/approval";
import { createInvitation } from "@/lib/api/invitation";
import {
  getMyAvailability,
  getMyBudget,
  updateMyAvailability,
  updateMyBudget,
} from "@/lib/api/member-planning";
import { buildInvitationEmailDraft, buildInvitationGmailUrl, buildInvitationMailto } from "@/lib/invitation-email";
import {
  getMyPreferences,
  updateMyPreferences,
  type MemberPreference,
} from "@/lib/api/preferences";
import {
  getGroupMatch,
  getTrip,
  type GroupMatch,
  type Trip,
} from "@/lib/api/trip";

const interests = [
  "Food",
  "Culture",
  "Nature",
  "City",
  "Beach",
  "Nightlife",
  "Photography",
  "Relaxing",
];

export function PlanningView({
  tripId,
}: {
  tripId: string;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [match, setMatch] = useState<GroupMatch | null>(null);
  const [preferences, setPreferences] =
    useState<MemberPreference | null>(null);

  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [groupMatchError, setGroupMatchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingMemberId, setRemovingMemberId] =
    useState<string | null>(null);

  const owner = Boolean(
    preferences &&
      members.find(
        (member) => member.id === preferences.member_id,
      )?.role === "OWNER",
  );

  useEffect(() => {
    async function loadPlanningData() {
      try {
        const [nextTrip, nextMembers, user] =
          await Promise.all([
            getTrip(tripId),
            getTripMembers(tripId),
            getCurrentUser(),
          ]);

        setTrip(nextTrip);
        setMembers(nextMembers);

        const [availability, nextBudget] = await Promise.all([
          getMyAvailability(tripId).catch(() => null),
          getMyBudget(tripId).catch(() => null),
        ]);

        const firstRange = availability?.ranges[0];
        setStart(firstRange?.start_date ?? "");
        setEnd(firstRange?.end_date ?? "");
        setBudget(nextBudget ? String(nextBudget.max_amount) : "");
        setCurrency(nextBudget?.currency ?? "USD");

        let nextPreferences: MemberPreference = {
          member_id:
            nextMembers.find(
              (member) => member.user_id === user.id,
            )?.id ?? "",
          interests: [],
          private_notes: null,
        };

        try {
          nextPreferences =
            await getMyPreferences(tripId);
        } catch {
          // New members may not have saved preferences yet.
        }

        setPreferences(nextPreferences);
        setSelected(nextPreferences.interests);
        setNotes(nextPreferences.private_notes ?? "");

        try {
          const groupMatch = await getGroupMatch(tripId);
          setMatch(groupMatch);
          setGroupMatchError(null);
        } catch (cause) {
          setMatch(null);
          setGroupMatchError(
            cause instanceof Error ? cause.message : "Group planning is still in progress.",
          );
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load this trip.",
        );
      }
    }

    void loadPlanningData();
  }, [tripId]);

  function toggleInterest(value: string) {
    const normalizedValue = value.toLowerCase();

    setSelected((current) =>
      current.includes(normalizedValue)
        ? current.filter(
            (item) => item !== normalizedValue,
          )
        : [...current, normalizedValue],
    );
  }

  async function savePreferences(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const saved = await updateMyPreferences(
        tripId,
        {
          interests: selected,
          private_notes: notes || null,
        },
      );

      setPreferences(saved);
      setStatus(
        "Your preferences are saved privately to your member profile.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePlanningDetails(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const [savedAvailability, savedBudget] = await Promise.all([
        updateMyAvailability(tripId, [
          { start_date: start, end_date: end },
        ]),
        updateMyBudget(tripId, Number(budget), currency),
      ]);

      const savedRange = savedAvailability.ranges[0];
      setStart(savedRange?.start_date ?? start);
      setEnd(savedRange?.end_date ?? end);
      setBudget(String(savedBudget.max_amount));
      setCurrency(savedBudget.currency);
      setStatus("Your dates and budget are saved to your member profile.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your planning details.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function inviteTraveler(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const invitation = await createInvitation(
        tripId,
        email.trim(),
      );

      const link = `${window.location.origin}/invitations/${
        invitation.token ?? ""
      }`;

      setInviteLink(link);
      setInviteeEmail(email.trim());
      setEmail("");

      try {
        await navigator.clipboard.writeText(link);
        setStatus("Invite created and copied to your clipboard.");
      } catch {
        setStatus("Invite created. Copy the link or draft an email below.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create invite.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setStatus("Invitation link copied.");
    } catch {
      setError("Unable to copy the invitation link.");
    }
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
      setStatus("Gmail draft opened.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setStatus("Email draft copied. Paste it into your email app.");
    } catch {
      window.location.href = buildInvitationMailto(inviteeEmail, inviteLink);
    }
  }

  async function removeMember(member: TripMember) {
    if (
      !owner ||
      member.id === preferences?.member_id ||
      member.role === "OWNER"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.display_name} from this trip?`,
    );

    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setError(null);
    setStatus(null);

    try {
      await removeTripMember(tripId, member.id);

      setMembers((current) =>
        current.filter((item) => item.id !== member.id),
      );

      setStatus(
        `${member.display_name} was removed from the trip.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to remove this member.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <section
      className="planning-shell"
      aria-labelledby="planning-heading"
    >
      <div className="planning-intro">
        <p className="eyebrow">YOUR PRIVATE INPUTS</p>

        <h1 id="planning-heading">
          Plan your part of the trip.
        </h1>

        <p>
          Bring your interests and private ideas into the
          group plan. Other travelers see readiness and the
          final group match—not your private notes.
        </p>

        {trip && (
          <span className="trip-label">
            {trip.name}
          </span>
        )}
      </div>

      {error && (
        <Alert className="form-error" role="alert">
          <AlertDescription className="form-feedback-copy">{error}</AlertDescription>
        </Alert>
      )}

      {status && (
        <Alert className="form-success" role="status">
          <AlertDescription className="form-feedback-copy">{status}</AlertDescription>
        </Alert>
      )}

      <div className="planning-grid">
        <section className="planning-card">
          <p className="eyebrow">MY AVAILABILITY &amp; BUDGET</p>

          <h2>When are you going?</h2>

          <form
            className="inline-form"
            onSubmit={savePlanningDetails}
          >
              <div className="inline-field">
                <Label className="inline-field-label" htmlFor="planning-start-date">START</Label>

                <Input
                  id="planning-start-date"
                  type="date"
                  value={start}
                  onChange={(event) =>
                    setStart(event.target.value)
                  }
                  required
                />
              </div>

              <div className="inline-field">
                <Label className="inline-field-label" htmlFor="planning-end-date">END</Label>

                <Input
                  id="planning-end-date"
                  type="date"
                  value={end}
                  onChange={(event) =>
                    setEnd(event.target.value)
                  }
                  required
                />
              </div>

              <div className="inline-field">
                <Label className="inline-field-label" htmlFor="planning-budget">MAX BUDGET / PERSON</Label>

                <Input
                  id="planning-budget"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="1200"
                  required
                />
              </div>

              <div className="inline-field">
                <Label className="inline-field-label" htmlFor="planning-currency">CURRENCY</Label>

                <select
                  id="planning-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <Button
                className="gold-button"
                disabled={saving}
              >
                SAVE DATES &amp; BUDGET
              </Button>
            </form>

          <p className="detail-caption">
            Shared dates and budget are used to build
            recommendations for everyone.
          </p>

          <div className="planning-detail">
            <span>GROUP BUDGET</span>

            <strong>
              {match
                ? `${match.group_max_budget.currency} ${match.group_max_budget.max_amount} / person`
                : "Waiting for all travelers"}
            </strong>
          </div>
        </section>

        <section className="planning-card">
          <p className="eyebrow">MY INTERESTS</p>

          <h2>What sounds good?</h2>

          <form onSubmit={savePreferences}>
            <div className="interest-grid">
              {interests.map((interest) => {
                const normalizedInterest =
                  interest.toLowerCase();

                const isSelected =
                  selected.includes(normalizedInterest);

                return (
                  <button
                    type="button"
                    key={interest}
                    className={`interest-chip ${
                      isSelected
                        ? "interest-chip--selected"
                        : ""
                    }`}
                    onClick={() =>
                      toggleInterest(interest)
                    }
                    aria-pressed={isSelected}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>

            <label className="notes-field">
              <span>PRIVATE IDEAS FOR THE GROUP</span>

              <Textarea
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Anything you want the planner to keep in mind?"
                maxLength={2000}
              />

              <small>
                Only you can see this raw text.
              </small>
            </label>

            <Button
              className="gold-button full-width"
              disabled={saving}
            >
              {saving
                ? "SAVING…"
                : "SAVE MY PREFERENCES"}
            </Button>
          </form>
        </section>
      </div>

      <section className="planning-card group-status">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GROUP STATUS</p>

            <h2>Everyone planning together.</h2>
          </div>

          <Link
            className="text-link"
            href={`/trips/${tripId}/group_match`}
          >
            VIEW GROUP MATCH →
          </Link>
        </div>

        {!match && groupMatchError && (
          <p className="detail-caption" role="status">
            {groupMatchError} Complete your planning details and invitees&apos; planning before trying Group Match again.
          </p>
        )}

        {members.map((member) => (
          <div
            className="member-row"
            key={member.id}
          >
            <span className="member-name">
              <i className="member-dot member-dot--approved" />

              {member.display_name}

              {member.role === "OWNER" && (
                <small>OWNER</small>
              )}
            </span>

            <span className="member-state">
              {preferences?.member_id === member.id
                ? "YOUR INPUTS"
                : "ACTIVE MEMBER"}
            </span>

            {owner &&
              member.id !== preferences?.member_id &&
              member.role !== "OWNER" && (
                <button
                  className="member-remove-button"
                  type="button"
                  onClick={() =>
                    void removeMember(member)
                  }
                  disabled={
                    removingMemberId === member.id
                  }
                >
                  {removingMemberId === member.id
                    ? "REMOVING…"
                    : "REMOVE"}
                </button>
              )}
          </div>
        ))}
      </section>

      {owner && (
        <section className="planning-card invite-admin">
          <p className="eyebrow">INVITE A TRAVELER</p>

          <h2>Grow the group.</h2>

          <form
            className="inline-form"
            onSubmit={inviteTraveler}
          >
            <div className="inline-field">
              <Label className="inline-field-label" htmlFor="planning-invite-email">TRAVELER EMAIL</Label>
              <Input
                id="planning-invite-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="friend@example.com"
                required
              />
            </div>

            <Button
              className="gold-button"
              disabled={saving}
            >
              CREATE INVITE
            </Button>
          </form>

          {inviteLink && (
            <div className="invite-link-box">
              <span>{inviteLink}</span>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="outline-button"
                  onClick={() => void copyInviteLink()}
                >
                  COPY LINK
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="outline-button"
                  onClick={() => void draftInviteEmail()}
                >
                  DRAFT EMAIL
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
