import { SiteHeader } from "@/components/site-header";
import { ItineraryView } from "@/components/itinerary/itinerary-view";

export default async function ItineraryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <main className="trip-page"><SiteHeader /><ItineraryView tripId={tripId} /></main>;
}
