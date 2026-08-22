import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

let adminClient: SupabaseClient<Database> | null | undefined;

export function createAdminClient(): SupabaseClient<Database> | null {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    adminClient = null;
    return null;
  }
  adminClient = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}