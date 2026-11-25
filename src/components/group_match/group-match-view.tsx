"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getTripMembers, type TripMember } from "@/lib/api/approval";
import { generateDestinationCandidates } from "@/lib/api/destination";
import { getGroupMatch, type GroupMatch } from "@/lib/api/trip";

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateString}T00:00:00Z`));
}

function formatBudget(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function requestMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function GroupMatchView({ tripId }: { tripId: string }) {
  const router = useRouter();
  const generationLock = useRef(false);
  const [groupMatch, setGroupMatch] = useState<GroupMatch | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadGroupMatch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [matchResult, memberResult] = await Promise.all([
        getGroupMatch(tripId),
        getTripMembers(tripId),
      ]);
      setGroupMatch(matchResult);
      setMembers(memberResult);
    } catch (error) {
      setLoadError(requestMessage(error, "Unable to load the group match."));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadGroupMatch(), 0);
    return () => window.clearTimeout(timer);
  }, [loadGroupMatch]);

  async function findDestinations() {
    if (!groupMatch?.ready || generationLock.current) return;

    generationLock.current = true;
    setGenerating(true);
    setGenerationError(null);
    try {
      await generateDestinationCandidates(tripId);
      router.push(`/trips/${encodeURIComponent(tripId)}/results`);
    } catch (error) {
      const message = requestMessage(error, "");
      if (message.includes("Candidates cannot change after voting starts")) {
        router.push(`/trips/${encodeURIComponent(tripId)}/results`);
        return;
      }
      setGenerationError(requestMessage(error, "Unable to generate destination matches."));
    } finally {
      generationLock.current = false;
      setGenerating(false);
    }
  }

  if (loading && !groupMatch) {
    return (
      <div className="state-panel" role="status" aria-live="polite">
        <p className="eyebrow">LOADING GROUP MATCH</p>
        <p>Combining the group&apos;s dates, planning ceiling, interests, and travelers.</p>
      </div>
    );
  }

  if (!groupMatch) {
    return (
      <div className="state-panel" role="alert">
        <p className="eyebrow">GROUP MATCH UNAVAILABLE</p>
        <p>{loadError ?? "No group match is available yet."}</p>
        <Button variant="outline" type="button" onClick={() => void loadGroupMatch()}>
          TRY AGAIN
        </Button>
        <Link className="text-link" href={`/trips/${encodeURIComponent(tripId)}/plan`}>
          RETURN TO PLANNING →
        </Link>
      </div>
    );
  }

  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const dateRanges = groupMatch.common_date_ranges.ranges;
  const sharedDates = dateRanges.length
    ? dateRanges
      .map((range) => `${formatDate(range.start_date)} — ${formatDate(range.end_date)}`)
      .join(" · ")
    : "No shared dates yet";
  const planningCeiling = `${formatBudget(
    groupMatch.group_max_budget.max_amount,
    groupMatch.group_max_budget.currency,
  )} / person`;
  const unavailableReason = groupMatch.reason
    ?? "Destination matching will be available after every eligible traveler completes their trip inputs.";

  return (
    <div className="group-match-shell">
      <section className="group-match-hero" aria-label="Group traveling together">
        <div className="group-match-hero-image" />
      </section>

      <section className="group-match-intro" aria-labelledby="group-match-heading">
        <p className="eyebrow">GROUP MATCH</p>
        <h1 id="group-match-heading">Where your group aligns.</h1>
        <p className="group-match-description">
          Everyone&apos;s inputs are combined into one shared direction for the trip.
        </p>
      </section>

      <section className="group-match-summary" aria-label="Group match summary">
        <article className="group-match-stat">
          <p>SHARED DATES</p>
          <strong>{sharedDates}</strong>
        </article>
        <article className="group-match-stat">
          <p>PLANNING CEILING</p>
          <strong>{planningCeiling}</strong>
        </article>
        <article className="group-match-stat">
          <p>TRAVELERS</p>
          <strong>{activeMembers.length}</strong>
        </article>
      </section>

      <section className="group-match-interests" aria-labelledby="interests-heading">
        <p className="eyebrow" id="interests-heading">SHARED INTERESTS</p>
        <p>{groupMatch.interests.length ? groupMatch.interests.join(" · ") : "No shared interests yet."}</p>
      </section>

      <section className="group-match-members" aria-labelledby="members-heading">
        <p className="eyebrow" id="members-heading">GROUP MEMBERS</p>
        {activeMembers.length ? (
          <div className="group-match-member-list">
            {activeMembers.map((member) => (
              <div className="group-match-member" key={member.id}>
                <span className="group-match-member-dot" aria-hidden="true" />
                <span>{member.display_name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="group-match-empty">No active travelers are available yet.</p>
        )}
      </section>

      {!groupMatch.ready && (
        <Alert className="group-match-feedback" id="destination-match-status" role="status">
          <AlertDescription>{unavailableReason}</AlertDescription>
        </Alert>
      )}

      {generationError && (
        <Alert className="group-match-feedback inline-message--error" role="alert">
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
      )}

      <Button
        className="group-match-action"
        type="button"
        disabled={!groupMatch.ready || generating}
        aria-describedby={!groupMatch.ready ? "destination-match-status" : undefined}
        onClick={() => void findDestinations()}
      >
        {generating ? "FINDING DESTINATIONS…" : "FIND DESTINATIONS"}
      </Button>
    </div>
  );
}
