import { NextResponse } from "next/server";
import { scenicSearchRequestSchema } from "@/lib/schemas";
import { searchScenicSpots } from "@/lib/services/scenic";
import type { ApiErrorResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = scenicSearchRequestSchema.parse(await request.json());
    return NextResponse.json(await searchScenicSpots(input.destination, input.query, input.page));
  } catch (error) {
    const message = error instanceof Error ? error.message : "景点信息查询失败，请稍后重试";
    const body: ApiErrorResponse = { error: { code: "SCENIC_SEARCH_FAILED", message, retryable: true } };
    return NextResponse.json(body, { status: 502 });
  }
}
