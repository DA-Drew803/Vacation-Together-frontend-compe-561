import { DestinationResultsView } from "@/components/destination/destination-results-view";
import { SiteHeader } from "@/components/site-header";

export default async function DestinationResultsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <main className="trip-page">
      <SiteHeader />
      <DestinationResultsView tripId={tripId} />
    </main>
  );
}