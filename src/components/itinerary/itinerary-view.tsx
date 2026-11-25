"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApprovalProgress, getApprovalProgress } from "@/lib/api/approval";
import { apiFetchBlob } from "@/lib/api/client";
import { getActivityPhotoUrl, getDestinationPhotoUrl, getItinerary, getRevision, Itinerary, ItineraryWeather, moveActivity, requestRevision, RevisionStatus, swapActivities } from "@/lib/api/itinerary";
import { getGroupMatch, GroupMatch } from "@/lib/api/trip";
import { genericTravelFallback } from "@/lib/destination-image";
import { revisionFailureMessage } from "@/lib/itinerary/revision-failure";
import type { ItineraryMapLocation } from "./itinerary-map";

const ItineraryMap = dynamic(() => import("./itinerary-map").then((module) => module.ItineraryMap), { ssr: false });

const revisionActions = [
  { label: "MAKE IT CHEAPER", instruction: "Make the itinerary cheaper while preserving the destination, trip dates, important activities, budget rules, and number of travel days." },
  { label: "REDUCE WALKING", instruction: "Reduce unnecessary walking and travel between activities by choosing geographically closer alternatives while preserving the destination, overall trip, important activities, budget, and number of travel days." },
  { label: "ADD MORE FREE TIME", instruction: "Replace one nonessential activity with free time or a relaxed rest period. Keep the destination, trip dates, important activities, budget, and all other itinerary items unchanged." },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function formatHeroDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date).toUpperCase();
}

function summarizeRevisionRequest(label: string, instruction: string) {
  const summaries: Record<string, string> = {
    "MAKE IT CHEAPER": "Reduced the estimated cost of your itinerary.",
    "REDUCE WALKING": "Reduced walking and travel between activities.",
    "ADD MORE FREE TIME": "Added more free time by creating a more relaxed itinerary.",
  };

  return summaries[label] ?? `Applied your request: “${instruction.trim()}”`;
}

function summarizeRevision(
  before: Itinerary,
  after: Itinerary,
  label: string,
  instruction: string,
) {
  const beforeActivities = before.days.flatMap((day) => day.activities.map((activity) => ({ activity, day: day.day_number })));
  const afterActivities = after.days.flatMap((day) => day.activities.map((activity) => ({ activity, day: day.day_number })));
  const beforeById = new Map(beforeActivities.map((entry) => [entry.activity.id, entry]));
  const afterById = new Map(afterActivities.map((entry) => [entry.activity.id, entry]));
  const beforeBySlot = new Map(beforeActivities.map((entry) => [`${entry.day}:${entry.activity.position}`, entry]));
  const added = afterActivities.filter((entry) => !beforeById.has(entry.activity.id));
  const removed = beforeActivities.filter((entry) => !afterById.has(entry.activity.id));
  const titleChanges = afterActivities.filter((entry) => {
    const previous = beforeBySlot.get(`${entry.day}:${entry.activity.position}`);
    return previous && previous.activity.title !== entry.activity.title;
  });

  if (added.length === 1 && removed.length === 1 && added[0].day === removed[0].day && added[0].activity.position === removed[0].activity.position) {
    return `Revision succeeded.\n\nReplaced ${removed[0].activity.title} with ${added[0].activity.title} on Day ${added[0].day}.`;
  }
  if (added.length === 1) {
    const entry = added[0];
    const previous = afterActivities.find((candidate) => candidate.day === entry.day && candidate.activity.position === entry.activity.position - 1);
    return `Revision succeeded.\n\nAdded ${entry.activity.title} to Day ${entry.day}${previous ? ` after ${previous.activity.title}` : ""}.`;
  }
  if (removed.length === 1) {
    return `Revision succeeded.\n\nRemoved ${removed[0].activity.title} from Day ${removed[0].day}.`;
  }
  if (titleChanges.length === 1) {
    const changed = titleChanges[0];
    const previous = beforeBySlot.get(`${changed.day}:${changed.activity.position}`);
    return `Revision succeeded.\n\nChanged ${previous?.activity.title ?? "the activity"} to ${changed.activity.title} on Day ${changed.day}. The rest of the itinerary stayed the same.`;
  }
  if (added.length > 1 && added.length <= 3) {
    const grouped = added.reduce<Record<number, string[]>>((result, entry) => {
      result[entry.day] ??= [];
      result[entry.day].push(entry.activity.title);
      return result;
    }, {});
    const detail = Object.entries(grouped).map(([day, titles]) => `Day ${day} now includes ${titles.join(", ")}`).join("; ");
    return `Revision succeeded.\n\n${detail}.`;
  }

  const changedDays = after.days.filter((day) => {
    const beforeDay = before.days.find((candidate) => candidate.day_number === day.day_number);
    return beforeDay && day.activities.reduce((total, activity) => total + activity.estimated_cost, 0) !== beforeDay.activities.reduce((total, activity) => total + activity.estimated_cost, 0);
  });
  if (changedDays.length === 1) {
    return `Revision succeeded.\n\nDay ${changedDays[0].day_number} was updated.`;
  }
  return `Revision succeeded.\n\n${summarizeRevisionRequest(label, instruction)}`;
}

export function ItineraryView({ tripId }: { tripId: string }) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [approval, setApproval] = useState<ApprovalProgress | null>(null);
  const [groupMatch, setGroupMatch] = useState<GroupMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisionLabel, setRevisionLabel] = useState<string | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string | null>(null);
  const revisionCancelRequested = useRef(false);
  const customRevisionInput = useRef<HTMLTextAreaElement | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [heroImage, setHeroImage] = useState(genericTravelFallback);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [draggingActivityId, setDraggingActivityId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayNumber: number; position: number } | null>(null);
  const [movingActivityId, setMovingActivityId] = useState<string | null>(null);
  const [hoveredActivityId, setHoveredActivityId] = useState<string | null>(null);
  const mapLocations = useMemo<ItineraryMapLocation[]>(
    () => itinerary?.days.flatMap((day) => day.activities.flatMap((activity) => (
      activity.location && typeof activity.latitude === "number" && typeof activity.longitude === "number"
        ? [{ id: activity.id, dayNumber: day.day_number, title: activity.title, purpose: activity.purpose, placeId: activity.place_id, about: activity.about, websiteUri: activity.website_uri, googleMapsUri: activity.google_maps_uri, reviews: activity.reviews?.map((review) => ({ text: review.text, author: review.author, rating: review.rating, relativeTime: review.relative_time })), location: activity.location, latitude: activity.latitude, longitude: activity.longitude, estimatedCost: activity.estimated_cost, photoUrl: getActivityPhotoUrl(activity), rating: activity.rating, ratingCount: activity.rating_count }]
        : []
    ))) ?? [],
    [itinerary],
  );

  const selectActivity = useCallback((activityId: string) => {
    const day = itinerary?.days.find((candidate) => candidate.activities.some((activity) => activity.id === activityId));
    setSelectedActivityId(activityId);
    if (day) setSelectedDay(day.day_number);
    window.requestAnimationFrame(() => document.getElementById(`activity-${activityId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }, [itinerary]);

  const selectActivityFromMap = useCallback((activityId: string) => {
    const day = itinerary?.days.find((candidate) => candidate.activities.some((activity) => activity.id === activityId));
    setSelectedActivityId(activityId);
    if (day) setSelectedDay(day.day_number);
  }, [itinerary]);

  const selectedActivity = itinerary?.days.flatMap((day) => day.activities).find((activity) => activity.id === selectedActivityId);

  function contextualInstruction(instruction: string) {
    const context = [
      selectedDay ? `Target day ${selectedDay}.` : "",
      selectedActivity ? `Target activity: ${selectedActivity.title}.` : "",
    ].filter(Boolean).join(" ");
    return context ? `${instruction} ${context}` : instruction;
  }

  const loadItinerary = useCallback(async () => {
    setError(null);
    try {
      const [itineraryResult, approvalResult, groupMatchResult] = await Promise.allSettled([
        getItinerary(tripId),
        getApprovalProgress(tripId),
        getGroupMatch(tripId),
      ]);
      if (itineraryResult.status === "rejected") throw itineraryResult.reason;
      setItinerary(itineraryResult.value);
      if (approvalResult.status === "fulfilled") setApproval(approvalResult.value);
      if (groupMatchResult.status === "fulfilled") setGroupMatch(groupMatchResult.value);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load the itinerary.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItinerary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadItinerary]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    if (!itinerary || !getDestinationPhotoUrl(itinerary)) return () => undefined;
    void apiFetchBlob(itinerary.destination_photo_url as string)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setHeroImage(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itinerary]);

  async function revise(label: string, instruction: string) {
    const previousItinerary = itinerary;
    if (!previousItinerary) return;
    revisionCancelRequested.current = false;
    setRevisionLabel(label);
    setRevisionMessage(null);
    setError(null);
    try {
      const revision = await requestRevision(tripId, contextualInstruction(instruction));
      if (revision.status === "RUNNING" || revision.status === "PENDING") {
        let processingFinished = false;
        let finalRevisionStatus: RevisionStatus = revision.status;
        let finalRevisionFailureReason: string | undefined;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          if (revisionCancelRequested.current) {
            setRevisionMessage("Stopped waiting for this request. The backend may finish it in the background; refresh to see the authoritative itinerary.");
            return;
          }
          const revisionResult = await getRevision(tripId, revision.id);
          finalRevisionStatus = revisionResult.status;
          finalRevisionFailureReason = revisionResult.failure_reason ?? undefined;
          if (!["RUNNING", "PENDING"].includes(revisionResult.status)) {
            processingFinished = true;
            break;
          }
        }
        if (!processingFinished) {
          setRevisionMessage("The backend is still processing this revision. Refresh to check the current state.");
        } else if (finalRevisionStatus === "SUCCEEDED") {
          const updatedItinerary = await getItinerary(tripId);
          setItinerary(updatedItinerary);
          setRevisionMessage(summarizeRevision(previousItinerary, updatedItinerary, label, instruction));
        } else if (finalRevisionStatus === "NO_CHANGE") {
          setRevisionMessage("The backend completed the request without changing the current itinerary.");
        } else if (finalRevisionStatus === "FAILED") {
          setRevisionMessage(revisionFailureMessage(finalRevisionFailureReason));
        }
      }
      await loadItinerary();
    } catch (requestError) {
      setError(null);
      setRevisionMessage(revisionFailureMessage(requestError instanceof Error ? requestError.message : undefined));
    } finally {
      setRevisionLabel(null);
    }
  }

  function cancelRevisionWait() {
    revisionCancelRequested.current = true;
    setRevisionMessage("Stopped waiting for this request. The backend may finish it in the background; refresh to see the authoritative itinerary.");
  }

  function retryRevision() {
    setRevisionMessage(null);
    setError(null);
    window.requestAnimationFrame(() => customRevisionInput.current?.focus());
  }

  async function moveSelectedActivity(activityId: string, dayNumber: number, position: number) {
    if (!itinerary || itinerary.status === "FINALIZED" || itinerary.status !== "DRAFT") return;
    const sourceDay = itinerary.days.find((day) => day.activities.some((candidate) => candidate.id === activityId));
    const activity = sourceDay?.activities.find((candidate) => candidate.id === activityId);
    if (!sourceDay || !activity || (sourceDay.day_number === dayNumber && activity.position === position)) return;

    setMovingActivityId(activityId);
    setError(null);
    try {
      const updated = await moveActivity(tripId, activityId, dayNumber, position);
      setItinerary(updated);
      setSelectedDay(dayNumber);
      setSelectedActivityId(activityId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The activity could not be moved.");
    } finally {
      setMovingActivityId(null);
      setDraggingActivityId(null);
      setDropTarget(null);
    }
  }

  async function swapSelectedActivity(sourceActivityId: string, targetActivityId: string) {
    if (!itinerary || itinerary.status !== "DRAFT" || sourceActivityId === targetActivityId) return;
    setMovingActivityId(sourceActivityId);
    setError(null);
    try {
      const updated = await swapActivities(tripId, sourceActivityId, targetActivityId);
      setItinerary(updated);
      setSelectedActivityId(sourceActivityId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The activities could not be swapped.");
    } finally {
      setMovingActivityId(null);
      setDraggingActivityId(null);
      setDropTarget(null);
    }
  }

  function handleActivityDrop(sourceActivityId: string, targetActivityId: string, targetDay: number, targetPosition: number) {
    if (!itinerary || sourceActivityId === targetActivityId) return;
    const sourceDay = itinerary.days.find((day) => day.activities.some((activity) => activity.id === sourceActivityId));
    if (!sourceDay) return;
    if (sourceDay.day_number === targetDay) {
      void moveSelectedActivity(sourceActivityId, targetDay, targetPosition);
    } else {
      void swapSelectedActivity(sourceActivityId, targetActivityId);
    }
  }

  function handleAccessibleTarget(targetActivityId: string) {
    if (!selectedActivityId || !itinerary) return;
    const targetDay = itinerary.days.find((day) => day.activities.some((activity) => activity.id === targetActivityId));
    if (!targetDay) return;
    handleActivityDrop(selectedActivityId, targetActivityId, targetDay.day_number, targetDay.activities.find((activity) => activity.id === targetActivityId)?.position ?? 1);
  }

  function submitCustomRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const instruction = customInstruction.trim();
    if (!instruction || !itinerary || isRevising || itinerary.status === "FINALIZED") return;
    setCustomInstruction("");
    void revise("CUSTOM REQUEST", instruction);
  }

  if (loading) return <StatePanel title="LOADING ITINERARY" detail="Checking the latest shared version." />;
  if (error && !itinerary) {
    return <StatePanel title="ITINERARY UNAVAILABLE" detail={error} action={<button className="secondary-button" onClick={() => { setLoading(true); void loadItinerary(); }}>TRY AGAIN</button>} />;
  }
  if (!itinerary) return <StatePanel title="ITINERARY UNAVAILABLE" detail="No itinerary was returned for this trip." />;

  const isRevising = itinerary.status === "REVISING" || revisionLabel !== null;
  const statusLabel = itinerary.status === "FINALIZED" ? "FINALIZED" : itinerary.status;
  const renderedHeroImage = getDestinationPhotoUrl(itinerary) ? heroImage : genericTravelFallback;
  const heroDestination = itinerary.destination_name ?? `Destination ${itinerary.destination_id}`;
  const heroDateRange = groupMatch?.common_date_ranges.ranges[0];
  const heroDates = heroDateRange ? `${formatHeroDate(heroDateRange.start_date)} — ${formatHeroDate(heroDateRange.end_date)}` : null;
  const heroApproval = approval ? `${approval.approved_count}/${approval.eligible_count} APPROVED` : "APPROVAL STATUS UNAVAILABLE";

  return (
    <div className="itinerary-shell">
      <header className="itinerary-hero">
        <div className="itinerary-hero-image" role="img" aria-label={`${heroDestination} destination`} style={{ backgroundImage: `linear-gradient(135deg, rgb(19 21 17 / 14%), rgb(19 21 17 / 58%)), url("${renderedHeroImage}")` }} />
        <div className="itinerary-hero-info">
          <p className="eyebrow">{heroDestination}</p>
          <h1>Your group itinerary</h1>
          <p className="itinerary-hero-dates">{itinerary.days.length} {itinerary.days.length === 1 ? "DAY" : "DAYS"}{heroDates ? ` · ${heroDates}` : ""}</p>
          <p className="itinerary-hero-version">VERSION {itinerary.version} · {heroApproval}</p>
        </div>
      </header>

      <div className="itinerary-layout">
        <section className="itinerary-content" aria-labelledby="itinerary-heading">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">VERSION {itinerary.version}</p>
              <h2 id="itinerary-heading">The days ahead</h2>
            </div>
            <span className={`status-pill status-pill--${itinerary.status.toLowerCase()}`}>{statusLabel}</span>
          </div>
          {itinerary.status === "FAILED" && <p className="inline-message inline-message--error">The backend reported that itinerary generation failed.</p>}
          <div className="days-list">
            {itinerary.days.map((day) => (
              <article
                className={`day-card${selectedDay === day.day_number ? " day-card--selected" : ""}${dropTarget?.dayNumber === day.day_number ? " day-card--drop-target" : ""}`}
                key={day.day_number}
                onDragOver={(event) => {
                  const sourceDay = draggingActivityId ? itinerary.days.find((candidate) => candidate.activities.some((activity) => activity.id === draggingActivityId)) : null;
                  if (sourceDay?.day_number === day.day_number && !isRevising && !movingActivityId && itinerary.status === "DRAFT") {
                    event.preventDefault();
                    setDropTarget({ dayNumber: day.day_number, position: day.activities.length + 1 });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceDay = draggingActivityId ? itinerary.days.find((candidate) => candidate.activities.some((activity) => activity.id === draggingActivityId)) : null;
                  if (sourceDay?.day_number === day.day_number && draggingActivityId && dropTarget) void moveSelectedActivity(draggingActivityId, dropTarget.dayNumber, dropTarget.position);
                }}
              >
                <button
                  className="day-select"
                  type="button"
                  aria-pressed={selectedDay === day.day_number}
                  onClick={() => { setSelectedDay(selectedDay === day.day_number ? null : day.day_number); setSelectedActivityId(null); }}
                >
                  <span className="day-number">DAY {String(day.day_number).padStart(2, "0")}</span>
                  <WeatherLabel weather={itinerary.weather?.[day.day_number - 1]} />
                </button>
                <div className="activity-list">
                  {day.activities.map((activity) => (
                    <button
                      className={`activity-row${selectedActivityId === activity.id ? " activity-row--selected" : ""}${draggingActivityId === activity.id ? " activity-row--dragging" : ""}${dropTarget?.dayNumber === day.day_number && dropTarget.position === activity.position ? " activity-row--drop-target" : ""}`}
                      id={`activity-${activity.id}`}
                      key={activity.id}
                      type="button"
                      draggable={!isRevising && !movingActivityId && itinerary.status === "DRAFT"}
                      onDragStart={() => { setDraggingActivityId(activity.id); setSelectedActivityId(activity.id); setSelectedDay(day.day_number); }}
                      onDragEnd={() => { setDraggingActivityId(null); setDropTarget(null); }}
                      onMouseEnter={() => setHoveredActivityId(activity.id)}
                      onMouseLeave={() => setHoveredActivityId(null)}
                      onDragOver={(event) => { if (!isRevising && !movingActivityId && itinerary.status === "DRAFT") { event.preventDefault(); event.stopPropagation(); setDropTarget({ dayNumber: day.day_number, position: activity.position }); } }}
                      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingActivityId) handleActivityDrop(draggingActivityId, activity.id, day.day_number, activity.position); }}
                      aria-pressed={selectedActivityId === activity.id}
                      onClick={() => {
                        if (selectedActivityId === activity.id) {
                          setSelectedActivityId(null);
                          return;
                        }
                        selectActivity(activity.id);
                      }}
                    >
                      <ActivityPhoto activity={activity} />
                      <span className="activity-copy">{activity.purpose && <small className="activity-purpose">{activity.purpose}</small>}<strong>{activity.title}</strong>{activity.rating !== undefined && <small className="itinerary-place-rating">★ {activity.rating.toFixed(1)}{activity.rating_count ? ` · ${activity.rating_count.toLocaleString()} reviews` : ""}</small>}{activity.location && <small>{activity.location}</small>}<small className="activity-hint">{isRevising ? "" : "Drag to move"}</small></span>
                      <span>{formatMoney(activity.estimated_cost, itinerary.estimated_total_cost.currency)}</span>
                    </button>
                  ))}
                </div>
                {selectedActivityId && !isRevising && itinerary.status === "DRAFT" && (
                  <label className="move-activity-control">
                    <span>SWAP WITH…</span>
                    <select value="" onChange={(event) => handleAccessibleTarget(event.target.value)} disabled={Boolean(movingActivityId)}>
                      <option value="">Choose a target activity</option>
                      {itinerary.days.map((targetDay) => (
                        <optgroup key={targetDay.day_number} label={`DAY ${String(targetDay.day_number).padStart(2, "0")}`}>
                          {targetDay.activities.filter((activity) => activity.id !== selectedActivityId).map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}
              </article>
            ))}
          </div>
          <div className="itinerary-total">
            <span>ESTIMATED TOTAL</span>
            <strong>{formatMoney(itinerary.estimated_total_cost.max_amount, itinerary.estimated_total_cost.currency)}</strong>
          </div>
        </section>

        <aside className="revision-panel" aria-labelledby="revision-heading">
          <p className="eyebrow">REFINE TOGETHER</p>
          <h2 id="revision-heading">Make the plan feel right for everyone.</h2>
          <p className="muted-copy">These actions are sent to the backend as revision instructions. The returned itinerary and version remain authoritative.</p>
          <div className="revision-actions">
            {revisionActions.map((action) => (
              <button className="secondary-button" disabled={isRevising || itinerary.status === "FINALIZED"} key={action.label} onClick={() => void revise(action.label, action.instruction)}>
                {revisionLabel === action.label ? "REVISING…" : action.label}
              </button>
            ))}
          </div>
          <form className="revision-chat" onSubmit={submitCustomRevision}>
            <label className="revision-chat__label" htmlFor="custom-revision">
              ASK FOR A CUSTOM CHANGE
            </label>
            <textarea
              id="custom-revision"
              className="revision-chat__input"
              ref={customRevisionInput}
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Tell the group what you want to change…"
              maxLength={500}
              rows={4}
              disabled={isRevising || itinerary.status === "FINALIZED"}
            />
            <div className="revision-chat__footer">
              <span>{customInstruction.length}/500</span>
              <button
                className="primary-button revision-chat__submit"
                type="submit"
                disabled={!customInstruction.trim() || isRevising || itinerary.status === "FINALIZED"}
              >
                SEND REQUEST
              </button>
              {revisionLabel && <button className="revision-chat__cancel" type="button" onClick={cancelRevisionWait}>CANCEL WAIT</button>}
            </div>
          </form>
          {revisionLabel && <p className="inline-message">Updating your itinerary…</p>}
          {revisionMessage && <p className={`inline-message revision-message${revisionMessage.startsWith("Revision couldn’t be applied") ? " revision-message--failure" : ""}`}>{revisionMessage}</p>}
          <div className="revision-panel__actions">
            {revisionMessage?.startsWith("Revision couldn’t be applied") && <button className="revision-chat__retry" type="button" onClick={retryRevision}>TRY AGAIN</button>}
            <a className="text-link" href={`/trips/${tripId}/approval`}>VIEW APPROVAL</a>
          </div>
          {error && <p className="inline-message inline-message--error">{error}</p>}
        </aside>
        <section className="itinerary-map-section" aria-labelledby="map-heading">
          <p className="eyebrow">EXPLORE THE ROUTE</p>
          <h3 id="map-heading">Places that bring the plan together.</h3>
          <ItineraryMap locations={mapLocations} selectedActivityId={selectedActivityId} hoveredActivityId={hoveredActivityId} onMapSelectActivity={selectActivityFromMap} />
          {!mapLocations.length && <p className="inline-message">The itinerary is still usable. The configured place provider has not returned verified coordinates for these activities.</p>}
        </section>
      </div>
    </div>
  );
}

function ActivityPhoto({ activity }: { activity: Itinerary["days"][number]["activities"][number] }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const photoUrl = getActivityPhotoUrl(activity);

  useEffect(() => {
    if (!photoUrl) return undefined;
    let cancelled = false;
    let currentUrl: string | null = null;
    void apiFetchBlob(photoUrl).then((blob) => {
      if (cancelled) return;
      currentUrl = URL.createObjectURL(blob);
      setObjectUrl(currentUrl);
    }).catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [photoUrl]);

  if (objectUrl && !failed) {
    // Google photo bytes are loaded through the authenticated backend proxy.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="activity-photo" src={objectUrl} alt="" loading="lazy" />;
  }
  return <span className="activity-photo activity-photo--empty" aria-hidden="true">PLACE</span>;
}

function WeatherLabel({ weather }: { weather?: ItineraryWeather }) {
  if (!weather) return <span className="day-weather">Weather unavailable</span>;
  const icon = weatherIcon(weather.condition);
  const temperature = weather.temperature_high ?? weather.temperature_low;
  return <span className="day-weather" title={weatherConditionLabel(weather.condition)}>{icon} {temperature == null ? "—" : `${Math.round(temperature)}°F`}<small> · {weatherConditionLabel(weather.condition)}</small></span>;
}

function weatherIcon(condition: string) {
  const code = Number(condition.replace("weather_code_", ""));
  if ([0, 1].includes(code)) return "☀";
  if ([2, 3, 45, 48].includes(code)) return "☁";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "⚡";
  return "•";
}

function weatherConditionLabel(condition: string) {
  const code = Number(condition.replace("weather_code_", ""));
  if ([0, 1].includes(code)) return "Clear";
  if ([2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Weather";
}

function StatePanel({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="state-panel"><p className="eyebrow">{title}</p><p>{detail}</p>{action}</div>;
}
