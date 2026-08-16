"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bus, Car, LoaderCircle, MapPinned, X } from "lucide-react";
import { HOTEL_ORIGIN_ID, type ItineraryDay, type ScenicSpot } from "@/lib/types";

type RouteMapInstance = {
  add(object: unknown | unknown[]): void;
  destroy(): void;
  setFitView(objects?: unknown[], immediately?: boolean, avoid?: number[]): void;
};

type RouteAMap = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => RouteMapInstance;
  Marker: new (options: Record<string, unknown>) => unknown;
  Polyline: new (options: Record<string, unknown>) => unknown;
};

type RouteWindow = Window & typeof globalThis & {
  AMap?: unknown;
  _AMapSecurityConfig?: { serviceHost: string };
  __amapRouteReady?: () => void;
};

let routeMapLoader: Promise<RouteAMap> | null = null;

function loadRouteMap(apiKey: string): Promise<RouteAMap> {
  const routeWindow = window as RouteWindow;
  if (routeWindow.AMap) return Promise.resolve(routeWindow.AMap as unknown as RouteAMap);
  if (routeMapLoader) return routeMapLoader;
  routeMapLoader = new Promise((resolve, reject) => {
    routeWindow._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` };
    routeWindow.__amapRouteReady = () => {
      if (!routeWindow.AMap) {
        routeMapLoader = null;
        reject(new Error("高德地图脚本加载异常"));
        return;
      }
      resolve(routeWindow.AMap as unknown as RouteAMap);
      delete routeWindow.__amapRouteReady;
    };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&callback=__amapRouteReady`;
    script.async = true;
    script.onerror = () => {
      routeMapLoader = null;
      delete routeWindow.__amapRouteReady;
      reject(new Error("高德地图加载失败，请检查网络和 JS API Key"));
    };
    document.head.appendChild(script);
  });
  return routeMapLoader;
}

function routeLabel(mode: string) {
  return mode === "driving" ? "自驾" : "公共交通";
}

interface ItineraryRouteMapProps {
  apiKey: string;
  days: ItineraryDay[];
  spots: ScenicSpot[];
  hotel: string;
  startFromHotel: boolean;
  onClose: () => void;
}

export function ItineraryRouteMap({ apiKey, days, spots, hotel, startFromHotel, onClose }: ItineraryRouteMapProps) {
  const [selectedDate, setSelectedDate] = useState(days[0]?.date ?? "");
  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [error, setError] = useState(apiKey ? "" : "高德地图尚未配置，无法展示真实路线。");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<RouteMapInstance | null>(null);
  const spotMap = useMemo(() => new Map(spots.map((spot) => [spot.id, spot])), [spots]);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];
  const routes = useMemo(() => selectedDay?.items.flatMap((item) => item.routeFromPrevious ? [item.routeFromPrevious] : []) ?? [], [selectedDay]);
  const drawableRoutes = useMemo(() => routes.filter((route) => route.source === "amap-api" && (route.polyline?.length ?? 0) > 1), [routes]);
  const hotelRoute = startFromHotel ? routes.find((route) => route.originSpotId === HOTEL_ORIGIN_ID) : undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!apiKey || !mapContainerRef.current || !selectedDay) return;
    let cancelled = false;
    setIsLoading(true);
    setError("");
    void loadRouteMap(apiKey).then((AMap) => {
      if (cancelled || !mapContainerRef.current) return;
      const map = new AMap.Map(mapContainerRef.current, { zoom: 12, viewMode: "2D", resizeEnable: true });
      mapRef.current = map;
      const overlays: unknown[] = [];
      const hotelPoint = hotelRoute?.polyline[0];
      if (hotelPoint) {
        overlays.push(new AMap.Marker({
          position: [hotelPoint.longitude, hotelPoint.latitude],
          title: `入住酒店：${hotel}`,
          label: { content: `酒店 · ${hotel}`, direction: "top" },
        }));
      }
      selectedDay.items.forEach((item, index) => {
        const spot = spotMap.get(item.spotId);
        if (!spot) return;
        const marker = new AMap.Marker({
          position: [spot.location.longitude, spot.location.latitude],
          title: `${index + 1}. ${spot.name}`,
          label: { content: `${index + 1}. ${spot.name}`, direction: "top" },
        });
        overlays.push(marker);
      });
      drawableRoutes.forEach((route) => {
        const line = new AMap.Polyline({
          path: route.polyline.map((point) => [point.longitude, point.latitude]),
          strokeColor: route.mode === "driving" ? "#e8793e" : "#13836f",
          strokeWeight: 7,
          strokeOpacity: 0.9,
          lineJoin: "round",
          showDir: true,
        });
        overlays.push(line);
      });
      map.add(overlays);
      if (overlays.length) map.setFitView(overlays, false, [70, 70, 70, 70]);
      setIsLoading(false);
      if (routes.length > 0 && drawableRoutes.length === 0) {
        setError("当前路线没有可绘制的高德轨迹数据，仅展示景点位置和路线文字信息。");
      }
    }).catch((loadError) => {
      if (!cancelled) {
        setIsLoading(false);
        setError(loadError instanceof Error ? loadError.message : "高德地图加载失败");
      }
    });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [apiKey, drawableRoutes, hotel, hotelRoute, routes.length, selectedDay, spotMap]);

  return <div className="route-map-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="route-map-modal" role="dialog" aria-modal="true" aria-labelledby="route-map-title">
      <header>
        <div><span><MapPinned size={15} />高德地图真实路线</span><h2 id="route-map-title">每日交通路线</h2><p>路线轨迹、距离与耗时均来自高德 API，AI 只负责安排游玩顺序。</p></div>
        <button ref={closeRef} onClick={onClose} aria-label="关闭交通路线地图"><X size={20} /></button>
      </header>
      <nav aria-label="选择行程日期">{days.map((day, index) => <button key={day.date} className={day.date === selectedDay?.date ? "active" : ""} onClick={() => setSelectedDate(day.date)}>第 {index + 1} 天<small>{day.date.slice(5).replace("-", "/")}</small></button>)}</nav>
      <div className="route-map-layout">
        <div className="route-map-canvas-wrap">
          <div ref={mapContainerRef} className="route-map-canvas" aria-label="高德交通路线地图" />
          {isLoading && <div className="route-map-loading"><LoaderCircle size={22} />正在加载高德地图路线…</div>}
          {!apiKey && <div className="route-map-loading"><MapPinned size={24} />{error}</div>}
        </div>
        <aside>
          <h3>{selectedDay?.theme || "当日路线"}</h3>
          {selectedDay?.items.length ? <ol>{hotelRoute && <li className="hotel-origin"><span>H</span><div><b>{hotel || "入住酒店"}</b><small>每日行程起点</small></div></li>}{selectedDay.items.map((item, index) => <li key={item.spotId}><span>{index + 1}</span><div><b>{spotMap.get(item.spotId)?.name ?? item.spotId}</b><small>{item.arrivalTime}—{item.visitEndTime}</small></div></li>)}</ol> : <p className="route-map-empty">当天暂无景点安排，也没有需要展示的交通路线。</p>}
          {routes.map((route, index) => <div className="route-map-segment" key={`${route.originSpotId}-${route.destinationSpotId}-${index}`}>{route.mode === "driving" ? <Car size={15} /> : <Bus size={15} />}<div><b>{routeLabel(route.mode)} · {route.durationMinutes ?? "暂无"} 分钟</b><small>{route.distanceMeters !== null ? `${(route.distanceMeters / 1000).toFixed(1)} km` : "距离暂无数据"} · {route.summary ?? "路线摘要暂无数据"}</small></div></div>)}
          {error && apiKey && <p className="route-map-warning">{error}</p>}
        </aside>
      </div>
    </section>
  </div>;
}
