import { notFound, redirect } from "next/navigation";
import { JourneyEditor } from "@/components/journey-editor";
import { getJourneyBundleById } from "@/lib/journey-data";
import { createClient } from "@/lib/supabase/server";

export default async function JourneyEditPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`/login?next=/journeys/${journeyId}/edit`);
  const bundle = await getJourneyBundleById(journeyId);
  if (!bundle) notFound();
  return <JourneyEditor journey={bundle.journey} stops={bundle.stops} entries={bundle.entries} media={bundle.media} document={bundle.document} documentRevision={bundle.documentRevision} />;
}

