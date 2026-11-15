"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { approveCurrentVersion, ApprovalProgress, getApprovalProgress } from "@/lib/api/approval";
import { getItinerary, Itinerary } from "@/lib/api/itinerary";

export function ApprovalView({ tripId }: { tripId: string }) {
  const [progress, setProgress] = useState<ApprovalProgress | null>(null);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApproval = useCallback(async () => {
    setError(null);
    try {
      const [approvalProgress, currentItinerary] = await Promise.all([getApprovalProgress(tripId), getItinerary(tripId)]);
      setProgress(approvalProgress);
      setItinerary(currentItinerary);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load approval progress.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadApproval(), 0);
    return () => window.clearTimeout(timer);
  }, [loadApproval]);

  async function approve() {
    if (!progress) return;
    setSubmitting(true);
    setError(null);
    try {
      await approveCurrentVersion(tripId, progress.version);
      await loadApproval();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Approval could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="state-panel"><p className="eyebrow">LOADING APPROVAL</p><p>Checking the backend&apos;s current version and group progress.</p></div>;
  if (!progress) return <div className="state-panel"><p className="eyebrow">APPROVAL UNAVAILABLE</p><p>{error ?? "No approval progress was returned."}</p><button className="secondary-button" onClick={() => { setLoading(true); void loadApproval(); }}>TRY AGAIN</button></div>;

  const finalized = progress.finalized;
  const members = progress.members ?? [];
  const currentMember = members.find((member) => member.member_id === progress.current_member_id);
  const destinationLabel = itinerary?.destination_name ?? "SELECTED DESTINATION";
  return (
    <div className="approval-shell">
      <div className="approval-photo">
        <Image className="approval-photo-image" src="/images/approval-group-dinner.png" alt="Friends sharing dinner during a city trip" fill priority sizes="(max-width: 800px) 100vw, 900px" />
      </div>
      <section className="approval-card" aria-labelledby="approval-heading">
        <p className="eyebrow approval-kicker">APPROVAL</p>
        <h1 id="approval-heading">{finalized ? "Your trip is official." : "Ready to make it official?"}</h1>
        <p className="approval-destination">{destinationLabel} · ITINERARY VERSION {progress.version}</p>
        <p className="approval-lede">Everyone approves the same current version.</p>
        <div className="member-list">
          {members.map((member) => (
            <div className="member-row" key={member.member_id}>
              <span className="member-name"><span className={`member-dot${member.approved ? " member-dot--approved" : ""}`} aria-hidden="true" />{member.display_name}</span>
              <span className={`member-state${member.approved ? " member-state--approved" : ""}`}>{member.approved ? "APPROVED" : "WAITING"}</span>
            </div>
          ))}
        </div>
        {finalized && <div className="approval-finalized"><strong>✓ ITINERARY FINALIZED</strong><p>Everyone approved Version {progress.version}.<br />Your trip is ready.</p></div>}
        {error && <p className="inline-message inline-message--error">{error}</p>}
        <div className="approval-actions">
          {!finalized && (currentMember?.approved ? <p className="approval-current">✓ YOU APPROVED VERSION {progress.version}</p> : <button className="primary-button approval-button" disabled={submitting} onClick={() => void approve()}>{submitting ? "APPROVING…" : `APPROVE VERSION ${progress.version}`}</button>)}
          <a className="text-link" href={`/trips/${tripId}/itinerary`}>BACK TO ITINERARY</a>
        </div>
      </section>
    </div>
  );
}
