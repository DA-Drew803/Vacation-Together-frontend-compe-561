"use client";

import { useCallback, useEffect, useState } from "react";
import { approveCurrentVersion, ApprovalProgress, getApprovalProgress, getTripMembers, TripMember } from "@/lib/api/approval";

export function ApprovalView({ tripId }: { tripId: string }) {
  const [progress, setProgress] = useState<ApprovalProgress | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myApproval, setMyApproval] = useState<{ member_id: string; approved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApproval = useCallback(async () => {
    setError(null);
    try {
      const [approvalProgress, tripMembers] = await Promise.all([getApprovalProgress(tripId), getTripMembers(tripId)]);
      setProgress(approvalProgress);
      setMembers(tripMembers);
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
      const approval = await approveCurrentVersion(tripId, progress.version);
      setMyApproval({ member_id: approval.member_id, approved: approval.approved });
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
  return (
    <div className="approval-shell">
      <div className="approval-visual" role="img" aria-label="Travel landscape" />
      <section className="approval-card" aria-labelledby="approval-heading">
        <p className="eyebrow">VERSION {progress.version} · {progress.approved_count}/{progress.eligible_count} APPROVED</p>
        <h1 id="approval-heading">{finalized ? "ITINERARY FINALIZED" : "Ready to make it official?"}</h1>
        <p className="approval-lede">{finalized ? `Everyone approved Version ${progress.version}. Your trip is ready.` : "Everyone approves the same current itinerary version."}</p>
        <div className="approval-progress" aria-label={`${progress.approved_count} of ${progress.eligible_count} eligible members approved`}><span style={{ width: `${progress.eligible_count ? Math.min(100, (progress.approved_count / progress.eligible_count) * 100) : 0}%` }} /></div>
        <div className="member-list">
          {members.filter((member) => member.voting_eligible).map((member) => (
            <div className="member-row" key={member.id}>
              <span>{member.display_name}</span>
              <span className="member-state">
                {myApproval?.member_id === member.id && myApproval.approved ? "APPROVED" : "STATUS UNAVAILABLE"}
              </span>
            </div>
          ))}
        </div>
        <p className="approval-note">The backend returns aggregate approval progress. Individual approved/waiting labels are not available from the current API.</p>
        {!finalized && <button className="primary-button approval-button" disabled={submitting} onClick={() => void approve()}>{submitting ? "APPROVING…" : `APPROVE VERSION ${progress.version}`}</button>}
        {error && <p className="inline-message inline-message--error">{error}</p>}
        <a className="text-link" href={`/trips/${tripId}/itinerary`}>BACK TO ITINERARY</a>
      </section>
    </div>
  );
}
