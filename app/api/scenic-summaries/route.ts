import { NextResponse } from "next/server";
import { scenicSummariesRequestSchema } from "@/lib/schemas";
import { summarizeScenicSpots } from "@/lib/services/summaries";
import type { ApiErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { spots } = scenicSummariesRequestSchema.parse(await request.json());
    return NextResponse.json(await summarizeScenicSpots(spots));
  } catch (error) {
    const body: ApiErrorResponse = {
      error: {
        code: "SCENIC_SUMMARY_FAILED",
        message: error instanceof Error ? error.message : "景点简介生成失败",
        retryable: true,
      },
    };
    return NextResponse.json(body, { status: 502 });
  }
}
