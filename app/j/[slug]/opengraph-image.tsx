import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPublishedJourneyBySlug } from "@/lib/journey-data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = await getPublishedJourneyBySlug(slug);
  if (!bundle) notFound();
  const colors: Record<string, [string, string, string]> = {
    cute: ["#fff4ed", "#ef7f83", "#285f58"], nostalgic: ["#e9dcc4", "#79553b", "#3f3025"],
    joyful: ["#fff8d7", "#ff6b35", "#007f73"], elegant: ["#f6f1e8", "#295d55", "#b68b6c"],
  };
  const [background, accent, ink] = colors[bundle.journey.theme_key] ?? colors.cute;
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px 84px", background, color: ink, fontFamily: "serif" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: accent }}><span>✦</span><span>悠程 · 在线旅行记录</span></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}><div style={{ fontSize: 78, fontWeight: 700, letterSpacing: "-2px", maxWidth: 1000 }}>{bundle.journey.title}</div><div style={{ fontSize: 28, opacity: .72 }}>{bundle.journey.planned_start_date} — {bundle.journey.planned_end_date}</div></div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}><span>{bundle.stops.slice(0, 3).map((stop) => stop.place_name).join(" · ")}</span><span style={{ color: accent }}>YOUR JOURNEY</span></div>
  </div>, size);
}

