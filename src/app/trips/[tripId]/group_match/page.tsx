import { GroupMatchView } from "@/components/group_match/group-match-view";
import { SiteHeader } from "@/components/site-header";

export default async function GroupMatchPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <main className="trip-page">
      <SiteHeader />
      <GroupMatchView tripId={tripId} />
    </main>
  );
}