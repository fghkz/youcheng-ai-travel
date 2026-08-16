import "server-only";
import { z } from "zod";
import { truncateDescription } from "@/lib/services/scenic";
import type { ScenicSummariesResponse, ScenicSummary } from "@/lib/types";

interface SummaryInput {
  id: string;
  name: string;
  description: string | null;
}

const modelResponseSchema = z.object({
  summaries: z.array(z.object({
    spotId: z.string().min(1),
    text: z.string().trim().min(1).max(300),
  })).max(8),
});

function fallbackSummaries(spots: SummaryInput[]): ScenicSummary[] {
  return spots.map((spot) => ({
    spotId: spot.id,
    text: truncateDescription(spot.description),
    source: spot.description ? "provider-truncated" : "missing",
  }));
}

export async function summarizeScenicSpots(spots: SummaryInput[]): Promise<ScenicSummariesResponse> {
  const fallback = fallbackSummaries(spots);
  const described = spots.filter((spot) => spot.description);
  if (described.length === 0) {
    return { summaries: fallback, dataSources: { planner: "fallback" }, fallbackNotices: [] };
  }

  if ((process.env.APP_DATA_MODE ?? "demo") === "demo") {
    return {
      summaries: fallback,
      dataSources: { planner: "demo" },
      fallbackNotices: ["当前为演示模式，景点短简介使用供应商原文截取。"],
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      summaries: fallback,
      dataSources: { planner: "fallback" },
      fallbackNotices: ["AI 短简介暂不可用，已展示供应商原文摘要。"],
    };
  }

  const baseUrl = (process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const prompt = [
    "请将以下景点原始简介分别压缩为 80 至 120 个中文字符，并且只输出 JSON 对象。",
    "只能压缩和改写原文已有信息，不得增加历史事实、评级、票价、开放时间、位置或推荐结论。",
    "每个输入 ID 必须且只能返回一次。没有足够信息时忠实保留原文，不要补写。",
    'JSON 示例：{"summaries":[{"spotId":"spot-1","text":"压缩后的简介"}]}',
    `输入：${JSON.stringify(described.map((spot) => ({ spotId: spot.id, name: spot.name, description: spot.description })))}`,
  ].join("\n");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
        messages: [
          { role: "system", content: "你是忠实的中文编辑，只做原文压缩。必须输出合法 JSON，不得输出 Markdown。" },
          { role: "user", content: prompt },
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1800,
      }),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`DeepSeek 返回 HTTP ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error("DeepSeek 摘要被截断");
    const content = choice?.message?.content;
    if (!content) throw new Error("DeepSeek 摘要内容为空");
    const parsed = modelResponseSchema.parse(JSON.parse(content));
    const ids = new Set(described.map((spot) => spot.id));
    const returned = new Set<string>();
    for (const summary of parsed.summaries) {
      if (!ids.has(summary.spotId) || returned.has(summary.spotId)) throw new Error("DeepSeek 返回了未知或重复景点");
      returned.add(summary.spotId);
    }
    if (returned.size !== ids.size) throw new Error("DeepSeek 遗漏了景点摘要");

    const generated = new Map(parsed.summaries.map((summary) => [summary.spotId, truncateDescription(summary.text, 120)]));
    return {
      summaries: spots.map((spot) => spot.description
        ? { spotId: spot.id, text: generated.get(spot.id) ?? truncateDescription(spot.description), source: "deepseek" as const }
        : { spotId: spot.id, text: null, source: "missing" as const }),
      dataSources: { planner: "live" },
      fallbackNotices: [],
    };
  } catch {
    return {
      summaries: fallback,
      dataSources: { planner: "fallback" },
      fallbackNotices: ["AI 短简介生成失败，已展示供应商原文摘要。"],
    };
  }
}
