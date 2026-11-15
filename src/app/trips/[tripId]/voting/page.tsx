import { SiteHeader } from "@/components/site-header";
import { DestinationVotingView } from "@/components/destination/destination-voting-view";

export default async function DestinationVotingPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <main className="trip-page"><SiteHeader /><DestinationVotingView tripId={tripId} /></main>;
}
