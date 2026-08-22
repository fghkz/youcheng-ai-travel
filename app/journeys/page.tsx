import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Compass, MapPin, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { themeMeta, type ThemeKey } from "@/lib/journey-types";

export default async function JourneysPage() {
  const typed = await createClient();
  const { data: claims } = await typed.auth.getClaims();
  if (!claims?.claims) redirect("/login?next=/journeys");
  const supabase = typed;
  const { data: journeys, error } = await supabase.from("travel_journeys")
    .select("id,title,summary,status,visibility,theme_key,slug,planned_start_date,planned_end_date,published_at,updated_at")
    .order("updated_at", { ascending: false }).limit(50);
  return <main className="journeys-page"><header className="trips-nav"><Link href="/"><span><Compass size={19} /></span>悠程 AI</Link><Link href="/trips"><ArrowLeft size={14} />我的规划</Link></header>
    <section className="journeys-shell"><div className="journeys-heading"><div><p>MY LIVE JOURNEYS</p><h1>我的旅行记录</h1><span>从最终规划出发，把每一站的照片和心情留在这里。</span></div><Link href="/trips"><Plus size={15} />从规划开始旅行</Link></div>
    {error && <div className="trips-error">暂时无法读取旅行：{error.message}</div>}
    {!error && (journeys ?? []).length === 0 && <div className="journeys-empty"><Sparkles size={28} /><h2>还没有开始旅行</h2><p>从一份已保存的规划生成最终版本，然后点击“开始旅行”。</p><Link href="/trips">选择已有规划</Link></div>}
    <div className="journey-card-grid">{(journeys ?? []).map((journey) => <article className="journey-card" key={journey.id} data-theme={journey.theme_key}><div className="journey-card-art"><i /><i /></div><div className="journey-card-body"><h2>{journey.title}</h2><p>{journey.summary || "故事正在路上，等待你的第一笔记录。"}</p><dl><div><dt><CalendarDays size={12} />日期</dt><dd>{journey.planned_start_date} — {journey.planned_end_date}</dd></div><div><dt><MapPin size={12} />主题</dt><dd>{themeMeta[journey.theme_key as ThemeKey]?.name}</dd></div></dl><footer><Link href={`/journeys/${journey.id}`}>继续记录</Link>{journey.published_at && <Link href={`/j/${journey.slug}`} target="_blank">公开页</Link>}</footer></div></article>)}</div></section>
  </main>;
}




