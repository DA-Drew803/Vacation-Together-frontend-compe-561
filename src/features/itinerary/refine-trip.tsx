"use client";

import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/lib/itinerary/types";
import styles from "./itinerary-review.module.css";
import type { ReviewFeedback } from "./use-itinerary-review";

interface RefineTripProps {
  itinerary: Itinerary;
  isSubmitting: boolean;
  feedback: ReviewFeedback;
  onSubmitCheaperDay: (dayNumber: number) => Promise<boolean>;
  onRefresh?: () => Promise<unknown>;
}

export function RefineTrip({
  itinerary,
  isSubmitting,
  feedback,
  onSubmitCheaperDay,
  onRefresh,
}: RefineTripProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dayNumber, setDayNumber] = useState("");
  const id = useId();
  const formId = `${id}-cheaper-day-form`;
  const dayId = `${id}-revision-day`;
  const walkingDescriptionId = `${id}-reduce-walking-explanation`;
  const swapDescriptionId = `${id}-swap-activity-explanation`;
  const cannotRevise = itinerary.status === "FINALIZED" || itinerary.status === "REVISING";
  const days = itinerary.days.map((day, index) => day.day_number ?? index + 1);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const succeeded = await onSubmitCheaperDay(Number(dayNumber));
    if (succeeded) {
      setDialogOpen(false);
      setDayNumber("");
    }
  }

  return (
    <aside className={styles.refine} aria-labelledby={`${id}-heading`}>
      <p className={styles.kicker} id={`${id}-heading`}>REFINE YOUR TRIP</p>
      <div className={styles.actions}>
        <Button
          variant="outline"
          className={styles.actionButton}
          disabled={cannotRevise || isSubmitting}
          aria-expanded={dialogOpen}
          aria-controls={formId}
          onClick={() => setDialogOpen((open) => !open)}
        >
          MAKE IT CHEAPER
        </Button>
        <Button className={styles.actionButton} variant="outline" disabled aria-describedby={walkingDescriptionId}>
          REDUCE WALKING
        </Button>
        <p className="sr-only" id={walkingDescriptionId}>
          Not available because the backend does not expose the mobility metadata required for a safe revision.
        </p>
        <Button className={styles.actionButton} variant="outline" disabled aria-describedby={swapDescriptionId}>
          SWAP ACTIVITY
        </Button>
        <p className="sr-only" id={swapDescriptionId}>
          Not available because the backend does not expose the activity metadata required for a safe replacement.
        </p>
      </div>

      {dialogOpen && !cannotRevise && (
        <form className={styles.form} id={formId} onSubmit={submit}>
          <label htmlFor={dayId}>Choose a day to make cheaper</label>
          <select
            className={styles.select}
            id={dayId}
            value={dayNumber}
            onChange={(event) => setDayNumber(event.target.value)}
            disabled={isSubmitting}
            required
          >
            <option value="">Select a day</option>
            {days.map((day) => <option value={day} key={day}>Day {day}</option>)}
          </select>
          <p>Only estimated costs on the selected day may change.</p>
          <div className={styles.formActions}>
            <Button className={styles.submit} type="submit" disabled={!dayNumber || isSubmitting}>
              {isSubmitting ? "PROCESSING…" : "REQUEST REVISION"}
            </Button>
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => setDialogOpen(false)}>
              CANCEL
            </Button>
          </div>
        </form>
      )}

      {itinerary.status === "FINALIZED" && (
        <p className={styles.note}>This itinerary is finalized and can no longer be revised.</p>
      )}
      {itinerary.status === "REVISING" && (
        <p className={styles.note} role="status">A revision is already processing.</p>
      )}
      <p className={styles.note}>
        Reduce Walking and Swap Activity are unavailable until the API provides the trusted metadata required to apply them safely.
      </p>

      {feedback && (
        <Alert className={cn(styles.feedback, feedback.kind === "success" && styles.feedbackSuccess, feedback.kind === "error" && styles.feedbackError)} role={feedback.kind === "error" ? "alert" : "status"} aria-live="polite">
          <AlertDescription>{feedback.message}</AlertDescription>
          {feedback.kind !== "success" && onRefresh && (
            <Button className={styles.feedbackButton} type="button" variant="ghost" onClick={() => void onRefresh()} disabled={isSubmitting}>
              REFRESH ITINERARY
            </Button>
          )}
        </Alert>
      )}
    </aside>
  );
}
