"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api/auth";
import {
  getTripMembers,
  removeTripMember,
  type TripMember,
} from "@/lib/api/approval";
import { createInvitation } from "@/lib/api/invitation";
import {
  getMyPreferences,
  updateMyPreferences,
  type MemberPreference,
} from "@/lib/api/preferences";
import {
  getGroupMatch,
  getTrip,
  updateTripDates,
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
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
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
        setStart(nextTrip.selected_start_date ?? "");
        setEnd(nextTrip.selected_end_date ?? "");

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
        } catch {
          setMatch(null);
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

  async function saveDates(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const saved = await updateTripDates(
        tripId,
        start,
        end,
      );

      setTrip(saved);
      setStatus("Shared trip dates updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update dates.",
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
        email,
      );

      const link = `${window.location.origin}/invitations/${
        invitation.token ?? ""
      }`;

      await navigator.clipboard.writeText(link);

      setEmail("");
      setStatus(
        "Invite created and copied to your clipboard.",
      );
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
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {status && (
        <p className="form-success" role="status">
          {status}
        </p>
      )}

      <div className="planning-grid">
        <section className="planning-card">
          <p className="eyebrow">SHARED TRIP DETAILS</p>

          <h2>When are you going?</h2>

          {owner ? (
            <form
              className="inline-form"
              onSubmit={saveDates}
            >
              <label>
                <span>START</span>

                <input
                  type="date"
                  value={start}
                  onChange={(event) =>
                    setStart(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                <span>END</span>

                <input
                  type="date"
                  value={end}
                  onChange={(event) =>
                    setEnd(event.target.value)
                  }
                  required
                />
              </label>

              <button
                className="gold-button"
                disabled={saving}
              >
                SAVE DATES
              </button>
            </form>
          ) : (
            <p className="detail-value">
              {start && end
                ? `${start} → ${end}`
                : "Dates are not set yet."}
            </p>
          )}

          <p className="detail-caption">
            Shared dates and budget are used to build
            recommendations for everyone.
          </p>

          <div className="planning-detail">
            <span>GROUP BUDGET</span>

            <strong>
              {match
                ? `${match.group_max_budget.currency} ${match.group_max_budget.max_amount} / person`
                : "Waiting for group data"}
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

              <textarea
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

            <button
              className="gold-button full-width"
              disabled={saving}
            >
              {saving
                ? "SAVING…"
                : "SAVE MY PREFERENCES"}
            </button>
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
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="friend@example.com"
              required
            />

            <button
              className="gold-button"
              disabled={saving}
            >
              CREATE INVITE
            </button>
          </form>
        </section>
      )}
    </section>
  );
}