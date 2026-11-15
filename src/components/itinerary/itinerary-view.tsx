"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApprovalProgress, getApprovalProgress } from "@/lib/api/approval";
import { apiFetchBlob } from "@/lib/api/client";
import { getActivityPhotoUrl, getDestinationPhotoUrl, getItinerary, getRevision, Itinerary, ItineraryWeather, moveActivity, requestRevision, RevisionStatus, swapActivities } from "@/lib/api/itinerary";
import { getGroupMatch, GroupMatch, getTrip, Trip } from "@/lib/api/trip";
import { genericTravelFallback } from "@/lib/destination-image";
import type { ItineraryMapLocation } from "./itinerary-map";

const ItineraryMap = dynamic(() => import("./itinerary-map").then((module) => module.ItineraryMap), { ssr: false });

const revisionActions = [
  { label: "MAKE IT CHEAPER", instruction: "Make the itinerary cheaper while preserving the trip dates." },
  { label: "REDUCE WALKING", instruction: "Reduce walking in the itinerary while preserving the trip dates." },
  { label: "SWAP ACTIVITY", instruction: "Swap one activity for a comparable alternative." },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function ItineraryView({ tripId }: { tripId: string }) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [approval, setApproval] = useState<ApprovalProgress | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [groupMatch, setGroupMatch] = useState<GroupMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisionLabel, setRevisionLabel] = useState<string | null>(null);
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus | null>(null);
  const [revisionMessage, setRevisionMessage] = useState<string | null>(null);
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
        ? [{ id: activity.id, dayNumber: day.day_number, title: activity.title, location: activity.location, latitude: activity.latitude, longitude: activity.longitude, estimatedCost: activity.estimated_cost, photoUrl: getActivityPhotoUrl(activity), rating: activity.rating, ratingCount: activity.rating_count }]
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
      const [itineraryResult, approvalResult, tripResult, groupMatchResult] = await Promise.allSettled([
        getItinerary(tripId),
        getApprovalProgress(tripId),
        getTrip(tripId),
        getGroupMatch(tripId),
      ]);
      if (itineraryResult.status === "rejected") throw itineraryResult.reason;
      setItinerary(itineraryResult.value);
      if (approvalResult.status === "fulfilled") setApproval(approvalResult.value);
      if (tripResult.status === "fulfilled") setTrip(tripResult.value);
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
    setRevisionLabel(label);
    setRevisionStatus("RUNNING");
    setRevisionMessage(null);
    setError(null);
    try {
      const revision = await requestRevision(tripId, contextualInstruction(instruction));
      setRevisionStatus(revision.status);
      if (revision.status === "RUNNING" || revision.status === "PENDING") {
        let processingFinished = false;
        let finalRevisionStatus: RevisionStatus = revision.status;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          const revisionResult = await getRevision(tripId, revision.id);
          finalRevisionStatus = revisionResult.status;
          setRevisionStatus(revisionResult.status);
          const current = await getItinerary(tripId);
          setItinerary(current);
          if (!["RUNNING", "PENDING"].includes(revisionResult.status)) {
            processingFinished = true;
            break;
          }
        }
        if (!processingFinished) {
          setRevisionMessage("The backend is still processing this revision. Refresh to check the current state.");
        } else if (finalRevisionStatus === "SUCCEEDED") {
          setRevisionMessage("Revision succeeded. The backend returned the updated current itinerary.");
        } else if (finalRevisionStatus === "NO_CHANGE") {
          setRevisionMessage("The backend completed the request without changing the current itinerary.");
        } else if (finalRevisionStatus === "FAILED") {
          setRevisionMessage("The backend rejected this revision. The current itinerary was left unchanged.");
        }
      }
      await loadItinerary();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The revision could not be requested.");
      setRevisionStatus("FAILED");
      setRevisionMessage(null);
    } finally {
      setRevisionLabel(null);
    }
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

  return (
    <div className="itinerary-shell">
      <header className="itinerary-hero">
        <div>
          <p className="eyebrow">SHARED ITINERARY</p>
          <h1>YOUR GROUP&apos;S<br />CURRENT PLAN</h1>
          <p className="itinerary-meta">
            {trip?.name ?? "Shared trip"} · {itinerary.destination_name ?? `Destination ${itinerary.destination_id}`} · Version {itinerary.version}
            {approval ? ` · ${approval.approved_count}/${approval.eligible_count} approved` : ""}
          </p>
          {groupMatch?.common_date_ranges.ranges[0] && (
            <p className="itinerary-dates">
              {groupMatch.common_date_ranges.ranges[0].start_date} — {groupMatch.common_date_ranges.ranges[0].end_date}
            </p>
          )}
        </div>
        <div className="itinerary-hero-image" role="img" aria-label={`${itinerary.destination_name ?? "Travel"} landscape`} style={{ backgroundImage: `linear-gradient(135deg, rgb(19 21 17 / 14%), rgb(19 21 17 / 58%)), url("${renderedHeroImage}")` }} />
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
                      <span className="activity-copy"><strong>{activity.title}</strong>{activity.rating !== undefined && <small className="itinerary-place-rating">★ {activity.rating.toFixed(1)}{activity.rating_count ? ` · ${activity.rating_count.toLocaleString()} reviews` : ""}</small>}{activity.location && <small>{activity.location}</small>}<small className="activity-hint">{isRevising ? "" : "Drag to move"}</small></span>
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
          <section className="itinerary-map-section" aria-labelledby="map-heading">
            <p className="eyebrow">EXPLORE THE ROUTE</p>
            <h3 id="map-heading">Places that bring the plan together.</h3>
            <ItineraryMap locations={mapLocations} selectedActivityId={selectedActivityId} hoveredActivityId={hoveredActivityId} onMapSelectActivity={selectActivityFromMap} />
            {!mapLocations.length && <p className="inline-message">The itinerary is still usable. The configured place provider has not returned verified coordinates for these activities.</p>}
          </section>
        </section>

        <aside className="revision-panel" aria-labelledby="revision-heading">
          <p className="eyebrow">REFINE TOGETHER</p>
          <h2 id="revision-heading">Make the plan feel right for everyone.</h2>
          <p className="muted-copy">These actions are sent to the backend as revision instructions. The returned itinerary and version remain authoritative.</p>
          <div className="revision-actions">
            {revisionActions.map((action) => (
              <button className="secondary-button" disabled={isRevising || itinerary.status === "FINALIZED"} key={action.label} onClick={() => void revise(action.label, action.label === "SWAP ACTIVITY" && selectedActivity ? `Replace ${selectedActivity.title} with a comparable alternative.` : action.instruction)}>
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
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
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
            </div>
          </form>
          {revisionStatus && <p className="inline-message">Revision request: {revisionStatus.toLowerCase().replace("_", " ")}.</p>}
          {revisionMessage && <p className="inline-message">{revisionMessage}</p>}
          {error && <p className="inline-message inline-message--error">{error}</p>}
          <a className="text-link" href={`/trips/${tripId}/approval`}>VIEW APPROVAL</a>
        </aside>
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
