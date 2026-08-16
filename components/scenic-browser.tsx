"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Building2, Check, ChevronLeft, ChevronRight, Clock3, Flower2, Landmark, LoaderCircle, MapPin, Mountain, RefreshCw, Search, Sparkles, Trees, Waves, X } from "lucide-react";
import type { Viewer } from "@/components/account-nav";
import type { ScenicSpot, ScenicSpotsResponse, ScenicSummariesResponse } from "@/lib/types";

const palette = ["jade", "forest", "sunset", "wetland", "tea", "canal"];

type PlaceholderTheme = "water" | "mountain" | "temple" | "heritage" | "garden" | "urban";

function getPlaceholderTheme(spot: ScenicSpot): PlaceholderTheme {
  const context = `${spot.name} ${spot.category} ${spot.description ?? ""}`;
  if (/湖|溪|湿地|江|河|海|瀑|泉|潭|运河|水库|滩|港/.test(context)) return "water";
  if (/山|峰|峡|谷|岭|洞|岩|崖/.test(context)) return "mountain";
  if (/寺|庙|塔|观|佛|禅|教堂|道场/.test(context)) return "temple";
  if (/古镇|古城|古迹|遗址|博物馆|故居|纪念馆|历史|城墙|古桥|古刹/.test(context)) return "heritage";
  if (/园林|公园|植物园|花|茶|村|田|森林|竹|枫/.test(context)) return "garden";
  return "urban";
}

const placeholderLabels: Record<PlaceholderTheme, string> = {
  water: "湖光水境",
  mountain: "山野胜景",
  temple: "古建禅意",
  heritage: "人文古迹",
  garden: "园林自然",
  urban: "城市漫游",
};

function PlaceholderIcon({ theme }: { theme: PlaceholderTheme }) {
  if (theme === "water") return <Waves size={18} />;
  if (theme === "mountain") return <Mountain size={18} />;
  if (theme === "temple") return <Landmark size={18} />;
  if (theme === "heritage") return <Building2 size={18} />;
  if (theme === "garden") return <Trees size={18} />;
  return <Flower2 size={18} />;
}

async function postJson<T extends object>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as T | { error?: { message?: string } };
  const apiError = "error" in data ? data.error : undefined;
  if (!response.ok || apiError) throw new Error(apiError?.message ?? "请求失败，请稍后重试");
  return data as T;
}

function ScenicImage({ spot, className = "", imageIndex = 0 }: { spot: ScenicSpot; className?: string; imageIndex?: number }) {
  const src = spot.images[imageIndex];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    const theme = getPlaceholderTheme(spot);
    return <div className={`scenic-placeholder placeholder-${theme} ${className}`} role="img" aria-label={`${spot.name}暂无供应商图片，当前展示${placeholderLabels[theme]}主题视觉`}>
      <i className="placeholder-sun" aria-hidden="true" />
      <i className="placeholder-ridge ridge-back" aria-hidden="true" />
      <i className="placeholder-ridge ridge-front" aria-hidden="true" />
      <i className="placeholder-lines" aria-hidden="true" />
      <span className="placeholder-mark" aria-hidden="true">{spot.visual}</span>
      <span className="placeholder-theme"><PlaceholderIcon theme={theme} />{placeholderLabels[theme]}</span>
      <small>暂无供应商图片</small>
    </div>;
  }
  return <div className={`scenic-photo ${className}`}>
    {/* Dynamic supplier hosts cannot be safely enumerated for next/image. URLs are validated server-side as HTTPS. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={`${spot.name}景点图片`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
  </div>;
}

function ScenicDetailModal({ spot, selected, favorited, favoriteLoading, onToggle, onFavorite, onClose }: { spot: ScenicSpot; selected: boolean; favorited: boolean; favoriteLoading: boolean; onToggle: () => void; onFavorite: () => void; onClose: () => void }) {
  const [activeImage, setActiveImage] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

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
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => !element.hasAttribute("hidden"));
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

  const imageCount = spot.images.length;
  return <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button ref={closeRef} className="detail-close" onClick={onClose} aria-label="关闭景点详情"><X size={19} /></button>
      <div className="detail-gallery">
        <ScenicImage spot={spot} imageIndex={activeImage} />
        {imageCount === 0 && <span className="gallery-placeholder-note">主题视觉 · 非景点实拍</span>}
        {imageCount > 1 && <>
          <button className="gallery-arrow previous" aria-label="上一张图片" onClick={() => setActiveImage((current) => (current - 1 + imageCount) % imageCount)}><ChevronLeft size={20} /></button>
          <button className="gallery-arrow next" aria-label="下一张图片" onClick={() => setActiveImage((current) => (current + 1) % imageCount)}><ChevronRight size={20} /></button>
          <span className="gallery-count">{activeImage + 1} / {imageCount}</span>
        </>}
      </div>
      <div className="detail-content">
        <div className="detail-heading"><div><span>{spot.category}</span><h2 id="detail-title">{spot.name}</h2></div><div className="detail-heading-actions"><button className={`detail-favorite ${favorited ? "favorited" : ""}`} onClick={onFavorite} disabled={favoriteLoading}>{favoriteLoading ? <LoaderCircle className="spin" size={15} /> : <Bookmark size={15} fill={favorited ? "currentColor" : "none"} />}{favorited ? "已收藏" : "收藏景点"}</button><button className={selected ? "selected" : ""} onClick={onToggle}>{selected ? <><Check size={15} />已加入行程</> : <><Sparkles size={15} />加入行程</>}</button></div></div>
        <div className="detail-facts">
          <div><Clock3 size={15} /><span><small>开放时间</small><b>{spot.openingHours ?? "暂无数据"}</b></span></div>
          <div><b className="yen">¥</b><span><small>参考票价</small><b>{spot.referencePrice ?? "请以景点官方信息为准"}</b></span></div>
          <div><MapPin size={15} /><span><small>景点地址</small><b>{spot.address ?? "暂无数据"}</b></span></div>
        </div>
        <article><h3>景点介绍</h3><p>{spot.description ?? "暂无详细介绍"}</p></article>
        <p className="detail-source">景点事实信息来自第三方数据服务；开放时间与票价请在出行前以官方信息为准。</p>
      </div>
    </section>
  </div>;
}

interface ScenicBrowserProps {
  viewer: Viewer | null;
  destination: string;
  requestVersion: number;
  disabled: boolean;
  generationStage: "idle" | "routes" | "planning" | "spots";
  hasResult: boolean;
  onGenerate: (spots: ScenicSpot[]) => void;
  onSelectionChange: (spots: ScenicSpot[]) => void;
  onCatalogChange: (spots: ScenicSpot[]) => void;
  onMetaChange: (meta: ScenicSpotsResponse) => void;
  onError: (message: string) => void;
  onBrowseLoading: (loading: boolean) => void;
  onDestinationReset: () => void;
}

export function ScenicBrowser(props: ScenicBrowserProps) {
  const { viewer, destination, requestVersion, disabled, generationStage, hasResult, onGenerate, onSelectionChange, onCatalogChange, onMetaChange, onError, onBrowseLoading, onDestinationReset } = props;
  const [pool, setPool] = useState<ScenicSpot[]>([]);
  const [visibleSpots, setVisibleSpots] = useState<ScenicSpot[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<ScenicSpot[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState("");
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [favoriteLoadingKeys, setFavoriteLoadingKeys] = useState<Set<string>>(new Set());
  const [favoriteNotice, setFavoriteNotice] = useState("");
  const [detailSpot, setDetailSpot] = useState<ScenicSpot | null>(null);
  const loadedDestination = useRef("");
  const collectionToken = useRef(0);
  const detailTrigger = useRef<HTMLElement | null>(null);
  const router = useRouter();

  const favoriteKey = (spot: ScenicSpot) => `${spot.source}:${spot.id}`;

  useEffect(() => {
    if (!viewer) return;
    let active = true;
    void fetch("/api/favorites", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { favorites?: Array<{ provider: string; external_spot_id: string }>; error?: { message?: string } };
        if (!response.ok) throw new Error(data.error?.message ?? "暂时无法读取收藏");
        if (active) setFavoriteKeys(new Set((data.favorites ?? []).map((item) => `${item.provider}:${item.external_spot_id}`)));
      })
      .catch((error: unknown) => { if (active) onError(error instanceof Error ? error.message : "暂时无法读取收藏"); });
    return () => { active = false; };
  }, [viewer, onError]);

  const toggleFavorite = async (spot: ScenicSpot) => {
    if (!viewer) {
      router.push("/login?next=/%23spots");
      return;
    }
    const key = favoriteKey(spot);
    if (favoriteLoadingKeys.has(key)) return;
    const favorited = favoriteKeys.has(key);
    setFavoriteLoadingKeys((current) => new Set(current).add(key));
    setFavoriteNotice("");
    try {
      const response = await fetch("/api/favorites", {
        method: favorited ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(favorited ? { provider: spot.source, externalSpotId: spot.id } : { spot }),
      });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "收藏操作失败，请稍后重试");
      setFavoriteKeys((current) => {
        const next = new Set(current);
        if (favorited) next.delete(key); else next.add(key);
        return next;
      });
      setFavoriteNotice(favorited ? `已取消收藏“${spot.name}”` : `已收藏“${spot.name}”，可在个人中心查看`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "收藏操作失败，请稍后重试");
    } finally {
      setFavoriteLoadingKeys((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  };

  const replaceSpots = (updates: ScenicSpot[]) => {
    const updateMap = new Map(updates.map((spot) => [spot.id, spot]));
    setPool((current) => current.map((spot) => updateMap.get(spot.id) ?? spot));
    setVisibleSpots((current) => current.map((spot) => updateMap.get(spot.id) ?? spot));
    setSelectedSpots((current) => current.map((spot) => updateMap.get(spot.id) ?? spot));
    setDetailSpot((current) => current ? updateMap.get(current.id) ?? current : null);
    onCatalogChange(updates);
  };

  const hydrateSummaries = async (batch: ScenicSpot[], token: number) => {
    const candidates = batch.filter((spot) => spot.description && spot.shortDescriptionSource !== "deepseek");
    if (!candidates.length) return;
    setIsSummarizing(true);
    try {
      const response = await postJson<ScenicSummariesResponse>("/api/scenic-summaries", {
        spots: candidates.map((spot) => ({ id: spot.id, name: spot.name, description: spot.description })),
      });
      const summaries = new Map(response.summaries.map((summary) => [summary.spotId, summary]));
      const updates = batch.map((spot) => {
        const summary = summaries.get(spot.id);
        return summary ? { ...spot, shortDescription: summary.text, shortDescriptionSource: summary.source } : spot;
      });
      if (token === collectionToken.current) replaceSpots(updates);
      setSummaryNotice(response.fallbackNotices[0] ?? "");
    } catch {
      setSummaryNotice("AI 短简介暂不可用，当前展示供应商原文摘要。");
    } finally {
      if (token === collectionToken.current) setIsSummarizing(false);
    }
  };

  const fetchPage = (query: string, page: number) => postJson<ScenicSpotsResponse>("/api/scenic-spots", { destination, query, page });

  const loadCollection = async (query: string, resetSelection: boolean) => {
    const token = ++collectionToken.current;
    setIsBrowsing(true);
    onBrowseLoading(true);
    setSummaryNotice("");
    try {
      const data = await fetchPage(query, 1);
      if (token !== collectionToken.current) return;
      const unique = [...new Map(data.spots.map((spot) => [spot.id, spot])).values()];
      const batch = unique.slice(0, 8);
      setPool(unique);
      setVisibleSpots(batch);
      setNextOffset(batch.length);
      setCurrentPage(data.pagination.currentPage);
      setTotalPages(data.pagination.totalPages);
      setIsExhausted(batch.length >= unique.length && data.pagination.currentPage >= data.pagination.totalPages);
      setActiveQuery(query);
      if (resetSelection) {
        setSelectedSpots([]);
        onSelectionChange([]);
        onDestinationReset();
      }
      onMetaChange(data);
      onCatalogChange(unique);
      void hydrateSummaries(batch, token);
    } catch (error) {
      if (token === collectionToken.current) onError(error instanceof Error ? error.message : "景点查询失败");
    } finally {
      if (token === collectionToken.current) {
        setIsBrowsing(false);
        onBrowseLoading(false);
      }
    }
  };

  useEffect(() => {
    const normalized = destination.trim();
    const changed = Boolean(loadedDestination.current) && loadedDestination.current !== normalized;
    loadedDestination.current = normalized;
    // Loading is intentionally tied to an explicit parent search request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCollection("", changed || requestVersion === 0);
  }, [requestVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNextBatch = async () => {
    const token = collectionToken.current;
    setIsBrowsing(true);
    onBrowseLoading(true);
    try {
      let workingPool = [...pool];
      let page = currentPage;
      let batch = workingPool.slice(nextOffset, nextOffset + 8);
      while (batch.length < 8 && page < totalPages) {
        const data = await fetchPage(activeQuery, page + 1);
        if (token !== collectionToken.current) return;
        page = data.pagination.currentPage;
        const known = new Set(workingPool.map((spot) => spot.id));
        workingPool = [...workingPool, ...data.spots.filter((spot) => !known.has(spot.id))];
        onMetaChange(data);
        onCatalogChange(data.spots);
        batch = workingPool.slice(nextOffset, nextOffset + 8);
        if (data.spots.length === 0 && page >= data.pagination.totalPages) break;
      }
      if (!batch.length) {
        setIsExhausted(true);
        return;
      }
      const newOffset = nextOffset + batch.length;
      setPool(workingPool);
      setVisibleSpots(batch);
      setNextOffset(newOffset);
      setCurrentPage(page);
      setIsExhausted(newOffset >= workingPool.length && page >= totalPages);
      void hydrateSummaries(batch, token);
    } catch (error) {
      onError(error instanceof Error ? error.message : "换一批景点失败");
    } finally {
      setIsBrowsing(false);
      onBrowseLoading(false);
    }
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadCollection(queryInput.trim(), false);
  };

  const toggleSpot = (spot: ScenicSpot) => {
    const selected = selectedSpots.some((item) => item.id === spot.id);
    if (!selected && selectedSpots.length >= 8) { onError("单次最多选择 8 个景点"); return; }
    const next = selected ? selectedSpots.filter((item) => item.id !== spot.id) : [...selectedSpots, spot];
    setSelectedSpots(next);
    onSelectionChange(next);
  };

  const closeDetail = useCallback(() => {
    setDetailSpot(null);
    window.setTimeout(() => detailTrigger.current?.focus(), 0);
  }, []);

  return <>
    <div className="spot-toolbar">
      <form onSubmit={submitSearch} role="search">
        <Search size={17} />
        <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={`在${destination}搜索景点名称`} aria-label={`在${destination}搜索景点`} />
        {activeQuery && <button type="button" className="clear-search" onClick={() => { setQueryInput(""); void loadCollection("", false); }}>清除</button>}
        <button type="submit" disabled={disabled || isBrowsing}>{isBrowsing && queryInput.trim() ? "搜索中…" : "搜索景点"}</button>
      </form>
      <button className="batch-button" onClick={showNextBatch} disabled={disabled || isBrowsing || isExhausted}><RefreshCw size={15} />{isExhausted ? "已浏览全部" : isBrowsing ? "正在加载…" : "换一批"}</button>
    </div>
    <div className="browse-status" aria-live="polite">
      <span>{activeQuery ? <>“{activeQuery}”的搜索结果</> : <>每批展示最多 8 个景点</>}</span>
      {isSummarizing && <span><span className="mini-spinner" />AI 正在精简景点简介</span>}
      {!isSummarizing && summaryNotice && <span>{summaryNotice}</span>}
      {favoriteNotice && <span>{favoriteNotice}</span>}
    </div>

    {visibleSpots.length ? <div className="spot-grid">{visibleSpots.map((spot, index) => {
      const selected = selectedSpots.some((item) => item.id === spot.id);
      const favorited = favoriteKeys.has(favoriteKey(spot));
      const favoriteLoading = favoriteLoadingKeys.has(favoriteKey(spot));
      const openDetail = (trigger: HTMLElement) => { detailTrigger.current = trigger; setDetailSpot(spot); };
      return <article
        key={spot.id}
        className={`spot-card ${selected ? "selected" : ""}`}
        onClick={(event) => openDetail(event.currentTarget)}
      >
        <div className={`spot-visual ${palette[index % palette.length]}`}><ScenicImage spot={spot} /><button type="button" className={`favorite-button ${favorited ? "favorited" : ""}`} aria-label={favorited ? `取消收藏${spot.name}` : `收藏${spot.name}`} title={viewer ? (favorited ? "取消收藏" : "收藏景点") : "登录后收藏"} disabled={favoriteLoading} onClick={(event) => { event.stopPropagation(); void toggleFavorite(spot); }}>{favoriteLoading ? <LoaderCircle className="spin" size={16} /> : <Bookmark size={16} fill={favorited ? "currentColor" : "none"} />}</button>{selected && <b className="check"><Check size={15} /></b>}</div>
        <div className="spot-body">
          <div className="spot-title"><h3>{spot.name}</h3><span>{spot.category}</span></div>
          <p>{spot.shortDescription ?? "暂无简介"}</p>
          <dl><div><dt><Clock3 size={13} /></dt><dd className={spot.openingHours ? "" : "warn"}>{spot.openingHours ?? "暂无数据"}</dd></div><div><dt>¥</dt><dd className={spot.referencePrice ? "" : "warn"}>{spot.referencePrice ?? "请以景点官方信息为准"}</dd></div></dl>
          <div className="spot-actions">
            <button className="view-detail" onClick={(event) => { event.stopPropagation(); openDetail(event.currentTarget); }}>查看详情</button>
            <button className={`select-spot ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); toggleSpot(spot); }}>{selected ? <><Check size={14} />已加入行程</> : <><Sparkles size={14} />加入行程</>}</button>
          </div>
        </div>
      </article>;
    })}</div> : <div className="empty"><Search size={28} /><h3>{activeQuery ? "没有找到匹配景点" : "暂无景点"}</h3><p>{activeQuery ? `请尝试其他${destination}景点名称。` : "请检查目的地后重新查询。"}</p></div>}

    {(visibleSpots.length > 0 || selectedSpots.length > 0) && <div className="selection-bar"><div><span className="count">{selectedSpots.length}</span><span><b>已选景点</b><small>{selectedSpots.map((spot) => spot.name).join("、") || "尚未选择，可从不同批次中添加"}</small></span></div><button onClick={() => onGenerate(selectedSpots)} disabled={disabled || !selectedSpots.length}>{generationStage === "routes" ? "正在查询路线…" : generationStage === "planning" ? "AI 正在规划…" : <><Sparkles size={14} />{hasResult ? "重新生成行程" : "生成我的行程"}</>}</button></div>}

    {detailSpot && <ScenicDetailModal key={detailSpot.id} spot={detailSpot} selected={selectedSpots.some((spot) => spot.id === detailSpot.id)} favorited={favoriteKeys.has(favoriteKey(detailSpot))} favoriteLoading={favoriteLoadingKeys.has(favoriteKey(detailSpot))} onToggle={() => toggleSpot(detailSpot)} onFavorite={() => void toggleFavorite(detailSpot)} onClose={closeDetail} />}
  </>;
}
