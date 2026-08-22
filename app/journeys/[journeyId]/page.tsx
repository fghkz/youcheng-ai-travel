import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Compass } from "lucide-react";
import { JourneyConsole } from "@/components/journey-console";
import { getJourneyBundleById } from "@/lib/journey-data";
import { createClient } from "@/lib/supabase/server";

export default async function JourneyPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`/login?next=/journeys/${journeyId}`);
  const bundle = await getJourneyBundleById(journeyId);
  if (!bundle) notFound();
  return <><div className="journey-brand-bar"><Link href="/"><span><Compass size={18} /></span>悠程 AI</Link><Link href="/journeys"><ArrowLeft size={14} />全部旅行</Link></div><JourneyConsole journey={bundle.journey} stops={bundle.stops} entries={bundle.entries} /></>;
}

