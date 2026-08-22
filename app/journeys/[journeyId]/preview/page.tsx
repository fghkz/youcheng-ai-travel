import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3 } from "lucide-react";
import { JourneyJournal } from "@/components/journey-journal";
import { PrintOnLoad } from "@/components/print-on-load";
import { getJourneyBundleById } from "@/lib/journey-data";
import { createClient } from "@/lib/supabase/server";

export default async function JourneyPreviewPage({ params, searchParams }: { params: Promise<{ journeyId: string }>; searchParams: Promise<{ print?: string }> }) {
  const { journeyId } = await params;
  const printMode = (await searchParams).print === "1";
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`/login?next=/journeys/${journeyId}/preview`);
  const bundle = await getJourneyBundleById(journeyId);
  if (!bundle) notFound();
  return <main className={`journal-preview-page${printMode ? " print-mode" : ""}`}>{printMode ? <PrintOnLoad /> : <nav><Link href={`/journeys/${journeyId}/edit`}><ArrowLeft size={14} />返回编辑</Link><span>私密预览 · 只有你可见</span><Link href={`/journeys/${journeyId}/edit`}><Edit3 size={14} />继续编辑</Link></nav>}<JourneyJournal journey={bundle.journey} stops={bundle.stops} entries={bundle.entries} media={bundle.media} document={bundle.document} preview /></main>;
}


