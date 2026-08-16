import { TravelPlanner } from "@/components/travel-planner";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const viewer = claims && typeof claims.sub === "string"
    ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
    : null;

  return <TravelPlanner amapJsApiKey={process.env.AMAP_JS_API_KEY ?? ""} viewer={viewer} />;
}
