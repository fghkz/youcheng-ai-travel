"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BedDouble, Bot, Bus, CalendarDays, Car, Check, Clock3, Compass, MapPin, MapPinned, RefreshCw, Route, Save, Sparkles, Utensils } from "lucide-react";
import { AccountNav, type Viewer } from "@/components/account-nav";
import { ScenicBrowser } from "@/components/scenic-browser";
import { DestinationMapPicker } from "@/components/destination-map-picker";
import { ItineraryRouteMap } from "@/components/itinerary-route-map";
import type { ApiErrorResponse, ItineraryDay, ItineraryResponse, SaveTripResponse, ScenicSpot, ScenicSpotsResponse, TransportPreference, TravelPace, TripPreferences } from "@/lib/types";

const initialPreferences: TripPreferences = {
  destination: "杭州",
  hotel: "",
  startFromHotel: false,
  startDate: "2026-10-02",
  endDate: "2026-10-04",
  dailyStartTime: "09:00",
  dailyEndTime: "18:00",
  transportPreference: "either",
  pace: "comfortable",
};

const transportLabels: Record<TransportPreference, string> = { transit: "公共交通", driving: "自驾", either: "两种均可" };
const paceLabels: Record<TravelPace, string> = { leisurely: "悠闲", comfortable: "舒适", compact: "紧凑" };
const paceHeadlines: Record<TravelPace, string> = {
  leisurely: "一份慢慢走、自在逛的",
  comfortable: "一份张弛有度、从容好走的",
  compact: "一份紧凑高效、衔接顺畅的",
};
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as T | ApiErrorResponse;
  if (!response.ok || "error" in (data as ApiErrorResponse)) throw new Error((data as ApiErrorResponse).error?.message ?? "请求失败，请稍后重试");
  return data as T;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日 · ${weekday}`;
}

function modeLabel(mode: string) { return mode === "driving" ? "自驾" : "公共交通"; }

function tripDayCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.floor((end - start) / 86_400_000) + 1
    : 0;
}

function MealBreakRow({ mealBreak }: { mealBreak: NonNullable<ItineraryDay["mealBreak"]> }) {
  return <div className="meal-row"><time>{mealBreak.startTime}<small>至 {mealBreak.endTime}</small></time><i /><div><Utensils size={14} /><span><b>{mealBreak.label}</b><small>已预留 {mealBreak.durationMinutes / 60} 小时，可根据附近餐厅灵活调整</small></span></div></div>;
}

export function TravelPlanner({ amapJsApiKey, viewer }: { amapJsApiKey: string; viewer: Viewer | null }) {
  const router = useRouter();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selectedSpots, setSelectedSpots] = useState<ScenicSpot[]>([]);
  const [knownSpots, setKnownSpots] = useState<ScenicSpot[]>([]);
  const [browseRequestVersion, setBrowseRequestVersion] = useState(0);
  const [scenicMeta, setScenicMeta] = useState<ScenicSpotsResponse | null>(null);
  const [result, setResult] = useState<ItineraryResponse | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [stage, setStage] = useState<"idle" | "spots" | "routes" | "planning">("idle");
  const [error, setError] = useState("");
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedTripId, setSavedTripId] = useState<number | null>(null);
  const spotMap = useMemo(() => new Map(knownSpots.map((spot) => [spot.id, spot])), [knownSpots]);
  const plannedDayCount = tripDayCount(preferences.startDate, preferences.endDate);

  const searchSpots = () => {
    setError("");
    if (!preferences.destination.trim()) { setError("请输入目的地"); return; }
    setBrowseRequestVersion((current) => current + 1);
  };

  const changePreference = <K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    if (result) setIsStale(true);
  };

  const generate = async (spots = selectedSpots) => {
    setError("");
    if (!spots.length) { setError("请至少选择一个景点"); return; }
    if (preferences.startFromHotel && !preferences.hotel.trim()) { setError("选择从酒店出发时，请先填写入住酒店"); return; }
    if (preferences.endDate < preferences.startDate) { setError("结束日期不能早于开始日期"); return; }
    if (preferences.dailyEndTime <= preferences.dailyStartTime) { setError("每日结束时间必须晚于开始时间"); return; }
    setStage("routes");
    window.setTimeout(() => setStage((current) => current === "routes" ? "planning" : current), 700);
    try {
      setSelectedSpots(spots);
      const data = await postJson<ItineraryResponse>("/api/itinerary", { preferences, spots });
      setResult(data);
      setIsStale(false);
      setSaveState("idle");
      setSavedTripId(null);
      window.setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "行程生成失败"); }
    finally { setStage("idle"); }
  };

  const saveTrip = async () => {
    if (!viewer) {
      router.push("/login?next=/%23result");
      return;
    }
    if (!result || isStale) {
      setError("请先生成最新行程后再保存");
      return;
    }
    setSaveState("saving");
    setError("");
    try {
      const data = await postJson<SaveTripResponse>("/api/trips", { preferences, spots: selectedSpots, result });
      setSavedTripId(data.trip.id);
      setSaveState("saved");
    } catch (saveError) {
      setSaveState("idle");
      setError(saveError instanceof Error ? saveError.message : "保存行程失败");
    }
  };

  const fallbackNotices = [...(scenicMeta?.fallbackNotices ?? []), ...(result?.fallbackNotices ?? [])];

  return (
    <>
      <div className="demo-strip">演示版本 · 页面中的演示景点和路线不可作为真实出行依据</div>
      <header className="nav container">
        <div className="brand"><span className="brand-mark"><Compass size={21} /></span><span>悠程 AI<small>YOUR JOURNEY</small></span></div>
        <nav><a href="#planner">智能规划</a><a href="#spots">景点选择</a><a href="#result">行程安排</a></nav>
        <div className="nav-actions"><span className="ai-chip"><Sparkles size={13} /> AI 智能规划</span><AccountNav viewer={viewer} /></div>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy"><p className="eyebrow">为自由行而生的智能规划</p><h1>把想去的地方<br />变成<span>走得通</span>的旅程</h1><p>选好你喜欢的景点，剩下的交给 AI。结合开放时间、交通耗时和你的游玩节奏，为每一天找到更从容的顺序。</p><div className="hero-pills"><span>时间合理</span><span>路线可执行</span><span>随时重新规划</span></div></div>
          <div className="map-art" aria-hidden="true"><div className="lake" /><div className="route-loop" /><i className="pin one">1</i><i className="pin two">2</i><i className="pin three">3</i><div className="float-note top"><Sparkles size={16} /><span><b>杭州 · 3 日</b>6 个心仪景点</span></div><div className="float-note bottom"><Route size={16} /><span><b>路线已优化</b>兼顾时间与距离</span></div></div>
        </div>
      </section>

      <main>
        <section className="planner-card container" id="planner" aria-label="旅行条件">
          <label><span><MapPin size={14} />目的地</span><div className="destination-input"><input value={preferences.destination} onChange={(event) => changePreference("destination", event.target.value)} /><button type="button" onClick={() => setIsMapPickerOpen(true)} aria-label="在地图上选择目的地">地图选择</button></div></label>
          <label className="hotel-field"><span><BedDouble size={14} />入住酒店（选填）</span><input value={preferences.hotel} onChange={(event) => { changePreference("hotel", event.target.value); if (!event.target.value.trim()) changePreference("startFromHotel", false); }} placeholder="酒店名称或详细地址" /></label>
          <label><span><CalendarDays size={14} />开始日期</span><input type="date" value={preferences.startDate} onChange={(event) => changePreference("startDate", event.target.value)} /></label>
          <label><span><CalendarDays size={14} />结束日期</span><input type="date" value={preferences.endDate} onChange={(event) => changePreference("endDate", event.target.value)} /></label>
          <label><span><Clock3 size={14} />每日时间</span><div className="time-inputs"><input type="time" value={preferences.dailyStartTime} onChange={(event) => changePreference("dailyStartTime", event.target.value)} /><em>—</em><input type="time" value={preferences.dailyEndTime} onChange={(event) => changePreference("dailyEndTime", event.target.value)} /></div></label>
          <button className="primary" onClick={searchSpots} disabled={stage !== "idle"}>{stage === "spots" ? <><span className="spinner" />查询中</> : <>查询景点<ArrowRight size={16} /></>}</button>
          <fieldset><legend>出行方式</legend>{(["transit", "driving", "either"] as TransportPreference[]).map((mode) => <button key={mode} type="button" className={preferences.transportPreference === mode ? "active" : ""} onClick={() => changePreference("transportPreference", mode)}>{mode === "transit" ? <Bus size={14} /> : mode === "driving" ? <Car size={14} /> : <Route size={14} />}{transportLabels[mode]}</button>)}<button type="button" className={`hotel-start-toggle ${preferences.startFromHotel ? "active" : ""}`} disabled={!preferences.hotel.trim()} onClick={() => changePreference("startFromHotel", !preferences.startFromHotel)}><BedDouble size={14} />{preferences.startFromHotel ? "每天从酒店出发" : "从酒店出发"}</button></fieldset>
          <fieldset className="pace-fieldset"><legend>游玩节奏</legend>{(["leisurely", "comfortable", "compact"] as TravelPace[]).map((pace) => <button key={pace} type="button" className={preferences.pace === pace ? "active" : ""} onClick={() => changePreference("pace", pace)}><Clock3 size={14} />{paceLabels[pace]}</button>)}</fieldset>
        </section>

        <div className="container feedback" aria-live="polite">
          {error && <div className="error"><AlertTriangle size={16} />{error}<button onClick={() => setError("")}>关闭</button></div>}
          {fallbackNotices.length > 0 && <div className="demo-notice"><Bot size={17} /><div><strong>当前包含演示数据</strong>{fallbackNotices.map((notice, index) => <p key={`${notice}-${index}`}>{notice}</p>)}</div></div>}
        </div>

        <section className="content-section container" id="spots">
          <div className="section-head"><div><span>STEP 01 · PICK YOUR PLACES</span><h2>选择你心动的景点</h2></div><p>当前选择 <b>{selectedSpots.length} / 8</b>，可跨批次搜索和选择景点。</p></div>
          <ScenicBrowser
            viewer={viewer}
            destination={preferences.destination}
            requestVersion={browseRequestVersion}
            disabled={stage === "routes" || stage === "planning"}
            generationStage={stage}
            hasResult={Boolean(result)}
            onGenerate={(spots) => void generate(spots)}
            onSelectionChange={(spots) => { setSelectedSpots(spots); if (result) setIsStale(true); }}
            onCatalogChange={(spots) => setKnownSpots((current) => [...new Map([...current, ...spots].map((spot) => [spot.id, spot])).values()])}
            onMetaChange={setScenicMeta}
            onError={setError}
            onBrowseLoading={(loading) => setStage((current) => loading && current === "idle" ? "spots" : !loading && current === "spots" ? "idle" : current)}
            onDestinationReset={() => { setKnownSpots([]); setResult(null); setIsStale(false); }}
          />
        </section>

        {result && <section className="content-section container" id="result">
          <div className="section-head"><div><span>STEP 02 · YOUR ITINERARY</span><h2>{paceHeadlines[preferences.pace]}{preferences.destination}行程</h2></div><p>交通耗时已计入时间线，事实字段与 AI 建议分开展示。</p></div>
          <div className={`result-shell ${isStale ? "stale" : ""}`}>
            {isStale && <div className="stale-banner"><AlertTriangle size={15} />旅行条件或景点已改变，当前结果已过期，请重新生成。</div>}
            <div className="result-header"><div><span className="spark"><Sparkles size={19} /></span><span><h2>{preferences.destination} · {plannedDayCount} 日漫游计划</h2><p>本次规划结果 · {selectedSpots.length} 个已选景点</p></span></div><div className="result-actions"><button className="secondary" onClick={() => void generate()}><RefreshCw size={14} />重新生成</button>{saveState === "saved" && savedTripId ? <Link className="save-trip saved" href="/trips"><Check size={14} />已保存 · 查看</Link> : <button className="save-trip" onClick={() => void saveTrip()} disabled={saveState === "saving" || isStale}><Save size={14} />{saveState === "saving" ? "保存中" : viewer ? "保存行程" : "登录后保存"}</button>}</div></div>
            <div className="stats"><div><small>行程天数</small><b>{plannedDayCount}<em>天</em></b></div><div><small>已安排景点</small><b>{result.itinerary.days.reduce((sum, day) => sum + day.items.length, 0)}<em>个</em></b></div><div><small>未安排景点</small><b>{result.itinerary.unscheduledSpots.length}<em>个</em></b></div><div><small>每日节奏</small><b>{paceLabels[preferences.pace]}</b></div></div>
            <div className="result-grid"><div className="days">{result.itinerary.days.map((day, dayIndex) => <article className="day-card" key={day.date}><header><span>D{dayIndex + 1}</span><div><h3>{formatDate(day.date)}</h3><p>{day.theme}</p></div><small>{day.items.length} 个景点</small></header><div className="timeline">{day.items.length ? <>{day.mealBreak && day.items[0].arrivalTime >= day.mealBreak.endTime && <MealBreakRow mealBreak={day.mealBreak} />}{day.items.map((item, itemIndex) => {
                const spot = spotMap.get(item.spotId);
                const nextItem = day.items[itemIndex + 1];
                const showMealAfter = day.mealBreak && item.visitEndTime <= day.mealBreak.startTime && (!nextItem || nextItem.arrivalTime >= day.mealBreak.endTime);
                return <div key={item.spotId}>{item.routeFromPrevious && <div className="route-row"><span /><i /><div>{item.routeFromPrevious.mode === "driving" ? <Car size={13} /> : <Bus size={13} />}<b>{itemIndex === 0 && preferences.startFromHotel ? "酒店出发 · " : ""}{modeLabel(item.routeFromPrevious.mode)}</b><span>{item.routeFromPrevious.durationMinutes} 分钟 · {item.routeFromPrevious.distanceMeters ? `${(item.routeFromPrevious.distanceMeters / 1000).toFixed(1)} km` : "距离暂无"}</span></div></div>}<div className="timeline-item"><time>{item.arrivalTime}<small>至 {item.visitEndTime}</small></time><i /><div><div><h4>{spot?.name ?? item.spotId}</h4><b>建议游玩 {Math.round(item.suggestedVisitMinutes / 30) / 2} 小时</b></div><p>{spot?.shortDescription ?? spot?.description}</p>{item.visitDurationSource === "ai-suggestion" && <span className="source">AI 规划建议</span>}</div></div>{showMealAfter && <MealBreakRow mealBreak={day.mealBreak!} />}</div>;
              })}</> : <p className="day-empty">当天暂无可执行安排</p>}</div></article>)}</div>
              <aside><section><h3><Sparkles size={15} />规划说明</h3><div className="tip green">优先保证行程不超出每日可游玩时间，并将交通耗时计入时间线。</div>{result.itinerary.warnings.map((warning) => <div className="tip orange" key={warning}>{warning}</div>)}</section><section className="route-map-card"><h3><MapPinned size={15} />交通路线</h3><p>在高德地图中查看每天的景点顺序、真实路线、距离和预计耗时。</p><div><span>{result.itinerary.days.reduce((sum, day) => sum + day.items.filter((item) => item.routeFromPrevious).length, 0)} 段路线</span><span>{plannedDayCount} 天行程</span></div><button onClick={() => setIsRouteMapOpen(true)}><MapPinned size={14} />查看地图路线</button></section>{result.itinerary.unscheduledSpots.length > 0 && <section className="unscheduled"><h3><AlertTriangle size={15} />未安排景点</h3>{result.itinerary.unscheduledSpots.map((item) => <div key={item.spotId}><b>{spotMap.get(item.spotId)?.name ?? item.spotId}</b><p>{item.message}</p></div>)}</section>}<section><h3>调整行程</h3><div className="aside-actions"><button onClick={() => document.getElementById("spots")?.scrollIntoView({ behavior: "smooth" })}>增加景点</button><button onClick={() => void generate()}><RefreshCw size={13} />重新生成</button></div></section></aside>
            </div>
          </div>
        </section>}
      </main>

      {isMapPickerOpen && <DestinationMapPicker
        apiKey={amapJsApiKey}
        initialDestination={preferences.destination}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={(destination) => {
          changePreference("destination", destination);
          setBrowseRequestVersion((current) => current + 1);
          setIsMapPickerOpen(false);
          setError("");
        }}
      />}

      {isRouteMapOpen && result && <ItineraryRouteMap
        apiKey={amapJsApiKey}
        days={result.itinerary.days}
        spots={knownSpots}
        hotel={preferences.hotel}
        startFromHotel={preferences.startFromHotel}
        onClose={() => setIsRouteMapOpen(false)}
      />}

      <footer><div className="container"><div><strong>悠程 AI · 让每一段旅行更从容</strong><p>开放时间与票价可能变化，请在出行前核实官方信息。登录后可将规划安全保存到个人账号。</p></div><div><span>Supabase Auth</span><span>私人行程</span><span>MVP V0.2</span></div></div></footer>
    </>
  );
}
