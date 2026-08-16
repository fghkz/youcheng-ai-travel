"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LoaderCircle, MapPin, Trash2 } from "lucide-react";

export interface TripListItem {
  id: number;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  pace: string;
  transportPreference: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00+08:00`));
}

export function TripList({ initialTrips }: { initialTrips: TripListItem[] }) {
  const [trips, setTrips] = useState(initialTrips);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const deleteTrip = async (trip: TripListItem) => {
    setDeletingId(trip.id);
    setError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "删除行程失败");
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setConfirmingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除行程失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  };

  return <>
    {error && <div className="trips-error" role="alert">{error}</div>}
    <div className="trip-list">{trips.map((trip) => <article className="trip-card" key={trip.id}>
      <Link className="trip-card-main" href={`/trips/${trip.id}`} aria-label={`查看${trip.title}的具体规划`}>
        <div><span><MapPin size={15} /></span><div><h2>{trip.title}</h2><p>{trip.destination}</p></div></div>
        <dl><div><dt><CalendarDays size={13} />日期</dt><dd>{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</dd></div><div><dt>节奏</dt><dd>{trip.pace === "leisurely" ? "悠闲" : trip.pace === "compact" ? "紧凑" : "舒适"}</dd></div><div><dt>交通</dt><dd>{trip.transportPreference === "transit" ? "公共交通" : trip.transportPreference === "driving" ? "自驾" : "两种均可"}</dd></div></dl>
      </Link>
      <div className="trip-card-actions"><Link href={`/trips/${trip.id}`}>查看具体规划 →</Link>{confirmingId === trip.id ? <span><button type="button" className="trip-delete-cancel" onClick={() => setConfirmingId(null)} disabled={deletingId === trip.id}>取消</button><button type="button" className="trip-delete-confirm" onClick={() => void deleteTrip(trip)} disabled={deletingId === trip.id}>{deletingId === trip.id ? <LoaderCircle className="spin" size={13} /> : <Trash2 size={13} />}确认删除</button></span> : <button type="button" className="trip-delete" onClick={() => setConfirmingId(trip.id)}><Trash2 size={13} />删除行程</button>}</div>
    </article>)}</div>
    {trips.length === 0 && initialTrips.length > 0 && <div className="trips-empty trip-list-cleared"><Trash2 size={27} /><h2>已删除全部行程</h2><p>你可以回到首页创建一份新的旅行规划。</p><Link href="/">开始规划</Link></div>}
  </>;
}
