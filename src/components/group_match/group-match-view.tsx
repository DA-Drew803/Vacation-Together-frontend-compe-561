"use client";

import { useEffect, useState } from "react";

import { getTripMembers, TripMember } from "@/lib/api/approval";
import { getGroupMatch, GroupMatch } from "@/lib/api/trip";

import { useRouter } from "next/navigation";

import { generateDestinationCandidates } from "@/lib/api/destination";



function formatDate(dateString: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
}

function formatBudget(amount: string | number, currency: string) {
    const numericAmount = Number(amount);

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(numericAmount);
}

export function GroupMatchView({ tripId }: { tripId: string }) {
    const [groupMatch, setGroupMatch] = useState<GroupMatch | null>(null);
    const [members, setMembers] = useState<TripMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const [generating, setGenerating] = useState(false);



    useEffect(() => {
        async function loadGroupMatch() {
            try {
                setError(null);

                const [matchResult, memberResult] = await Promise.all([
                    getGroupMatch(tripId),
                    getTripMembers(tripId),
                ]);

                setGroupMatch(matchResult);
                setMembers(memberResult);
            } catch (requestError) {
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : "Unable to load the group match.",
                );
            } finally {
                setLoading(false);
            }
        }

        void loadGroupMatch();
    }, [tripId]);

    async function findDestinations() {
        if (!groupMatch?.ready || generating) {
            return;
        }

        try {
            setGenerating(true);
            setError(null);

            await generateDestinationCandidates(tripId);

            router.push(`/trips/${tripId}/results`);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Unable to generate destination matches.",
            );
        } finally {
            setGenerating(false);
        }
    }

    if (loading) {
        return <p>Loading group match...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    if (!groupMatch) {
        return <p>Group match unavailable.</p>;
    }

    const activeMembers = members.filter((member) => member.status === "ACTIVE");

    const firstDateRange = groupMatch.common_date_ranges.ranges[0];

    const sharedDates = firstDateRange
        ? `${formatDate(firstDateRange.start_date)} — ${formatDate(firstDateRange.end_date)}`
        : "No shared dates yet";

    const planningCeiling = `${formatBudget(
        groupMatch.group_max_budget.max_amount,
        groupMatch.group_max_budget.currency,
    )} / person`;

    return (
        <div className="group-match-shell">
            <section
                className="group-match-hero"
                aria-label="Group traveling together"
            >
                <div className="group-match-hero-image" />
            </section>

            <section className="group-match-intro">

                <p className="eyebrow">GROUP MATCH</p>

                <h1>Where your group aligns.</h1>

                <p className="group-match-description">
                    Everyone&apos;s inputs are combined into one shared direction for the
                    trip.
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

            {groupMatch.interests.length > 0 && (
                <section className="group-match-interests">
                    <p className="eyebrow">SHARED INTERESTS</p>
                    <p>{groupMatch.interests.join(" · ")}</p>
                </section>
            )}

            <section className="group-match-members" aria-labelledby="members-heading">
                <p className="eyebrow" id="members-heading">
                    GROUP MEMBERS
                </p>

                <div className="group-match-member-list">
                    {activeMembers.map((member) => (
                        <div className="group-match-member" key={member.id}>
                            <span className="group-match-member-dot" aria-hidden="true" />
                            <span>{member.display_name}</span>
                        </div>
                    ))}
                </div>
            </section>

            {!groupMatch.ready && groupMatch.reason && (
                <p className="inline-message">{groupMatch.reason}</p>
            )}

            <button
                className="primary-button group-match-action"
                type="button"
                disabled={!groupMatch.ready || generating}
                onClick={() => void findDestinations()}
            >
                {generating ? "FINDING DESTINATIONS…" : "FIND DESTINATIONS"}
            </button>
        </div>
    );
}