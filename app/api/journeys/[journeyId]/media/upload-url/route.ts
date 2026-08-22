import { NextResponse } from "next/server";
import { apiError, readJson, requireUser } from "@/lib/api";
import { createUploadUrlRequestSchema } from "@/lib/journey-schemas";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: Request, context: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await context.params;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = createUploadUrlRequestSchema.safeParse(json.value);
  if (!parsed.success) return apiError(400, "INVALID_MEDIA", parsed.error.issues[0]?.message ?? "图片信息无效");
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { data: journey } = await auth.supabase.from("travel_journeys").select("id")
    .eq("id", journeyId).eq("owner_id", auth.userId).maybeSingle();
  if (!journey) return apiError(404, "JOURNEY_NOT_FOUND", "没有找到该旅行");
  const path = `${auth.userId}/${journeyId}/${crypto.randomUUID()}.${extensions[parsed.data.mimeType]}`;
  const { data, error } = await auth.supabase.storage.from("travel-journal-media").createSignedUploadUrl(path);
  if (error || !data) return apiError(500, "UPLOAD_URL_FAILED", "无法创建图片上传地址，请稍后重试", true);
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
}

