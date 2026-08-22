import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export function apiError(status: number, code: string, message: string, retryable = status >= 500) {
  return NextResponse.json({ error: { code, message, retryable } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function readJson(request: Request) {
  try { return { ok: true as const, value: await request.json() as unknown }; }
  catch { return { ok: false as const, response: apiError(400, "INVALID_JSON", "请求内容不是有效的 JSON") }; }
}

export async function requireUser() {
  const typed = await createClient();
  const supabase = typed as unknown as SupabaseClient<any>;
  const { data, error } = await typed.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return { ok: false as const, response: apiError(401, "AUTH_REQUIRED", "请先登录后继续操作") };
  return { ok: true as const, supabase, userId };
}

export function parsePositiveId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
