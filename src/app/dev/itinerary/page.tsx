import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function DevelopmentItineraryEntry() {
  const tripId = process.env.NEXT_PUBLIC_DEV_TRIP_ID;

  return (
    <main className="plan-page">
      <SiteHeader />
      <section className="plan-placeholder" aria-labelledby="dev-itinerary-heading">
        <p className="eyebrow">DEVELOPMENT ENTRY</p>
        <h1 id="dev-itinerary-heading">Open the seeded trip.</h1>
        {tripId ? (
          <Link className="text-link" href={`/trips/${tripId}/itinerary`}>
            OPEN ITINERARY
          </Link>
        ) : (
          <p>Set NEXT_PUBLIC_DEV_TRIP_ID to a real backend trip UUID before starting Next.js.</p>
        )}
      </section>
    </main>
  );
}
