"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search, X } from "lucide-react";

type LngLatLike = {
  getLng(): number;
  getLat(): number;
};

type AMapMap = {
  addControl(control: unknown): void;
  destroy(): void;
  on(event: "click", handler: (event: { lnglat: LngLatLike }) => void): void;
  setCenter(position: [number, number]): void;
  setCity(city: string): void;
  setZoom(zoom: number): void;
};

type AMapMarker = {
  setMap(map: AMapMap | null): void;
  setPosition(position: [number, number]): void;
};

type AddressComponent = {
  province?: string;
  city?: string | string[];
  district?: string;
};

type GeocodeResult = {
  info?: string;
  geocodes?: Array<{ location?: LngLatLike }>;
  regeocode?: {
    formattedAddress?: string;
    addressComponent?: AddressComponent;
  };
};

type AMapGeocoder = {
  getAddress(position: [number, number], callback: (status: string, result: GeocodeResult) => void): void;
  getLocation(address: string, callback: (status: string, result: GeocodeResult) => void): void;
};

type AMapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Geocoder: new (options?: Record<string, unknown>) => AMapGeocoder;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  plugin(names: string[], callback: () => void): void;
};

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: { serviceHost: string };
    __amapDestinationReady?: () => void;
  }
}

interface MapSelection {
  longitude: number;
  latitude: number;
  destination: string;
  district: string | null;
  address: string;
}

interface DestinationMapPickerProps {
  apiKey: string;
  initialDestination: string;
  onClose: () => void;
  onConfirm: (destination: string) => void;
}

let amapLoader: Promise<AMapNamespace> | null = null;

function ensureDestinationPlugins(AMap: AMapNamespace): Promise<AMapNamespace> {
  if (typeof AMap.Geocoder === "function" && typeof AMap.ToolBar === "function") {
    return Promise.resolve(AMap);
  }
  if (typeof AMap.plugin !== "function") {
    return Promise.reject(new Error("高德地图插件加载器不可用，请刷新页面后重试"));
  }
  return new Promise((resolve, reject) => {
    AMap.plugin(["AMap.Geocoder", "AMap.ToolBar"], () => {
      if (typeof AMap.Geocoder !== "function" || typeof AMap.ToolBar !== "function") {
        reject(new Error("高德地图选点插件加载失败，请刷新页面后重试"));
        return;
      }
      resolve(AMap);
    });
  });
}

export function destinationFromAddress(component?: AddressComponent): string {
  if (!component) return "";
  const city = Array.isArray(component.city) ? component.city[0] : component.city;
  const raw = city || component.province || "";
  return raw.replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/u, "").trim();
}

function loadAmap(apiKey: string): Promise<AMapNamespace> {
  if (window.AMap) return ensureDestinationPlugins(window.AMap);
  if (amapLoader) return amapLoader;

  amapLoader = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` };
    window.__amapDestinationReady = () => {
      if (!window.AMap) {
        amapLoader = null;
        reject(new Error("高德地图脚本加载异常"));
        return;
      }
      void ensureDestinationPlugins(window.AMap).then(resolve, reject);
      delete window.__amapDestinationReady;
    };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=AMap.Geocoder,AMap.ToolBar&callback=__amapDestinationReady`;
    script.async = true;
    script.onerror = () => {
      amapLoader = null;
      delete window.__amapDestinationReady;
      reject(new Error("高德地图加载失败，请检查网络和 JS API Key"));
    };
    document.head.appendChild(script);
  });
  return amapLoader;
}

export function DestinationMapPicker({ apiKey, initialDestination, onClose, onConfirm }: DestinationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const markerRef = useRef<AMapMarker | null>(null);
  const geocoderRef = useRef<AMapGeocoder | null>(null);
  const [searchValue, setSearchValue] = useState(initialDestination);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(apiKey));
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(apiKey ? "" : "地图功能尚未配置，请先填写 Web端（JS API）Key 和安全密钥。好消息是，界面已经准备好了。 ");

  const choosePoint = useCallback((position: [number, number]) => {
    const geocoder = geocoderRef.current;
    const map = mapRef.current;
    if (!geocoder || !map) return;
    setIsResolving(true);
    setError("");
    if (!markerRef.current && window.AMap) {
      markerRef.current = new window.AMap.Marker({ position, anchor: "bottom-center" });
      markerRef.current.setMap(map);
    } else {
      markerRef.current?.setPosition(position);
    }
    map.setCenter(position);
    geocoder.getAddress(position, (status, result) => {
      setIsResolving(false);
      const component = result.regeocode?.addressComponent;
      const destination = destinationFromAddress(component);
      if (status !== "complete" || result.info !== "OK" || !destination) {
        setSelection(null);
        setError("未能识别该位置所在城市，请选择中国大陆城市范围内的位置。 ");
        return;
      }
      setSelection({
        longitude: position[0],
        latitude: position[1],
        destination,
        district: component?.district || null,
        address: result.regeocode?.formattedAddress || `${destination}${component?.district ?? ""}`,
      });
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;
    let cancelled = false;
    let localMap: AMapMap | null = null;
    setIsLoading(true);
    void loadAmap(apiKey).then((AMap) => {
      if (cancelled || !mapContainerRef.current) return;
      localMap = new AMap.Map(mapContainerRef.current, { zoom: 11, viewMode: "2D", resizeEnable: true });
      const geocoder = new AMap.Geocoder({ radius: 1000 });
      mapRef.current = localMap;
      geocoderRef.current = geocoder;
      localMap.setCity(initialDestination);
      localMap.addControl(new AMap.ToolBar({ position: { right: "14px", bottom: "72px" } }));
      localMap.on("click", (event) => choosePoint([event.lnglat.getLng(), event.lnglat.getLat()]));
      geocoder.getLocation(initialDestination, (status, result) => {
        const location = result.geocodes?.[0]?.location;
        if (status === "complete" && result.info === "OK" && location) {
          localMap?.setCenter([location.getLng(), location.getLat()]);
        }
      });
      setIsLoading(false);
    }).catch((loadError) => {
      if (!cancelled) {
        setIsLoading(false);
        setError(loadError instanceof Error ? loadError.message : "高德地图加载失败");
      }
    });
    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      geocoderRef.current = null;
      mapRef.current = null;
      localMap?.destroy();
    };
  }, [apiKey, choosePoint, initialDestination]);

  const searchPlace = (event: FormEvent) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (!query || !geocoderRef.current) return;
    setIsResolving(true);
    setError("");
    geocoderRef.current.getLocation(query, (status, result) => {
      setIsResolving(false);
      const location = result.geocodes?.[0]?.location;
      if (status !== "complete" || result.info !== "OK" || !location) {
        setError("没有找到这个城市或地点，请换一个关键词。 ");
        return;
      }
      mapRef.current?.setZoom(12);
      choosePoint([location.getLng(), location.getLat()]);
    });
  };

  return <div className="map-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="map-picker-modal" role="dialog" aria-modal="true" aria-labelledby="map-picker-title">
      <header>
        <div><span><MapPin size={14} />地图选目的地</span><h2 id="map-picker-title">点击地图，选择想去的城市</h2><p>系统会识别点击位置所在城市，并用它查询景点。</p></div>
        <button ref={closeRef} className="map-picker-close" onClick={onClose} aria-label="关闭地图选择"><X size={20} /></button>
      </header>
      <form className="map-picker-search" onSubmit={searchPlace}>
        <Search size={17} />
        <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="搜索城市或地点，例如：杭州西湖" aria-label="搜索地图地点" />
        <button disabled={!apiKey || isLoading || isResolving}>{isResolving ? "定位中…" : "搜索定位"}</button>
      </form>
      <div className="map-picker-canvas-wrap">
        <div ref={mapContainerRef} className="map-picker-canvas" aria-label="高德地图选点区域" />
        {isLoading && <div className="map-picker-loading"><LoaderCircle size={23} /><span>高德地图加载中…</span></div>}
        {!apiKey && <div className="map-picker-unconfigured"><MapPin size={27} /><b>等待配置高德 JS API</b><span>配置完成后可在这里点击地图选择城市</span></div>}
        <div className="map-picker-hint">点击地图任意位置放置标记</div>
      </div>
      <footer>
        <div className={selection ? "map-selection selected" : "map-selection"}>
          <span className="map-selection-icon">{isResolving ? <LoaderCircle size={17} /> : <MapPin size={17} />}</span>
          <span>{selection ? <><b>{selection.destination}{selection.district ? ` · ${selection.district}` : ""}</b><small>{selection.address}</small></> : <><b>{isResolving ? "正在识别位置…" : "尚未选择位置"}</b><small>{error || "请点击地图，或搜索一个城市和地点"}</small></>}</span>
        </div>
        <div className="map-picker-actions"><button className="map-cancel" onClick={onClose}>取消</button><button className="map-confirm" disabled={!selection || isResolving} onClick={() => selection && onConfirm(selection.destination)}><Check size={15} />使用这个城市</button></div>
      </footer>
    </section>
  </div>;
}
