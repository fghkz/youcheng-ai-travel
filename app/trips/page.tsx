import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Compass, Route } from "lucide-react";
import { TripList } from "@/components/trip-list";
import { createClient } from "@/lib/supabase/server";

export default async function TripsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login?next=/trips");

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id,title,destination,start_date,end_date,pace,transport_preference,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <main className="trips-page">
      <header className="trips-nav">
        <Link href="/"><span><Compass size={19} /></span>悠程 AI</Link>
        <Link href="/"><ArrowLeft size={14} />返回规划</Link>
      </header>
      <section className="trips-shell">
        <p className="eyebrow">MY JOURNEYS</p>
        <h1>我的行程</h1>
        <p>这里保存你已经确认的旅行条件、景点快照和 AI 行程版本。</p>
        {error && <div className="trips-error">暂时无法读取行程：{error.message}</div>}
        {!error && trips?.length === 0 && <div className="trips-empty"><Route size={28} /><h2>还没有保存的行程</h2><p>完成一次规划后，点击“保存行程”就会出现在这里。</p><Link href="/">开始规划</Link></div>}
        {trips && trips.length > 0 && <TripList initialTrips={trips.map((trip) => ({ id: trip.id, title: trip.title, destination: trip.destination, startDate: trip.start_date, endDate: trip.end_date, pace: trip.pace, transportPreference: trip.transport_preference }))} />}
      </section>
    </main>
  );
}
