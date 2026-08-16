import "server-only";
import { itineraryResultSchema } from "@/lib/schemas";
import { bestRoute } from "@/lib/services/routes";
import { HOTEL_ORIGIN_ID, type ItineraryResult, type RouteOption, type ScenicSpot, type TripPreferences } from "@/lib/types";

class DeepSeekHttpError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

const visitMinutes: Record<string, number> = {
  "hz-west-lake": 240, "hz-lingyin": 180, "hz-leifeng": 150,
  "hz-xixi": 240, "hz-longjing": 180, "hz-canal": 240,
};

const paceRules = {
  leisurely: { label: "悠闲", maxSpotsPerDay: 2, aiVisitCap: Infinity, demoVisitMinutes: 180, mealMinutes: 90 },
  comfortable: { label: "舒适", maxSpotsPerDay: 3, aiVisitCap: 120, demoVisitMinutes: 120, mealMinutes: 60 },
  compact: { label: "紧凑", maxSpotsPerDay: 4, aiVisitCap: 90, demoVisitMinutes: 90, mealMinutes: 60 },
} as const;

function minutes(value: string): number { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function time(value: number): string { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return dates;
}

function mealBreakFor(preferences: TripPreferences): NonNullable<ItineraryResult["days"][number]["mealBreak"]> | null {
  const dailyStart = minutes(preferences.dailyStartTime);
  const dailyEnd = minutes(preferences.dailyEndTime);
  const start = Math.max(dailyStart, 11 * 60 + 30);
  const end = Math.min(dailyEnd, start + paceRules[preferences.pace].mealMinutes);
  if (end - start < 60) return null;
  return { label: "午餐与休息", startTime: time(start), endTime: time(end), durationMinutes: end - start };
}

function scheduleOutsideMeal(cursor: number, travel: number, duration: number, mealBreak: ReturnType<typeof mealBreakFor>) {
  let arrival = cursor + travel;
  let finish = arrival + duration;
  if (mealBreak) {
    const mealStart = minutes(mealBreak.startTime);
    const mealEnd = minutes(mealBreak.endTime);
    if (cursor < mealEnd && finish > mealStart) {
      arrival = mealEnd + travel;
      finish = arrival + duration;
    }
  }
  return { arrival, finish };
}

function completeDateRange(result: ItineraryResult, preferences: TripPreferences): ItineraryResult {
  const daysByDate = new Map(result.days.map((day) => [day.date, day]));
  const days = datesBetween(preferences.startDate, preferences.endDate).map((date) =>
    daysByDate.get(date) ?? { date, theme: "自由活动", items: [] },
  );
  const missingCount = days.filter((day) => !daysByDate.has(day.date)).length;
  return {
    ...result,
    days,
    warnings: missingCount > 0
      ? [...result.warnings, `AI 未安排其中 ${missingCount} 天，已保留为空闲日期，可继续添加景点。`]
      : result.warnings,
  };
}

function hydrateRoutePolylines(result: ItineraryResult, routes: RouteOption[]): ItineraryResult {
  return {
    ...result,
    days: result.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const candidate = item.routeFromPrevious && routes.find((route) =>
          route.originSpotId === item.routeFromPrevious?.originSpotId
          && route.destinationSpotId === item.routeFromPrevious?.destinationSpotId
          && route.mode === item.routeFromPrevious?.mode,
        );
        return candidate ? { ...item, routeFromPrevious: candidate } : item;
      }),
    })),
  };
}

function addDistanceWarnings(result: ItineraryResult, spots: ScenicSpot[]): ItineraryResult {
  const warnings = [...result.warnings];
  const spotNames = new Map(spots.map((spot) => [spot.id, spot.name]));
  for (const day of result.days) for (const item of day.items) {
    const route = item.routeFromPrevious;
    if (!route || route.source !== "amap-api") continue;
    if ((route.durationMinutes ?? 0) >= 90 || (route.distanceMeters ?? 0) >= 60_000) {
      const warning = `前往${spotNames.get(item.spotId) ?? item.spotId}的路线距离较远（约 ${route.durationMinutes ?? "未知"} 分钟），已保留路线规划；建议选择附近景点后重新规划，以减少通勤。`;
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  return { ...result, warnings };
}

function compactItineraryDays(result: ItineraryResult, preferences: TripPreferences, routes: RouteOption[]): ItineraryResult {
  const originalDays = result.days;
  const scheduled = originalDays.flatMap((day) => day.items.map((item) => ({ item, theme: day.theme })));
  if (scheduled.length < 1) return result;

  const compactedDays = originalDays.map((day) => ({ ...day, items: [] as typeof day.items }));
  const mealBreak = mealBreakFor(preferences);
  const paceRule = paceRules[preferences.pace];
  let dayIndex = 0;
  for (const scheduledItem of scheduled) {
    let placed = false;
    while (dayIndex < compactedDays.length) {
      const day = compactedDays[dayIndex];
      if (day.items.length >= paceRule.maxSpotsPerDay) {
        dayIndex += 1;
        continue;
      }
      const previousItem = day.items.at(-1);
      const originId = previousItem?.spotId ?? (preferences.startFromHotel ? HOTEL_ORIGIN_ID : null);
      const route = originId ? bestRoute(routes, originId, scheduledItem.item.spotId) : null;
      if (originId && !route) {
        dayIndex += 1;
        continue;
      }
      const cursor = previousItem ? minutes(previousItem.visitEndTime) : minutes(preferences.dailyStartTime);
      const compactVisitMinutes = scheduledItem.item.visitDurationSource === "ai-suggestion"
        ? Math.min(scheduledItem.item.suggestedVisitMinutes, paceRule.aiVisitCap)
        : scheduledItem.item.suggestedVisitMinutes;
      const { arrival, finish } = scheduleOutsideMeal(cursor, route?.durationMinutes ?? 0, compactVisitMinutes, mealBreak);
      if (finish <= minutes(preferences.dailyEndTime)) {
        if (day.items.length === 0 && day.theme === "自由活动") day.theme = scheduledItem.theme;
        day.items.push({
          ...scheduledItem.item,
          arrivalTime: time(arrival),
          visitStartTime: time(arrival),
          visitEndTime: time(finish),
          suggestedVisitMinutes: compactVisitMinutes,
          routeFromPrevious: route,
        });
        placed = true;
        break;
      }
      dayIndex += 1;
    }
    if (!placed) return result;
  }

  const movedEarlier = compactedDays.some((day, index) => day.items.length !== originalDays[index].items.length);
  return {
    ...result,
    days: compactedDays.map((day) => day.items.length > 0 ? { ...day, mealBreak } : { ...day, theme: "自由活动", mealBreak: null }),
    warnings: movedEarlier
      ? [...result.warnings, "已在计入交通耗时后优先合并到较早日期，减少不必要的跨日拆分。"]
      : result.warnings,
  };
}

export function createDemoItinerary(preferences: TripPreferences, spots: ScenicSpot[], routes: RouteOption[]): ItineraryResult {
  const remaining = [...spots];
  const days = datesBetween(preferences.startDate, preferences.endDate).map((date, dayIndex) => {
    const items = [];
    let cursor = minutes(preferences.dailyStartTime);
    const dayEnd = minutes(preferences.dailyEndTime);
    let previous: ScenicSpot | null = null;
    const mealBreak = mealBreakFor(preferences);

    while (remaining.length) {
      if (items.length >= paceRules[preferences.pace].maxSpotsPerDay) break;
      if (previous) {
        remaining.sort((a, b) => {
          const ar = bestRoute(routes, previous!.id, a.id)?.durationMinutes ?? Infinity;
          const br = bestRoute(routes, previous!.id, b.id)?.durationMinutes ?? Infinity;
          return ar - br;
        });
      }
      if (!previous && preferences.startFromHotel) {
        remaining.sort((a, b) => {
          const ar = bestRoute(routes, HOTEL_ORIGIN_ID, a.id)?.durationMinutes ?? Infinity;
          const br = bestRoute(routes, HOTEL_ORIGIN_ID, b.id)?.durationMinutes ?? Infinity;
          return ar - br;
        });
      }
      const spot = remaining[0];
      const route = previous
        ? bestRoute(routes, previous.id, spot.id)
        : preferences.startFromHotel ? bestRoute(routes, HOTEL_ORIGIN_ID, spot.id) : null;
      const travel = route?.durationMinutes ?? 0;
      const baseDuration = visitMinutes[spot.id] ?? 150;
      const duration = preferences.pace === "leisurely"
        ? Math.max(baseDuration, paceRules.leisurely.demoVisitMinutes)
        : Math.min(baseDuration, paceRules[preferences.pace].demoVisitMinutes);
      const { arrival, finish } = scheduleOutsideMeal(cursor, travel, duration, mealBreak);
      if (finish > dayEnd) break;
      items.push({
        spotId: spot.id,
        arrivalTime: time(arrival), visitStartTime: time(arrival), visitEndTime: time(finish),
        suggestedVisitMinutes: duration, visitDurationSource: "ai-suggestion" as const,
        routeFromPrevious: route,
      });
      remaining.shift();
      previous = spot;
      cursor = finish + 45;
    }
    return { date, theme: ["城市初见与经典地标", "人文漫游与自然呼吸", "慢行街区与在地生活"][dayIndex] ?? "从容探索目的地", items, mealBreak: items.length ? mealBreak : null };
  });

  return {
    days,
    unscheduledSpots: remaining.map((spot) => ({ spotId: spot.id, reason: "insufficient_time" as const, message: "当前日期和每日时段不足，建议延长行程或替换其他景点。" })),
    warnings: spots.filter((spot) => spot.openingHoursStatus !== "available").map((spot) => `${spot.name}的开放时间暂无数据，请在出行前核实。`),
  };
}

function validateBusinessRules(result: ItineraryResult, preferences: TripPreferences, spots: ScenicSpot[], routes: RouteOption[], requireMealBreak = false): ItineraryResult {
  const ids = new Set(spots.map((spot) => spot.id));
  const used = new Set<string>();
  const usedDates = new Set<string>();
  for (const day of result.days) {
    if (day.date < preferences.startDate || day.date > preferences.endDate) throw new Error("模型返回了日期范围之外的行程");
    if (usedDates.has(day.date)) throw new Error("模型返回了重复日期");
    usedDates.add(day.date);
    if (requireMealBreak && day.items.length > 0 && mealBreakFor(preferences) && !day.mealBreak) {
      throw new Error("行程未预留午餐与休息时间");
    }
    let previousEnd = preferences.dailyStartTime;
    let previousSpotId: string | null = null;
    for (const item of day.items) {
      if (!ids.has(item.spotId) || used.has(item.spotId)) throw new Error("模型返回了未知或重复景点");
      if (item.visitStartTime < preferences.dailyStartTime || item.visitEndTime > preferences.dailyEndTime || item.arrivalTime < previousEnd || item.visitStartTime < item.arrivalTime || item.visitEndTime <= item.visitStartTime) throw new Error("模型返回了越界或重叠时间");
      if (minutes(item.visitEndTime) - minutes(item.visitStartTime) !== item.suggestedVisitMinutes) throw new Error("模型返回的游玩时长与时间段不一致");
      if (day.mealBreak) {
        const mealStart = minutes(day.mealBreak.startTime);
        const mealEnd = minutes(day.mealBreak.endTime);
        if (mealEnd - mealStart !== day.mealBreak.durationMinutes) throw new Error("用餐时间段与时长不一致");
        if (minutes(item.visitStartTime) < mealEnd && minutes(item.visitEndTime) > mealStart) throw new Error("景点游玩时间与用餐时间重叠");
        if (item.routeFromPrevious?.durationMinutes) {
          const departure = minutes(item.arrivalTime) - item.routeFromPrevious.durationMinutes;
          if (departure < mealEnd && minutes(item.arrivalTime) > mealStart) throw new Error("交通时间与用餐时间重叠");
        }
      }
      if (item.routeFromPrevious) {
        const expectedOrigin = previousSpotId ?? (preferences.startFromHotel ? HOTEL_ORIGIN_ID : null);
        if (!expectedOrigin || item.routeFromPrevious.originSpotId !== expectedOrigin || item.routeFromPrevious.destinationSpotId !== item.spotId) throw new Error("模型返回的路线与景点顺序不一致");
        const match = routes.some((route) =>
          route.originSpotId === item.routeFromPrevious?.originSpotId &&
          route.destinationSpotId === item.routeFromPrevious?.destinationSpotId &&
          route.mode === item.routeFromPrevious?.mode &&
          route.durationMinutes === item.routeFromPrevious?.durationMinutes &&
          route.distanceMeters === item.routeFromPrevious?.distanceMeters &&
          route.summary === item.routeFromPrevious?.summary &&
          route.reachable === item.routeFromPrevious?.reachable &&
          route.source === item.routeFromPrevious?.source,
        );
        if (!match) throw new Error("模型返回了候选集合之外的路线");
        if (item.routeFromPrevious.durationMinutes === null || minutes(item.arrivalTime) < minutes(previousEnd) + item.routeFromPrevious.durationMinutes) throw new Error("模型未将交通耗时计入行程");
      } else if (previousSpotId || preferences.startFromHotel) {
        throw new Error("模型遗漏了景点之间的交通路线");
      }
      used.add(item.spotId);
      previousEnd = item.visitEndTime;
      previousSpotId = item.spotId;
    }
  }

  for (const item of result.unscheduledSpots) {
    if (!ids.has(item.spotId) || used.has(item.spotId)) throw new Error("模型返回了未知或重复的未安排景点");
    if (item.reason === "unreachable" && routes.some((route) => route.destinationSpotId === item.spotId && route.reachable)) {
      throw new Error("模型将高德已确认可达的景点错误标记为不可达");
    }
    used.add(item.spotId);
  }
  const hasUnusedDay = datesBetween(preferences.startDate, preferences.endDate).some((date) => {
    const day = result.days.find((candidate) => candidate.date === date);
    return !day || day.items.length === 0;
  });
  if (hasUnusedDay && result.unscheduledSpots.some((item) => item.reason === "insufficient_time")) {
    throw new Error("模型仍有空闲日期，却提前将景点标记为时间不足");
  }
  if (used.size !== ids.size) throw new Error("模型遗漏了部分已选景点");
  return result;
}

export async function createDeepSeekItinerary(preferences: TripPreferences, spots: ScenicSpot[], routes: RouteOption[]): Promise<ItineraryResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY");
  const baseUrl = (process.env.DEEPSEEK_API_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const expectedDates = datesBetween(preferences.startDate, preferences.endDate);
  const paceRule = paceRules[preferences.pace];
  const plannerRoutes = routes.map((route) => {
    const { polyline, ...plannerRoute } = route;
    void polyline;
    return plannerRoute;
  });
  const jsonExample = {
    days: [{
      date: preferences.startDate,
      theme: "当日主题",
      items: [{
        spotId: "必须复制输入中的景点 ID",
        arrivalTime: "09:00",
        visitStartTime: "09:00",
        visitEndTime: "11:30",
        suggestedVisitMinutes: 150,
        visitDurationSource: "ai-suggestion",
        routeFromPrevious: null,
      }],
    }],
    unscheduledSpots: [{ spotId: "未安排景点 ID", reason: "insufficient_time", message: "无法安排的原因" }],
    warnings: ["规划风险提示"],
  };
  const prompt = [
    `必须为日期范围内的每一天返回一个 days 项，日期依次为：${expectedDates.join("、")}。没有景点可安排的日期也必须返回，theme 写“自由活动”，items 返回空数组。`,
    "请规划一份可执行的旅行行程，并且只输出 JSON 对象。",
    `用户选择的游玩节奏是“${paceRule.label}”。具体游玩时长由你根据景点内容、交通耗时和每日时段判断；悠闲节奏侧重充分体验且每天最多 2 个景点，舒适节奏兼顾深度与效率且每天最多 3 个景点，紧凑节奏侧重覆盖更多景点且每天最多 4 个景点。`,
    "只能安排输入中的景点；相邻景点只能逐字段复制输入中的可达路线；不得补写或修改开放时间、票价、距离、耗时和路线摘要。",
    "交通耗时必须计入到达时间；游玩分钟数必须等于游玩起止时间之差；每个景点必须且只能出现在行程或未安排列表一次。",
    preferences.startFromHotel
      ? `每天第一个景点的 routeFromPrevious 必须复制 originSpotId 为 ${HOTEL_ORIGIN_ID} 的酒店出发路线，并将该段耗时计入到达时间。`
      : "每天第一个景点的 routeFromPrevious 必须为 null。",
    "某个景点当天放不下时，必须继续尝试安排到下一天；只有依次尝试完全部日期后总时间仍不足，才能放入 unscheduledSpots，不得因为单日时间不足而提前放弃后续日期。",
    "必须优先填满较早日期：如果后一天的景点连同前一景点到它的真实交通耗时和建议游玩时长可以放入前一天剩余时段，就必须安排在前一天，不得为了平均分配而无必要拆成多天。",
    "每天行程覆盖午间时必须预留 1 至 2 小时吃饭与休息，优先使用 11:30—12:30；景点游玩和交通均不得与该时段重叠。",
    `当多个景点连同交通和用餐略微超过单日时，可按“${paceRule.label}”节奏调整 visitDurationSource 为 ai-suggestion 的建议游玩时长；当前服务端允许的压缩上限为 ${Number.isFinite(paceRule.aiVisitCap) ? `${paceRule.aiVisitCap} 分钟` : "不主动压缩"}。不得修改 provider 来源的游玩时长。`,
    "高德返回可达但耗时或距离较大的路线仍属于可执行路线，不得仅以距离远为由标记 unreachable 或不安排；应优先单独安排，并在 warnings 中提醒目的地较远，建议选择附近景点重新规划。",
    "只有所有日期都无法容纳或路线确实不可达时才放入 unscheduledSpots，不得强行制造重叠行程。",
    `JSON 输出格式示例：${JSON.stringify(jsonExample)}`,
    `输入数据：${JSON.stringify({ preferences, spots, routes: plannerRoutes })}`,
  ].join("\n");
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          messages: [
            { role: "system", content: "你是严谨的旅行排程器。必须输出合法 JSON，不得输出 Markdown。事实字段只能复制输入。" },
            { role: "user", content: attempt === 0 ? prompt : `${prompt}\n上一次输出校验失败，请严格修正格式和时间约束。` },
          ],
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 6000,
        }),
        signal: AbortSignal.timeout(30_000), cache: "no-store",
      });
      if (!response.ok) {
        throw new DeepSeekHttpError(`DeepSeek 返回 HTTP ${response.status}`, response.status === 429 || response.status >= 500);
      }
      const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
      const choice = payload.choices?.[0];
      if (choice?.finish_reason === "length") throw new Error("DeepSeek 输出因长度限制被截断");
      if (choice?.finish_reason === "content_filter") throw new Error("DeepSeek 输出被内容安全策略拦截");
      const content = choice?.message?.content;
      if (!content) throw new Error("DeepSeek 返回内容为空");
      const parsed = itineraryResultSchema.parse(JSON.parse(content));
      const validated = validateBusinessRules(parsed, preferences, spots, routes);
      const completed = completeDateRange(hydrateRoutePolylines(validated, routes), preferences);
      const compacted = compactItineraryDays(completed, preferences, routes);
      return addDistanceWarnings(validateBusinessRules(compacted, preferences, spots, routes, true), spots);
    } catch (error) {
      lastError = error;
      if (error instanceof DeepSeekHttpError && !error.retryable) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("DeepSeek 行程生成失败");
}
