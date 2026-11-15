import { SiteHeader } from "@/components/site-header";
import { ApprovalView } from "@/components/approval/approval-view";

export default async function ApprovalPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <main className="trip-page"><SiteHeader /><ApprovalView tripId={tripId} /></main>;
}
