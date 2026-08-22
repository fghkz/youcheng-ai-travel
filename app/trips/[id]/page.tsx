import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, BedDouble, Bus, Car, Compass, MapPin, Route, Sparkles, Utensils } from "lucide-react";
import { SavedItineraryRouteMap } from "@/components/saved-itinerary-route-map";
import { FinalPlanEditor } from "@/components/final-plan-editor";
import { itineraryResultSchema, scenicSpotSchema } from "@/lib/schemas";
import { finalPlanSchema } from "@/lib/journey-types";
import { buildBaseFinalPlan } from "@/lib/services/journal";
import { createClient } from "@/lib/supabase/server";
import type { ItineraryDay, ScenicSpot } from "@/lib/types";

const paceLabels: Record<string, string> = { leisurely: "悠闲", comfortable: "舒适", compact: "紧凑" };
const transportLabels: Record<string, string> = { transit: "公共交通", driving: "自驾", either: "两种均可" };

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日 · ${weekday}`;
}

function MealBreak({ mealBreak }: { mealBreak: NonNullable<ItineraryDay["mealBreak"]> }) {
  return <div className="meal-row"><time>{mealBreak.startTime}<small>至 {mealBreak.endTime}</small></time><i /><div><Utensils size={14} /><span><b>{mealBreak.label}</b><small>已预留 {mealBreak.durationMinutes / 60} 小时，可根据附近餐厅灵活调整</small></span></div></div>;
}

export default async function TripDetailPage({ params }: PageProps<"/trips/[id]">) {
  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) notFound();
  const tripId = Number(rawId);
  if (!Number.isSafeInteger(tripId) || tripId < 1) notFound();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect(`/login?next=/trips/${tripId}`);

  const [tripQuery, versionQuery, spotsQuery] = await Promise.all([
    supabase.from("trips").select("id,title,destination,hotel,start_from_hotel,start_date,end_date,daily_start_time,daily_end_time,pace,transport_preference,status,final_content,version").eq("id", tripId).maybeSingle(),
    supabase.from("itinerary_versions").select("version_no,itinerary_result,model_provider,model_name,created_at").eq("trip_id", tripId).eq("is_current", true).maybeSingle(),
    supabase.from("trip_spots").select("external_spot_id,spot_snapshot,selected_order").eq("trip_id", tripId).order("selected_order"),
  ]);

  if (tripQuery.error || !tripQuery.data) notFound();
  const trip = tripQuery.data;
  const parsedItinerary = itineraryResultSchema.safeParse(versionQuery.data?.itinerary_result);
  const itinerary = parsedItinerary.success ? parsedItinerary.data : null;
  const spotMap = new Map<string, ScenicSpot>();
  for (const row of spotsQuery.data ?? []) {
    const parsedSpot = scenicSpotSchema.safeParse(row.spot_snapshot);
    if (parsedSpot.success) spotMap.set(row.external_spot_id, parsedSpot.data);
  }
  const arrangedCount = itinerary?.days.reduce((sum, day) => sum + day.items.length, 0) ?? 0;
  const routeCount = itinerary?.days.reduce((sum, day) => sum + day.items.filter((item) => item.routeFromPrevious).length, 0) ?? 0;
  const spots = [...spotMap.values()];
  const parsedFinalPlan = finalPlanSchema.safeParse(trip.final_content);
  const finalPlan = parsedFinalPlan.success
    ? parsedFinalPlan.data
    : itinerary ? buildBaseFinalPlan(itinerary, spotsQuery.data ?? []) : null;

  return <main className="trip-detail-page">
    <header className="trips-nav"><Link href="/"><span><Compass size={19} /></span>悠程 AI</Link><Link href="/trips"><ArrowLeft size={14} />返回我的行程</Link></header>
    <section className="trip-detail-shell">
      <div className="trip-detail-hero"><div><p className="eyebrow">SAVED ITINERARY</p><h1>{trip.title}</h1><p><MapPin size={13} />{trip.destination} · {trip.start_date} 至 {trip.end_date}</p></div>{versionQuery.data && <span>AI 规划 V{versionQuery.data.version_no}</span>}</div>
      <div className="result-shell">
        <div className="result-header"><div><span className="spark"><Sparkles size={19} /></span><span><h2>具体行程规划</h2><p>{itinerary ? `${arrangedCount} 个景点 · ${routeCount} 段交通路线` : "当前行程尚无可用的规划版本"}</p></span></div></div>
        <div className="stats trip-detail-stats"><div><small>旅行日期</small><b>{trip.start_date}<em>起</em></b></div><div><small>每日时间</small><b>{trip.daily_start_time.slice(0, 5)}<em>— {trip.daily_end_time.slice(0, 5)}</em></b></div><div><small>游玩节奏</small><b>{paceLabels[trip.pace] ?? trip.pace}</b></div><div><small>出行方式</small><b>{transportLabels[trip.transport_preference] ?? trip.transport_preference}</b></div></div>
        {!itinerary ? <div className="trip-plan-empty"><Route size={27} /><h3>暂时无法展示具体规划</h3><p>{versionQuery.error ? "读取 AI 规划版本失败，请稍后重试。" : "该行程还没有保存成功的 AI 规划版本。"}</p><Link href="/">重新规划</Link></div> : <div className="result-grid"><div className="days">{itinerary.days.map((day, dayIndex) => <article className="day-card" key={day.date}>
          <header><span>D{dayIndex + 1}</span><div><h3>{formatDate(day.date)}</h3><p>{day.theme}</p></div><small>{day.items.length} 个景点</small></header>
          <div className="timeline">{day.items.length ? <>{day.mealBreak && day.items[0].arrivalTime >= day.mealBreak.endTime && <MealBreak mealBreak={day.mealBreak} />}{day.items.map((item, itemIndex) => {
            const spot = spotMap.get(item.spotId);
            const nextItem = day.items[itemIndex + 1];
            const showMealAfter = day.mealBreak && item.visitEndTime <= day.mealBreak.startTime && (!nextItem || nextItem.arrivalTime >= day.mealBreak.endTime);
            const route = item.routeFromPrevious;
            return <div key={`${day.date}-${item.spotId}-${itemIndex}`}>{route && <div className="route-row"><span /><i /><div>{route.mode === "driving" ? <Car size={13} /> : <Bus size={13} />}<b>{itemIndex === 0 && trip.start_from_hotel ? "酒店出发 · " : ""}{route.mode === "driving" ? "自驾" : "公共交通"}</b><span>{route.durationMinutes ? `${route.durationMinutes} 分钟` : "耗时暂无"} · {route.distanceMeters ? `${(route.distanceMeters / 1000).toFixed(1)} km` : "距离暂无"}</span></div></div>}<div className="timeline-item"><time>{item.arrivalTime}<small>至 {item.visitEndTime}</small></time><i /><div><div><h4>{spot?.name ?? item.spotId}</h4><b>建议游玩 {Math.round(item.suggestedVisitMinutes / 30) / 2} 小时</b></div><p>{spot?.shortDescription ?? spot?.description ?? "暂无景点简介"}</p>{item.visitDurationSource === "ai-suggestion" && <span className="source">AI 规划建议</span>}</div></div>{showMealAfter && <MealBreak mealBreak={day.mealBreak!} />}</div>;
          })}</> : <p className="day-empty">当天暂无可执行安排</p>}</div>
        </article>)}</div>
          <aside>
            <section><h3><Sparkles size={15} />规划说明</h3><div className="tip green">交通耗时、景点游玩和午餐休息均已计入每日时间线。</div>{itinerary.warnings.map((warning) => <div className="tip orange" key={warning}>{warning}</div>)}</section>
            {trip.start_from_hotel && <section><h3><BedDouble size={15} />酒店出发</h3><p className="trip-aside-copy">{trip.hotel || "已启用酒店出发，但未保存酒店地址"}</p></section>}
            <SavedItineraryRouteMap
              apiKey={process.env.AMAP_JS_API_KEY ?? ""}
              days={itinerary.days}
              spots={spots}
              hotel={trip.hotel}
              startFromHotel={trip.start_from_hotel}
            />
            {itinerary.unscheduledSpots.length > 0 && <section className="unscheduled"><h3><AlertTriangle size={15} />未安排景点</h3>{itinerary.unscheduledSpots.map((item) => <div key={item.spotId}><b>{spotMap.get(item.spotId)?.name ?? item.spotId}</b><p>{item.message}</p></div>)}</section>}
          </aside>
        </div>}
      </div>
      {finalPlan && <FinalPlanEditor planId={tripId} initialPlan={finalPlan} initiallyFinalized={trip.status === "finalized"} />}
    </section>
  </main>;
}
