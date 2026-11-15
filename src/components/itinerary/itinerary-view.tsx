"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApprovalProgress, getApprovalProgress } from "@/lib/api/approval";
import { apiFetchBlob } from "@/lib/api/client";
import { getDestinationPhotoUrl, getItinerary, getRevision, Itinerary, ItineraryWeather, requestRevision, RevisionStatus } from "@/lib/api/itinerary";
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
  const mapLocations = useMemo<ItineraryMapLocation[]>(
    () => itinerary?.days.flatMap((day) => day.activities.flatMap((activity) => (
      activity.location && typeof activity.latitude === "number" && typeof activity.longitude === "number"
        ? [{ id: activity.id, dayNumber: day.day_number, title: activity.title, location: activity.location, latitude: activity.latitude, longitude: activity.longitude, estimatedCost: activity.estimated_cost }]
        : []
    ))) ?? [],
    [itinerary],
  );

  const selectedActivity = itinerary?.days.flatMap((day) => day.activities).find((activity) => activity.id === selectedActivityId);

  function contextualInstruction(instruction: string) {
    const context = [
      selectedDay ? `Target day ${selectedDay}.` : "",
      selectedActivity ? `Target activity: ${selectedActivity.title}.` : "",
    ].filter(Boolean).join(" ");
    return context ? `${context} ${instruction}` : instruction;
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
              <article className={`day-card${selectedDay === day.day_number ? " day-card--selected" : ""}`} key={day.day_number}>
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
                      className={`activity-row${selectedActivityId === activity.id ? " activity-row--selected" : ""}`}
                      key={activity.id}
                      type="button"
                      aria-pressed={selectedActivityId === activity.id}
                      onClick={() => { setSelectedActivityId(selectedActivityId === activity.id ? null : activity.id); setSelectedDay(day.day_number); }}
                    >
                      <span className="activity-copy"><strong>{activity.title}</strong>{activity.location && <small>{activity.location}</small>}</span>
                      <span>{formatMoney(activity.estimated_cost, itinerary.estimated_total_cost.currency)}</span>
                    </button>
                  ))}
                </div>
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
            <ItineraryMap locations={mapLocations} selectedActivityId={selectedActivityId} />
            {!mapLocations.length && <p className="inline-message">The itinerary is still usable. The configured place provider has not returned verified coordinates for these activities.</p>}
          </section>
        </section>

        <aside className="revision-panel" aria-labelledby="revision-heading">
          <p className="eyebrow">REFINE TOGETHER</p>
          <h2 id="revision-heading">Make the plan feel right for everyone.</h2>
          <p className="muted-copy">These actions are sent to the backend as revision instructions. The returned itinerary and version remain authoritative.</p>
          <div className="revision-actions">
            {revisionActions.map((action) => (
              <button className="secondary-button" disabled={isRevising || itinerary.status === "FINALIZED"} key={action.label} onClick={() => void revise(action.label, action.label === "SWAP ACTIVITY" && selectedActivity ? `Replace the selected activity with a comparable alternative.` : action.instruction)}>
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
