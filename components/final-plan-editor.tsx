"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, LoaderCircle, MapPin, Plus, Route, Sparkles, Trash2 } from "lucide-react";
import { finalPlanSchema, type FinalPlan } from "@/lib/journey-types";

type Item = FinalPlan["days"][number]["items"][number];

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "请求失败，请稍后重试");
  return value;
}

export function FinalPlanEditor({ planId, initialPlan, initiallyFinalized }: { planId: number; initialPlan: FinalPlan; initiallyFinalized: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [request, setRequest] = useState(initialPlan.userRequest);
  const [finalized, setFinalized] = useState(initiallyFinalized);
  const [editing, setEditing] = useState(!initiallyFinalized);
  const [busy, setBusy] = useState<"" | "finalize" | "start">("");
  const [message, setMessage] = useState("");

  const updateDay = (dayIndex: number, update: Partial<FinalPlan["days"][number]>) => setPlan((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, ...update } : day) }));
  const updateItem = (dayIndex: number, itemIndex: number, update: Partial<Item>) => setPlan((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, items: day.items.map((item, position) => position === itemIndex ? { ...item, ...update } : item) } : day) }));
  const moveItem = (dayIndex: number, itemIndex: number, offset: -1 | 1) => setPlan((current) => ({ ...current, days: current.days.map((day, index) => { if (index !== dayIndex) return day; const items = [...day.items]; const target = itemIndex + offset; if (target < 0 || target >= items.length) return day; [items[itemIndex], items[target]] = [items[target], items[itemIndex]]; return { ...day, items }; }) }));
  const addItem = (dayIndex: number) => updateDay(dayIndex, { items: [...plan.days[dayIndex].items, { spotId: `custom-${crypto.randomUUID()}`, placeName: "新地点", arrivalTime: "09:00", visitStartTime: "09:00", visitEndTime: "10:00", selected: true, transport: "", accommodation: "", budget: "", reminder: "", notes: "", routeFromPrevious: null }] });

  const finalize = async () => {
    setBusy("finalize"); setMessage("");
    try {
      const valid = finalPlanSchema.parse({ ...plan, userRequest: request });
      const result = await post<{ content: FinalPlan; source: string }>(`/api/plans/${planId}/finalize`, { content: valid, userRequest: request, selectedSpotIds: valid.days.flatMap((day) => day.items.filter((item) => item.selected).map((item) => item.spotId)) });
      setPlan(result.content); setFinalized(true); setEditing(false);
      setMessage(result.source === "deepseek" ? "AI 已补充细节并生成最终版本" : "最终版本已保存"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "生成最终版本失败"); }
    finally { setBusy(""); }
  };

  const start = async () => {
    setBusy("start"); setMessage("");
    try {
      const result = await post<{ journey: { id: string } }>("/api/journeys", { sourceTripId: planId, themeKey: "cute" });
      router.push(`/journeys/${result.journey.id}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "开始旅行失败"); setBusy(""); }
  };

  return <section className="final-plan-editor" id="final-plan">
    <header><div><p>FINAL PLAN · 2.0</p><h2>完善最终旅行计划</h2><span>选择重点、补充细节，再将规划变成旅途中可记录的路线。</span></div><div>{finalized && !editing && <button className="secondary-plan-action" onClick={() => setEditing(true)}>解锁修改</button>}<button className="start-journey-button" disabled={!finalized || busy !== ""} onClick={() => void start()}>{busy === "start" ? <LoaderCircle className="spin" size={15} /> : <Route size={15} />}开始旅行</button></div></header>
    {message && <div className="final-plan-message" role="status">{message}</div>}
    <div className="final-plan-request"><Sparkles size={18} /><label><b>让 AI 重点完善</b><textarea disabled={!editing} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="例如：补充带父母出行的休息提醒、酒店衔接和每日预算" /></label><button disabled={!editing || busy !== ""} onClick={() => void finalize()}>{busy === "finalize" ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{finalized ? "重新生成最终版" : "生成最终版本"}</button></div>
    <div className="final-plan-days">{plan.days.map((day, dayIndex) => <article key={`${day.date}-${dayIndex}`}><header><span>D{dayIndex + 1}</span><label>日期<input type="date" disabled={!editing} value={day.date} onChange={(event) => updateDay(dayIndex, { date: event.target.value })} /></label><label>当天主题<input disabled={!editing} value={day.theme} onChange={(event) => updateDay(dayIndex, { theme: event.target.value })} /></label>{editing && <button onClick={() => addItem(dayIndex)}><Plus size={13} />地点</button>}</header>
      <label className="day-notes">当天备注<textarea disabled={!editing} value={day.notes} onChange={(event) => updateDay(dayIndex, { notes: event.target.value })} placeholder="住宿、节奏或同行人需要注意的事情" /></label>
      <div>{day.items.map((item, itemIndex) => <section className={item.selected ? "selected" : "muted"} key={`${item.spotId}-${itemIndex}`}><div className="final-item-main"><label className="item-check"><input type="checkbox" disabled={!editing} checked={item.selected} onChange={(event) => updateItem(dayIndex, itemIndex, { selected: event.target.checked })} /><span><MapPin size={14} /></span></label><label>地点<input disabled={!editing} value={item.placeName} onChange={(event) => updateItem(dayIndex, itemIndex, { placeName: event.target.value })} /></label><label>到达<input type="time" disabled={!editing} value={item.arrivalTime} onChange={(event) => updateItem(dayIndex, itemIndex, { arrivalTime: event.target.value, visitStartTime: event.target.value })} /></label><label>离开<input type="time" disabled={!editing} value={item.visitEndTime} onChange={(event) => updateItem(dayIndex, itemIndex, { visitEndTime: event.target.value })} /></label>{editing && <div className="item-order"><button onClick={() => moveItem(dayIndex, itemIndex, -1)} disabled={itemIndex === 0}><ArrowUp size={12} /></button><button onClick={() => moveItem(dayIndex, itemIndex, 1)} disabled={itemIndex === day.items.length - 1}><ArrowDown size={12} /></button><button onClick={() => updateDay(dayIndex, { items: day.items.filter((_, index) => index !== itemIndex) })}><Trash2 size={12} /></button></div>}</div>
        <div className="final-item-details"><label>交通<input disabled={!editing} value={item.transport} onChange={(event) => updateItem(dayIndex, itemIndex, { transport: event.target.value })} /></label><label>住宿<input disabled={!editing} value={item.accommodation} onChange={(event) => updateItem(dayIndex, itemIndex, { accommodation: event.target.value })} /></label><label>预算<input disabled={!editing} value={item.budget} onChange={(event) => updateItem(dayIndex, itemIndex, { budget: event.target.value })} /></label><label>提醒<input disabled={!editing} value={item.reminder} onChange={(event) => updateItem(dayIndex, itemIndex, { reminder: event.target.value })} /></label><label className="wide">个人备注<textarea disabled={!editing} value={item.notes} onChange={(event) => updateItem(dayIndex, itemIndex, { notes: event.target.value })} /></label></div>
      </section>)}</div></article>)}</div>
    <footer><span>{finalized ? <><Check size={14} />已有最终版本，可开始旅行</> : "请先确认内容并生成最终版本"}</span><button disabled={!editing || busy !== ""} onClick={() => void finalize()}>{busy === "finalize" ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}保存最终版本</button></footer>
  </section>;
}
