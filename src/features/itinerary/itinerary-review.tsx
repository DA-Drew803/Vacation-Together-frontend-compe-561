"use client";

import { useId } from "react";
import type { Itinerary } from "@/lib/itinerary/types";
import styles from "./itinerary-review.module.css";

export function ItineraryReview({ itinerary }: { itinerary: Itinerary }) {
  const headingId = useId();
  const currency = itinerary.estimated_total_cost.currency;
  const formatMoney = new Intl.NumberFormat("en-US", { style: "currency", currency });

  return (
    <section className={styles.review} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>ITINERARY · VERSION {itinerary.version}</p>
          <h2 id={headingId}>Review your group itinerary</h2>
        </div>
        <div className={styles.total}>
          <span>ESTIMATED TOTAL</span>
          <strong>{formatMoney.format(itinerary.estimated_total_cost.max_amount)}</strong>
          <small>per person</small>
        </div>
      </div>

      <ol className={styles.days}>
        {itinerary.days.map((day, index) => {
          const dayNumber = day.day_number ?? index + 1;
          return (
            <li className={styles.day} key={dayNumber}>
              <span className={styles.dayLabel}>DAY {String(dayNumber).padStart(2, "0")}</span>
              <div className={styles.dayContent}>
                {(day.activities ?? []).map((activity, activityIndex) => (
                  <div className={styles.activity} key={`${dayNumber}-${activity.position ?? activityIndex}`}>
                    <span>{activity.title ?? "Untitled activity"}</span>
                    {typeof activity.estimated_cost === "number" && (
                      <span>{formatMoney.format(activity.estimated_cost)}</span>
                    )}
                  </div>
                ))}
                {!day.activities?.length && <p>No activities are available for this day.</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
