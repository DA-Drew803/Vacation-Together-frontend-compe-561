"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { apiFetchBlob } from "@/lib/api/client";
import {
  DestinationCandidate,
  getCandidatePhotoUrl,
  getDestinationCandidates,
} from "@/lib/api/destination";
import { genericTravelFallback } from "@/lib/destination-image";

function formatCost(candidate: DestinationCandidate) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: candidate.estimated_cost.currency,
    maximumFractionDigits: 0,
  }).format(candidate.estimated_cost.amount);
}

export function DestinationResultsView({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<DestinationCandidate[]>([]);
  const [candidateImages, setCandidateImages] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCandidates() {
      try {
        setError(null);

        const result = await getDestinationCandidates(tripId);

        setCandidates(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load destination matches.",
        );
      } finally {
        setLoading(false);
      }
    }

   void loadCandidates();
 }, [tripId]);

  useEffect(() => {
    if (!candidates.length) {
      return;
    }

    const objectUrls: string[] = [];

    async function loadImages() {
      const entries = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const blob = await apiFetchBlob(
              getCandidatePhotoUrl(tripId, candidate.id),
            );

            const objectUrl = URL.createObjectURL(blob);
            objectUrls.push(objectUrl);

            return [candidate.id, objectUrl] as const;
          } catch {
            return [candidate.id, genericTravelFallback] as const;
          }
        }),
      );

      setCandidateImages(Object.fromEntries(entries));
    }

    void loadImages();

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [candidates, tripId]);

  if (loading) {
    return (
      <div className="state-panel">
        <p className="eyebrow">LOADING DESTINATIONS</p>
        <p>Finding your group&apos;s best matches.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-panel">
        <p className="eyebrow">DESTINATIONS UNAVAILABLE</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <div className="state-panel">
        <p className="eyebrow">NO DESTINATIONS YET</p>
        <p>No destination matches have been generated for this trip.</p>
      </div>
    );
  }

  const rankedCandidates = [...candidates].sort(
    (a, b) => b.match_score - a.match_score,
  );

  const topCandidate = rankedCandidates[0];
  const otherCandidates = rankedCandidates.slice(1);

  return (
    <div className="destination-results-shell">
      <section className="destination-results-intro">
        <p className="eyebrow">YOUR BEST MATCHES</p>

        <h1>Where your group aligns.</h1>

        <p className="destination-results-description">
          Ranked across your shared dates, budget, interests, and available
          forecast.
        </p>
      </section>

      <section className="destination-results-featured">
        <div className="destination-results-featured-image">
          <img
            src={
              candidateImages[topCandidate.id] ?? genericTravelFallback
            }
            alt={`${topCandidate.name} destination`}
          />
        </div>

        <div className="destination-results-featured-copy">
          <p className="eyebrow">01</p>

          <p className="destination-results-location">
            {topCandidate.name}
          </p>

          <h2>{topCandidate.name}</h2>

          <strong>
            {Math.round(topCandidate.match_score * 100)}% GROUP MATCH
          </strong>

          <p className="destination-results-cost">
            About {formatCost(topCandidate)} / person
          </p>

          <p className="destination-results-reason">
            {topCandidate.reason}
          </p>
        </div>
      </section>

      {otherCandidates.length > 0 && (
        <section
          className="destination-results-secondary"
          aria-label="Other destination matches"
        >
          {otherCandidates.map((candidate, index) => (
            <article
              className="destination-results-secondary-card"
              key={candidate.id}
            >
              <div className="destination-results-secondary-image">
                <img
                  src={
                    candidateImages[candidate.id] ??
                    genericTravelFallback
                  }
                  alt={`${candidate.name} destination`}
                />
              </div>

              <p className="eyebrow">
                {String(index + 2).padStart(2, "0")}
              </p>

              <h2>{candidate.name}</h2>

              <strong>
                {Math.round(candidate.match_score * 100)}% match
              </strong>

              <p>{formatCost(candidate)} / person</p>
            </article>
          ))}
        </section>
      )}

      <div className="destination-results-footer">
        <Button asChild className="primary-button destination-results-action">
          <Link href={`/trips/${encodeURIComponent(tripId)}/voting`}>
            CONTINUE TO VOTING
          </Link>
        </Button>
      </div>
    </div>
  );
}
