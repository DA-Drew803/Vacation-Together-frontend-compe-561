"use client";

import type { Itinerary } from "@/lib/itinerary/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import styles from "./itinerary-review.module.css";
import { ItineraryReview } from "./itinerary-review";
import { RefineTrip } from "./refine-trip";
import { useItineraryReview } from "./use-itinerary-review";

interface ItineraryReviewFeatureProps {
  tripId: string;
  accessToken?: string | null;
  initialItinerary?: Itinerary | null;
  onItineraryChange?: (itinerary: Itinerary) => void;
  onUnauthorized?: () => void;
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
}

export function ItineraryReviewFeature(props: ItineraryReviewFeatureProps) {
  const review = useItineraryReview(props);

  if (review.isLoading && !review.itinerary) {
    return <p className={styles.state} role="status">Loading itinerary…</p>;
  }
  if (!review.itinerary) {
    return (
      <Alert className={styles.state} role="alert">
        <AlertDescription>{review.feedback?.message ?? "No itinerary is available yet."}</AlertDescription>
        <ButtonForRetry onClick={review.refresh} />
      </Alert>
    );
  }

  return (
    <div className={styles.feature}>
      <ItineraryReview itinerary={review.itinerary} />
      <RefineTrip
        itinerary={review.itinerary}
        isSubmitting={review.isSubmitting}
        feedback={review.feedback}
        onSubmitCheaperDay={review.submitCheaperDay}
        onRefresh={review.refresh}
      />
    </div>
  );
}

function ButtonForRetry({ onClick }: { onClick: () => Promise<unknown> }) {
  return <Button className="mt-3" variant="outline" type="button" onClick={() => void onClick()}>TRY AGAIN</Button>;
}
