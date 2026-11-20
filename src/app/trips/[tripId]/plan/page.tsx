import { SiteHeader } from "@/components/site-header";
import { PlanningView } from "@/components/planning/planning-view";

export default async function PlanningPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <main className="trip-page">
      <SiteHeader />

      <PlanningView tripId={tripId} />
    </main>
  );
}