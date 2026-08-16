"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, Clock3, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import type { ScenicSpot } from "@/lib/types";

export interface FavoriteListItem {
  id: number;
  provider: string;
  externalSpotId: string;
  createdAt: string;
  spot: ScenicSpot;
}

function FavoriteImage({ spot }: { spot: ScenicSpot }) {
  const [failed, setFailed] = useState(false);
  const src = spot.images[0];
  if (!src || failed) return <div className="favorite-placeholder" role="img" aria-label={`${spot.name}暂无供应商图片`}><span>{spot.visual || spot.name[0]}</span><small>暂无供应商图片</small></div>;
  return <div className="favorite-photo">
    {/* Supplier image URLs are validated as HTTPS by the scenic adapter. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={`${spot.name}景点图片`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  </div>;
}

export function FavoritesList({ initialFavorites }: { initialFavorites: FavoriteListItem[] }) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const removeFavorite = async (item: FavoriteListItem) => {
    setRemovingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: item.provider, externalSpotId: item.externalSpotId }),
      });
      const data = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "取消收藏失败");
      setFavorites((current) => current.filter((favorite) => favorite.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取消收藏失败，请稍后重试");
    } finally {
      setRemovingId(null);
    }
  };

  if (favorites.length === 0) return <div className="trips-empty favorites-empty"><Bookmark size={28} /><h2>还没有收藏景点</h2><p>浏览景点时点击书签按钮，喜欢的地方就会保存在这里。</p><Link href="/#spots">去发现景点</Link></div>;

  return <>
    {error && <div className="trips-error" role="alert">{error}</div>}
    <div className="favorites-list">
      {favorites.map((item) => <article className="favorite-card" key={item.id}>
        <FavoriteImage spot={item.spot} />
        <div className="favorite-card-body">
          <div className="favorite-card-heading"><div><span>{item.spot.category}</span><h2>{item.spot.name}</h2></div><button type="button" onClick={() => void removeFavorite(item)} disabled={removingId === item.id} aria-label={`取消收藏${item.spot.name}`}>{removingId === item.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}取消收藏</button></div>
          <p>{item.spot.shortDescription ?? item.spot.description ?? "暂无简介"}</p>
          <dl>
            <div><dt><Clock3 size={13} />开放时间</dt><dd>{item.spot.openingHours ?? "暂无数据"}</dd></div>
            <div><dt><MapPin size={13} />地址</dt><dd>{item.spot.address ?? "暂无数据"}</dd></div>
            <div><dt>¥ 参考票价</dt><dd>{item.spot.referencePrice ?? "请以景点官方信息为准"}</dd></div>
          </dl>
        </div>
      </article>)}
    </div>
  </>;
}
