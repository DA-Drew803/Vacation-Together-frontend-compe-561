"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiFetchBlob } from "@/lib/api/client";
import { genericTravelFallback } from "@/lib/destination-image";
import { selectVotingHero } from "@/lib/destination-voting";
import { getItinerary } from "@/lib/api/itinerary";
import { getTrip, Trip } from "@/lib/api/trip";
import { closeVoting, DestinationCandidate, generateDestinationCandidates, getCandidatePhotoUrl, getDestinationCandidates, getMyDestinationVote, getVotingProgress, MyVote, startVoting, VotingProgress, voteForDestination } from "@/lib/api/destination";

function formatCost(candidate: DestinationCandidate) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: candidate.estimated_cost.currency, maximumFractionDigits: 0 }).format(candidate.estimated_cost.amount);
}

function weatherLabel(weather: DestinationCandidate["weather"]) {
  if (!weather || weather.data_type === "unavailable" || !Array.isArray(weather.days) || !weather.days.length) return "Weather unavailable";
  const firstDay = weather.days[0];
  if (!firstDay || typeof firstDay !== "object") return "Weather unavailable";
  const code = typeof firstDay.weather_code === "number" ? firstDay.weather_code : null;
  const conditions: Record<number, string> = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Foggy", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow",
    80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  const condition = code !== null ? conditions[code] : null;
  const high = typeof firstDay.temperature_high === "number" ? `${Math.round(firstDay.temperature_high)}°` : null;
  return [condition, high].filter(Boolean).join(" · ") || "Weather unavailable";
}

export function DestinationVotingView({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<DestinationCandidate[]>([]);
  const [progress, setProgress] = useState<VotingProgress | null>(null);
  const [myVote, setMyVote] = useState<MyVote | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [hasItinerary, setHasItinerary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [votingCandidateId, setVotingCandidateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [candidateResult, progressResult, voteResult, tripResult, itineraryResult] = await Promise.allSettled([getDestinationCandidates(tripId), getVotingProgress(tripId), getMyDestinationVote(tripId), getTrip(tripId), getItinerary(tripId)]);
    if (candidateResult.status === "rejected") throw candidateResult.reason;
    if (progressResult.status === "rejected") throw progressResult.reason;
    if (voteResult.status === "rejected") throw voteResult.reason;
    setCandidates(candidateResult.value);
    setProgress(progressResult.value);
    setMyVote(voteResult.value);
    if (tripResult.status === "fulfilled") setTrip(tripResult.value);
    setHasItinerary(itineraryResult.status === "fulfilled");
  }, [tripId]);

  const ensureVotingStarted = useCallback(async () => {
    await refresh();
    const currentCandidates = await getDestinationCandidates(tripId);
    if (!currentCandidates.length) return;
    const state = await getVotingProgress(tripId);
    const currentTrip = await getTrip(tripId);
    if (state.status === "NOT_STARTED" && !currentTrip.selected_destination_id && currentTrip.state !== "FINALIZED") {
      await startVoting(tripId);
      await refresh();
    }
  }, [refresh, tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void ensureVotingStarted().catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load destination voting.")).finally(() => setLoading(false)); }, 0);
    return () => window.clearTimeout(timer);
  }, [ensureVotingStarted]);

  async function generateCandidates() {
    setGenerating(true); setError(null);
    try { await generateDestinationCandidates(tripId); await ensureVotingStarted(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Destination candidates could not be generated."); }
    finally { setGenerating(false); }
  }

  async function vote(candidateId: string) {
    if (!progress || progress.status !== "OPEN") return;
    setVotingCandidateId(candidateId); setError(null);
    try {
      await voteForDestination(tripId, candidateId);
      await refresh();
      try { await closeVoting(tripId); }
      catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "";
        if (!message.toLowerCase().includes("every eligible member")) throw requestError;
      }
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t update your vote. Your previous vote is unchanged.");
    } finally { setVotingCandidateId(null); }
  }

  const selectedDestination = useMemo(() => candidates.find((candidate) => candidate.destination_id === progress?.selected_destination_id), [candidates, progress?.selected_destination_id]);
  const closed = progress?.status === "CLOSED" || Boolean(trip?.selected_destination_id);
  const heroCandidate = useMemo(() => selectVotingHero(candidates, progress, myVote), [candidates, progress, myVote]);
  const [heroImage, setHeroImage] = useState<{ candidateId: string | null; url: string }>({ candidateId: null, url: genericTravelFallback });

  useEffect(() => {
    let objectUrl: string | null = null;
    if (!heroCandidate) return;
    void apiFetchBlob(getCandidatePhotoUrl(tripId, heroCandidate.id)).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setHeroImage({ candidateId: heroCandidate.id, url: objectUrl });
    }).catch(() => setHeroImage({ candidateId: heroCandidate.id, url: genericTravelFallback }));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [heroCandidate, tripId]);

  if (loading) return <div className="state-panel"><p className="eyebrow">LOADING DESTINATION VOTING</p><p>Checking the current candidates and group ballot.</p></div>;
  if (error && !progress) return <div className="state-panel"><p className="eyebrow">VOTING UNAVAILABLE</p><p>{error}</p><button className="secondary-button" onClick={() => { setLoading(true); void ensureVotingStarted().catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Unable to load voting.")).finally(() => setLoading(false)); }}>TRY AGAIN</button></div>;

  return <div className="voting-shell">
    <section className="voting-hero" aria-label="Destination preview">
      <img className="voting-hero-image" src={heroImage.candidateId === heroCandidate?.id ? heroImage.url : genericTravelFallback} alt={heroCandidate ? `${heroCandidate.name} destination` : "Destination preview"} />
      <div className="voting-hero-overlay"><p className="eyebrow">DESTINATION PREVIEW</p><strong>{heroCandidate?.name ?? "YOUR DESTINATION"}</strong></div>
    </section>
    <section className="voting-intro" aria-labelledby="voting-heading"><p className="eyebrow">DESTINATION VOTING</p><h1 id="voting-heading">Choose together.</h1><p>Ranked for your shared dates, per-person budget, interests, and available forecast.</p>{trip?.name && <span className="voting-trip-name">{trip.name}</span>}</section>
    {!candidates.length ? <section className="voting-empty state-panel"><p className="eyebrow">NO CANDIDATES YET</p><p>The backend has not returned destination candidates for this trip.</p><Button className="primary-button" disabled={generating} onClick={() => void generateCandidates()}>{generating ? "GENERATING…" : "GENERATE CANDIDATES"}</Button></section> : <section className="candidate-list" aria-label="Destination candidates">{candidates.map((candidate) => {
      const isMine = myVote?.candidate_id === candidate.id;
      const tally = progress?.tallies[candidate.id] ?? 0;
      const isWinner = candidate.destination_id === progress?.selected_destination_id;
      return <article className={`candidate-row${isMine ? " candidate-row--selected" : ""}${isWinner ? " candidate-row--winner" : ""}`} key={candidate.id}><div className="candidate-copy"><div className="candidate-heading"><h2>{candidate.name}</h2>{isWinner && <span className="candidate-badge">SELECTED</span>}</div><p className="candidate-meta">{Math.round(candidate.match_score * 100)}% match · {formatCost(candidate)}/person · {weatherLabel(candidate.weather)}</p><p className="candidate-reason">{candidate.reason}</p><p className="candidate-votes">{tally} {tally === 1 ? "vote" : "votes"}</p></div>{!closed && <button className={`candidate-vote-button${isMine ? " candidate-vote-button--selected" : ""}`} disabled={Boolean(votingCandidateId)} onClick={() => void vote(candidate.id)}>{votingCandidateId === candidate.id ? "SAVING…" : isMine ? "✓ YOUR VOTE" : "VOTE"}</button>}{closed && isWinner && <span className="candidate-locked">✓ GROUP CHOICE</span>}</article>;
    })}</section>}
    {progress && <section className="voting-footer">{closed ? <><p className="eyebrow">DESTINATION SELECTED</p><h2>{selectedDestination?.name ?? "Your group’s destination is locked in."}</h2><p>Your destination is ready. The backend will reuse it for itinerary generation.</p><Button asChild className="primary-button voting-continue"><Link href={`/trips/${tripId}/itinerary`}>{hasItinerary ? "VIEW ITINERARY" : "CHECK ITINERARY"}</Link></Button></> : <><strong>{progress.voted_count} of {progress.eligible_count} travelers have voted.</strong><p>You can change your vote until voting closes.</p></>}</section>}
    {error && <p className="inline-message inline-message--error">{error}</p>}
  </div>;
}
