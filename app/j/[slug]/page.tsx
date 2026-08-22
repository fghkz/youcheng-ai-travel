import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JourneyJournal } from "@/components/journey-journal";
import { getPublishedJourneyBySlug } from "@/lib/journey-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getPublishedJourneyBySlug(slug);
  if (!bundle) return { title: "旅行记录不存在", robots: { index: false, follow: false } };
  const description = bundle.journey.summary || `${bundle.journey.planned_start_date} 至 ${bundle.journey.planned_end_date} 的在线旅行记录`;
  return {
    title: `${bundle.journey.title} · 悠程旅行手记`, description,
    alternates: { canonical: `/j/${slug}` },
    openGraph: { type: "article", title: bundle.journey.title, description, url: `/j/${slug}`, images: [`/j/${slug}/opengraph-image`] },
    twitter: { card: "summary_large_image", title: bundle.journey.title, description, images: [`/j/${slug}/opengraph-image`] },
    robots: { index: true, follow: true },
  };
}

export default async function PublicJourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await getPublishedJourneyBySlug(slug);
  if (!bundle) notFound();
  return <main className="public-journal-page"><JourneyJournal journey={bundle.journey} stops={bundle.stops} entries={bundle.entries} media={bundle.media} document={bundle.document} /><footer className="public-journal-credit"><a href="/">用悠程 AI 规划我的下一次旅行</a></footer></main>;
}

