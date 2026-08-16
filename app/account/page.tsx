import { redirect } from "next/navigation";
import { AccountCenter } from "@/components/account-center";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== "string") redirect("/login?next=/account");

  const [{ data: userData }, { data: profile }, trips, favorites, versions] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name,locale,timezone").eq("id", userId).single(),
    supabase.from("trips").select("id", { count: "exact", head: true }),
    supabase.from("favorite_spots").select("id", { count: "exact", head: true }),
    supabase.from("itinerary_versions").select("id", { count: "exact", head: true }),
  ]);

  const email = userData.user?.email;
  if (!email) redirect("/login?next=/account");

  return <AccountCenter
    user={{ id: userId, email }}
    profile={{ displayName: profile?.display_name ?? "", locale: profile?.locale ?? "zh-CN", timezone: profile?.timezone ?? "Asia/Shanghai" }}
    stats={{ trips: trips.count ?? 0, favorites: favorites.count ?? 0, versions: versions.count ?? 0 }}
  />;
}
