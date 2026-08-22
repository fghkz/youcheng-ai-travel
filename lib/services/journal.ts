import "server-only";

import { finalPlanSchema, pageDocumentSchema, type FinalPlan, type PageDocumentV1, type ThemeKey } from "@/lib/journey-types";
import { itineraryResultSchema, scenicSpotSchema } from "@/lib/schemas";

interface SpotRow { external_spot_id: string; spot_snapshot: unknown }
interface JournalSeed {
  title: string;
  destination: string;
  dates: string;
  companionLabel: string;
  closingMessage: string;
  themeKey: ThemeKey;
  tone: string;
  stops: Array<{ id: string; place_name: string; planned_date: string; day_number: number }>;
  entries: Array<{ id: string; stop_id: string | null; title: string | null; mood_key: string | null; mood_text: string | null; message: string | null; body: unknown }>;
  media: Array<{ id: string; entry_id: string | null; stop_id: string | null; caption: string | null }>;
  current?: PageDocumentV1 | null;
  preserveLocked?: boolean;
}

const toneLabels: Record<string, string> = {
  daily: "轻松日常、真诚自然", couple: "情侣纪念、亲密克制", family: "家庭旅行、温暖生活化",
  friends: "朋友同行、活泼有趣", solo: "独自旅行、细腻内省",
};

function plainBody(body: unknown) {
  if (!body || typeof body !== "object" || !("content" in body) || !Array.isArray(body.content)) return "";
  return body.content.map((item) => typeof item === "object" && item && "text" in item && typeof item.text === "string" ? item.text : "").filter(Boolean).join("\n");
}

async function deepSeekJson(prompt: string, maxTokens = 5000) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || process.env.APP_DATA_MODE === "demo") return null;
  const baseUrl = (process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          messages: [
            { role: "system", content: "你是旅行内容编辑。只输出合法 JSON，不输出 Markdown，不发明事实，不输出 HTML。" },
            { role: "user", content: attempt ? `${prompt}\n上一次输出未通过结构校验，请严格修正。` : prompt },
          ],
          thinking: { type: "disabled" }, response_format: { type: "json_object" }, temperature: 0.45, max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(30_000), cache: "no-store",
      });
      if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek returned empty content");
      return JSON.parse(content) as unknown;
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("AI generation failed");
}

async function deepSeekValidated<T>(prompt: string, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } }, maxTokens: number) {
  let lastMessage = "AI 输出未通过结构校验";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const value = await deepSeekJson(attempt ? `${prompt}\n结构校验失败：${lastMessage}。请只返回修正后的完整 JSON。` : prompt, maxTokens);
    if (value === null) return null;
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    lastMessage = parsed.error.issues[0]?.message ?? lastMessage;
  }
  throw new Error(lastMessage);
}
export function buildBaseFinalPlan(itineraryValue: unknown, spotRows: SpotRow[], userRequest = ""): FinalPlan {
  const itinerary = itineraryResultSchema.parse(itineraryValue);
  const spots = new Map(spotRows.map((row) => {
    const parsed = scenicSpotSchema.safeParse(row.spot_snapshot);
    return [row.external_spot_id, parsed.success ? parsed.data : null] as const;
  }));
  return finalPlanSchema.parse({
    days: itinerary.days.map((day) => ({
      date: day.date, theme: day.theme, notes: "",
      items: day.items.map((item) => ({
        spotId: item.spotId,
        placeName: spots.get(item.spotId)?.name ?? item.spotId,
        arrivalTime: item.arrivalTime,
        visitStartTime: item.visitStartTime,
        visitEndTime: item.visitEndTime,
        selected: true,
        transport: item.routeFromPrevious?.summary ?? "",
        accommodation: "", budget: "", reminder: "", notes: "",
        routeFromPrevious: item.routeFromPrevious,
      })),
    })),
    warnings: itinerary.warnings,
    userRequest,
  });
}

export async function generateFinalPlan(base: FinalPlan, userRequest: string, selectedSpotIds?: string[]) {
  const selected = selectedSpotIds?.length ? new Set(selectedSpotIds) : null;
  const filtered = finalPlanSchema.parse({
    ...base,
    userRequest,
    days: base.days.map((day) => ({ ...day, items: day.items.filter((item) => !selected || selected.has(item.spotId)) })),
  });
  if (!userRequest.trim()) return { content: filtered, source: "structured" as const };
  const prompt = [
    "请在不改变日期、景点 ID、地点名称、到达时间、游玩时间和 routeFromPrevious 的前提下，补充每天 notes，以及每个地点的 transport、accommodation、budget、reminder、notes。",
    "不要增加或删除日期和景点，不要修改 selected。所有字符串保持简洁、实用、基于输入；未知预算或住宿写空字符串。",
    `用户要求：${userRequest}`,
    `必须返回与输入完全同构的 JSON：${JSON.stringify(filtered)}`,
  ].join("\n");
  const parsed = await deepSeekValidated(prompt, finalPlanSchema, 6500);
  if (!parsed) return { content: filtered, source: "structured" as const };
  const baseItems = filtered.days.flatMap((day) => day.items);
  const generatedItems = parsed.days.flatMap((day) => day.items);
  if (parsed.days.map((day) => day.date).join("|") !== filtered.days.map((day) => day.date).join("|")
    || generatedItems.map((item) => item.spotId).join("|") !== baseItems.map((item) => item.spotId).join("|")) {
    throw new Error("AI 修改了受保护的日期或地点结构");
  }
  return { content: parsed, source: "deepseek" as const };
}

function fallbackDocument(seed: JournalSeed): PageDocumentV1 {
  const stopNames = seed.stops.slice(0, 4).map((stop) => stop.place_name).join("、");
  return pageDocumentSchema.parse({
    version: 1,
    hero: { title: seed.title, subtitle: `${seed.destination} · ${seed.dates}`, companionLabel: seed.companionLabel },
    intro: { text: stopNames ? `从${stopNames}开始，把计划里的坐标慢慢走成自己的故事。` : "把计划里的坐标，慢慢走成自己的故事。" },
    blocks: [],
    closing: { text: seed.closingMessage || "愿下一次出发，依然保有此刻的好奇。" },
    visibility: { showDates: true, showCompanions: true },
  });
}

export async function generateJournalPage(seed: JournalSeed): Promise<{ document: PageDocumentV1; source: "deepseek" | "structured" }> {
  const fallback = fallbackDocument(seed);
  const prompt = [
    `为一次${toneLabels[seed.tone] ?? toneLabels.daily}的旅行生成在线旅行记录页文案。`,
    "只能根据提供的地点和记录写作，不得编造发生过的事件、人物、天气或感受。",
    "blocks 只允许 text、quote、message、divider，不要生成 gallery 或 mood；id 使用随机 UUID；source 为 ai，locked 为 false，hidden 为 false。",
    `必须符合 PageDocumentV1 示例结构：${JSON.stringify({ ...fallback, blocks: [{ id: crypto.randomUUID(), type: "text", heading: "第一眼", text: "正文", hidden: false, locked: false, source: "ai" }] })}`,
    `旅行资料：${JSON.stringify({ title: seed.title, destination: seed.destination, dates: seed.dates, companionLabel: seed.companionLabel, stops: seed.stops, entries: seed.entries.map((entry) => ({ ...entry, body: plainBody(entry.body) })) })}`,
  ].join("\n");
  const aiDocument = await deepSeekValidated(prompt, pageDocumentSchema, 5000);
  if (!aiDocument) return { document: fallback, source: "structured" };
  const locked = seed.preserveLocked && seed.current ? seed.current.blocks.filter((block) => block.locked) : [];
  const kept = locked;
  return { document: pageDocumentSchema.parse({ ...aiDocument, blocks: [...aiDocument.blocks.filter((block) => !block.locked), ...kept] }), source: "deepseek" };
}
