import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Compass } from "lucide-react";
import { FavoritesList, type FavoriteListItem } from "@/components/favorites-list";
import { scenicSpotSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login?next=/favorites");

  const { data, error } = await supabase
    .from("favorite_spots")
    .select("id,provider,external_spot_id,created_at,spot_snapshot")
    .order("created_at", { ascending: false })
    .limit(100);

  const favorites: FavoriteListItem[] = (data ?? []).flatMap((row) => {
    const parsed = scenicSpotSchema.safeParse(row.spot_snapshot);
    if (!parsed.success) return [];
    return [{
      id: row.id,
      provider: row.provider,
      externalSpotId: row.external_spot_id,
      createdAt: row.created_at,
      spot: parsed.data,
    }];
  });

  return (
    <main className="favorites-page">
      <header className="trips-nav">
        <Link href="/"><span><Compass size={19} /></span>悠程 AI</Link>
        <Link href="/account"><ArrowLeft size={14} />返回个人中心</Link>
      </header>
      <section className="favorites-shell">
        <p className="eyebrow">MY FAVORITE PLACES</p>
        <h1>收藏景点</h1>
        <p>把感兴趣的地方先收进清单，规划下一次旅程时再慢慢挑选。</p>
        {error ? <div className="trips-error">暂时无法读取收藏：{error.message}</div> : <FavoritesList initialFavorites={favorites} />}
      </section>
    </main>
  );
}
